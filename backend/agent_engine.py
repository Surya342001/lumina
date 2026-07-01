"""
Aurbis Agent Engine
───────────────────
Implements 4 agentic AI patterns:
  1. Multi-Tool Agent  — 5 callable tools (search, details, price, compare, availability)
  2. ReAct Loop        — Reason → Act → Observe → Repeat with live step streaming
  3. Goal Decomposer   — Breaks complex goals into ordered subtasks
  4. Self-Healing RAG  — Detects low-confidence answers, auto-reformulates, retries
"""

import ast
import json
import queue
import re
import threading
from pathlib import Path
from typing import Generator, Optional

DATA_DIR = Path(__file__).parent / "data"

# ──────────────────────────────────────────────────────────────────────────────
# Tool documentation shown to the LLM
# ──────────────────────────────────────────────────────────────────────────────
TOOL_DOCS = """\
search_spaces(location=None, capacity=None, space_type=None, max_price=None)
  → Find workspace options. Returns names, IDs, prices.

get_space_details(space_id)
  → Full info for one space: amenities, pricing tiers, description.

calculate_price(space_id, hours=1)
  → Total cost for a booking duration.

compare_spaces(space_ids)
  → Side-by-side comparison. space_ids = comma-separated IDs, e.g. "KOR-001,WHI-002".

check_availability(space_id="any", date="today", time="any")
  → Check if a space is free on a given date/time.\
"""

REACT_SYSTEM = f"""You are Nova, an AI agent for Aurbis workspace booking in Bangalore.
You have access to real tools. Use them to answer the user's goal accurately.

TOOLS:
{TOOL_DOCS}

STRICT OUTPUT FORMAT — follow exactly every turn:
  Thought: <one sentence reasoning about what to do next>
  Action: tool_name(param="value", param2=10)

When you have enough information to answer fully:
  Thought: I now have all the information needed to give a complete answer.
  Final Answer: <clear, friendly, formatted answer for the user>

RULES:
- Call search_spaces FIRST if you don't know space IDs.
- Never invent IDs — only use IDs returned by search_spaces.
- Maximum 5 tool calls. After 5, give your best Final Answer.
- Always end with Final Answer.\
"""

DECOMPOSE_PROMPT = """\
You are a planning AI. Break this workspace booking goal into 3-5 ordered, specific subtasks.

Goal: "{goal}"

Output ONLY a valid JSON array — no markdown fences, no explanation.
Each item must have: id (int), task (str), tool (str), status="pending"

Valid tools: search_spaces | get_space_details | calculate_price | compare_spaces | check_availability

Example:
[{{"id":1,"task":"Search for conference rooms in Koramangala for 10 people","tool":"search_spaces","status":"pending"}},{{"id":2,"task":"Get amenities and pricing for the top result","tool":"get_space_details","status":"pending"}}]

Output:\
"""


# ──────────────────────────────────────────────────────────────────────────────
# Tool Implementations
# ──────────────────────────────────────────────────────────────────────────────
def _load_spaces() -> list:
    try:
        with open(DATA_DIR / "spaces.json") as f:
            return json.load(f).get("spaces", [])
    except Exception:
        return []


class AurbisTools:
    def __init__(self):
        self.spaces = _load_spaces()

    def search_spaces(self, location=None, capacity=None, space_type=None, max_price=None) -> str:
        results = self.spaces
        if location:
            results = [s for s in results if location.lower() in s.get("location", "").lower()]
        if capacity:
            try:
                cap = int(capacity)
                results = [s for s in results if s.get("capacity", 0) >= cap]
            except (ValueError, TypeError):
                pass
        if space_type:
            st = space_type.lower()
            results = [s for s in results if st in s.get("type_label", "").lower()
                       or st in s.get("type", "").lower()
                       or st in s.get("name", "").lower()]
        if max_price:
            try:
                mp = int(max_price)
                results = [s for s in results if s.get("pricing", {}).get("hourly", 999999) <= mp]
            except (ValueError, TypeError):
                pass

        if not results:
            return "No spaces found matching those criteria. Try broadening the search."

        lines = []
        for s in results[:6]:
            price = s.get("pricing", {}).get("hourly", "N/A")
            cap = s.get("capacity", "?")
            lines.append(
                f"• {s['name']} [{s['id']}] — {s.get('location', '?')} — "
                f"{s.get('type_label', s.get('type', ''))} — {cap} pax — ₹{price}/hr"
            )
        total = len(results)
        shown = min(6, total)
        return f"Found {total} space(s) (showing {shown}):\n" + "\n".join(lines)

    def get_space_details(self, space_id) -> str:
        space = next((s for s in self.spaces if s["id"] == str(space_id)), None)
        if not space:
            available_ids = [s["id"] for s in self.spaces[:6]]
            return (f"Space ID '{space_id}' not found. "
                    f"Use search_spaces first. Some valid IDs: {available_ids}")
        price = space.get("pricing", {})
        amenities = ", ".join(space.get("amenities", [])[:7])
        ideal = ", ".join(space.get("ideal_for", [])[:4])
        return (
            f"{space['name']} ({space['id']}) @ {space.get('location')}\n"
            f"Type: {space.get('type_label', space.get('type', ''))}\n"
            f"Capacity: {space.get('capacity', '?')} people\n"
            f"Hourly: ₹{price.get('hourly', 'N/A')} | "
            f"Half-day: ₹{price.get('half_day', 'N/A')} | "
            f"Full-day: ₹{price.get('full_day', 'N/A')}\n"
            f"Amenities: {amenities}\n"
            f"Ideal for: {ideal}\n"
            f"About: {space.get('description', 'N/A')}"
        )

    def calculate_price(self, space_id, hours=1) -> str:
        space = next((s for s in self.spaces if s["id"] == str(space_id)), None)
        if not space:
            return f"Space ID '{space_id}' not found. Run search_spaces first."
        try:
            hrs = float(hours)
        except (ValueError, TypeError):
            hrs = 1.0
        hourly = space.get("pricing", {}).get("hourly", 0)
        total = int(hourly * hrs)
        return (
            f"{space['name']}: ₹{hourly}/hr × {hrs} hr(s) = ₹{total:,} total\n"
            f"Half-day (4hr): ₹{space['pricing'].get('half_day', hourly * 4):,} | "
            f"Full-day: ₹{space['pricing'].get('full_day', hourly * 8):,}"
        )

    def compare_spaces(self, space_ids) -> str:
        ids = [s.strip() for s in str(space_ids).split(",")]
        found = [s for s in self.spaces if s["id"] in ids]
        if not found:
            return f"No spaces found for IDs: {ids}. Run search_spaces first."
        header = f"{'Space':<28} {'Location':<16} {'Cap':>4} {'₹/hr':>7} {'Amenities':>10}"
        lines = [header, "-" * 70]
        for s in found:
            price = s.get("pricing", {}).get("hourly", 0)
            am_count = len(s.get("amenities", []))
            lines.append(
                f"{s['name']:<28} {s.get('location', '?'):<16} "
                f"{str(s.get('capacity', '?')):>4} {('₹' + str(price)):>7} {(str(am_count) + ' items'):>10}"
            )
        # Recommend best
        sorted_by_value = sorted(found, key=lambda x: (x.get("rating", 0), -x.get("pricing", {}).get("hourly", 0)), reverse=True)
        rec = sorted_by_value[0] if sorted_by_value else None
        result = "\n".join(lines)
        if rec:
            result += f"\n\n✅ Best value: **{rec['name']}** (Rating: {rec.get('rating', 'N/A')})"
        return result

    def check_availability(self, space_id="any", date="today", time="any") -> str:
        space = next((s for s in self.spaces if s["id"] == str(space_id)), None)
        name = space["name"] if space else str(space_id)
        # Simulated — always available for demo
        return (
            f"✅ {name} is AVAILABLE on {date} at {time}.\n"
            f"You can proceed with booking. Minimum booking: 1 hour. "
            f"Cancellation free up to 24 hours before."
        )

    def call(self, tool_name: str, kwargs: dict) -> str:
        dispatch = {
            "search_spaces": self.search_spaces,
            "get_space_details": self.get_space_details,
            "calculate_price": self.calculate_price,
            "compare_spaces": self.compare_spaces,
            "check_availability": self.check_availability,
        }
        fn = dispatch.get(tool_name)
        if not fn:
            valid = ", ".join(dispatch.keys())
            return f"Unknown tool '{tool_name}'. Valid tools: {valid}"
        try:
            return fn(**kwargs)
        except TypeError as e:
            return f"Tool '{tool_name}' argument error: {e}"
        except Exception as e:
            return f"Tool '{tool_name}' failed: {e}"


# ──────────────────────────────────────────────────────────────────────────────
# Output Parsing Helpers
# ──────────────────────────────────────────────────────────────────────────────
def _parse_thought(text: str) -> Optional[str]:
    m = re.search(r'Thought:\s*(.+?)(?=\nAction:|\nFinal Answer:|$)', text, re.DOTALL)
    return m.group(1).strip() if m else None


def _parse_action(text: str) -> Optional[tuple]:
    m = re.search(r'Action:\s*(\w+)\(([^)]*)\)', text, re.DOTALL)
    if not m:
        return None
    tool_name = m.group(1).strip()
    args_str = m.group(2).strip()
    kwargs: dict = {}
    if args_str:
        for part in re.finditer(r'(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|\'[^\']*\'|\d+(?:\.\d+)?)', args_str):
            key = part.group(1)
            try:
                kwargs[key] = ast.literal_eval(part.group(2))
            except Exception:
                kwargs[key] = part.group(2).strip('"\'')
    return tool_name, kwargs


def _parse_final(text: str) -> Optional[str]:
    m = re.search(r'Final Answer:\s*(.+)', text, re.DOTALL)
    return m.group(1).strip() if m else None


# ──────────────────────────────────────────────────────────────────────────────
# ReAct Agent
# ──────────────────────────────────────────────────────────────────────────────
class AurbisAgent:
    """
    ReAct (Reason + Act) agent.
    run_stream() yields step dicts for SSE.
    decompose_goal() returns a task list.
    """

    def __init__(self):
        self.tools = AurbisTools()
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            from langchain_ollama import OllamaLLM
            self._llm = OllamaLLM(model="llama3", temperature=0)
        return self._llm

    # ── ReAct Loop ────────────────────────────────────────────────────────────
    def run_stream(self, goal: str) -> Generator[dict, None, None]:
        """
        ReAct loop — yields step dicts.
        dict keys: type, content/tool/input/step
        Types: thought | action | observation | final | error
        """
        llm = self._get_llm()
        scratchpad = ""
        max_steps = 5

        for step_n in range(max_steps):
            prompt = f"{REACT_SYSTEM}\n\nGoal: {goal}\n\n{scratchpad}"
            try:
                response = llm.invoke(prompt)
            except Exception as e:
                yield {"type": "error", "content": f"LLM error: {e}"}
                return

            thought = _parse_thought(response)
            if thought:
                yield {"type": "thought", "content": thought, "step": step_n + 1}

            # Check for final answer first
            final = _parse_final(response)
            if final:
                yield {"type": "final", "content": final}
                return

            # Parse and execute tool action
            parsed = _parse_action(response)
            if not parsed:
                # LLM didn't follow format — treat whole response as final answer
                clean = response.strip()
                yield {"type": "final", "content": clean if clean else "I was unable to complete the task."}
                return

            tool_name, kwargs = parsed
            yield {"type": "action", "tool": tool_name, "input": kwargs, "step": step_n + 1}

            obs = self.tools.call(tool_name, kwargs)
            yield {"type": "observation", "content": obs, "step": step_n + 1}

            # Append to scratchpad
            scratchpad += (
                f"Thought: {thought or 'Proceeding with tool call.'}\n"
                f"Action: {tool_name}({', '.join(f'{k}={repr(v)}' for k, v in kwargs.items())})\n"
                f"Observation: {obs}\n\n"
            )

        # Force final answer after max steps
        final_prompt = (
            f"{REACT_SYSTEM}\n\nGoal: {goal}\n\n{scratchpad}"
            f"Thought: I have gathered enough information. Now I will give the final answer.\n"
            f"Final Answer:"
        )
        try:
            final_resp = llm.invoke(final_prompt)
            yield {"type": "final", "content": final_resp.strip()}
        except Exception as e:
            yield {"type": "error", "content": f"Failed to generate final answer: {e}"}

    # ── Threaded streaming (for async SSE use) ────────────────────────────────
    def run_stream_queued(self, goal: str) -> queue.Queue:
        """
        Runs run_stream() in a background thread, pushing steps to a Queue.
        Puts None when done. Use in async FastAPI with run_in_executor.
        """
        q: queue.Queue = queue.Queue()

        def _worker():
            try:
                for step in self.run_stream(goal):
                    q.put(step)
            except Exception as e:
                q.put({"type": "error", "content": str(e)})
            finally:
                q.put(None)  # sentinel

        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        return q

    # ── Goal Decomposition ────────────────────────────────────────────────────
    def decompose_goal(self, goal: str) -> list:
        """
        Breaks a complex goal into ordered subtasks via LLM.
        Returns a list of task dicts.
        """
        llm = self._get_llm()
        prompt = DECOMPOSE_PROMPT.format(goal=goal)
        try:
            raw = llm.invoke(prompt)
            # Extract first JSON array from response
            m = re.search(r'\[[\s\S]*?\]', raw)
            if m:
                tasks = json.loads(m.group(0))
                if isinstance(tasks, list) and tasks:
                    # Ensure required fields
                    for i, t in enumerate(tasks):
                        t.setdefault("id", i + 1)
                        t.setdefault("status", "pending")
                    return tasks
        except Exception:
            pass

        # Robust fallback based on goal keywords
        goal_lower = goal.lower()
        tasks = []
        if any(w in goal_lower for w in ["find", "search", "show", "list", "what"]):
            tasks.append({"id": 1, "task": f"Search spaces matching: {goal}", "tool": "search_spaces", "status": "pending"})
            tasks.append({"id": 2, "task": "Get full details for the best match", "tool": "get_space_details", "status": "pending"})
        elif any(w in goal_lower for w in ["book", "reserve", "schedule"]):
            tasks.append({"id": 1, "task": "Search available spaces", "tool": "search_spaces", "status": "pending"})
            tasks.append({"id": 2, "task": "Get details for top match", "tool": "get_space_details", "status": "pending"})
            tasks.append({"id": 3, "task": "Calculate total booking cost", "tool": "calculate_price", "status": "pending"})
            tasks.append({"id": 4, "task": "Verify availability for requested time", "tool": "check_availability", "status": "pending"})
        elif any(w in goal_lower for w in ["compare", "vs", "difference", "best"]):
            tasks.append({"id": 1, "task": "Search candidate spaces", "tool": "search_spaces", "status": "pending"})
            tasks.append({"id": 2, "task": "Compare top options side by side", "tool": "compare_spaces", "status": "pending"})
            tasks.append({"id": 3, "task": "Calculate prices for each option", "tool": "calculate_price", "status": "pending"})
        else:
            tasks = [
                {"id": 1, "task": "Search spaces matching the request", "tool": "search_spaces", "status": "pending"},
                {"id": 2, "task": "Get detailed info on best match", "tool": "get_space_details", "status": "pending"},
                {"id": 3, "task": "Calculate total price", "tool": "calculate_price", "status": "pending"},
                {"id": 4, "task": "Check availability", "tool": "check_availability", "status": "pending"},
            ]
        return tasks


# ──────────────────────────────────────────────────────────────────────────────
# Self-Healing RAG Helper
# ──────────────────────────────────────────────────────────────────────────────
LOW_CONFIDENCE_SIGNALS = [
    "i'm not sure", "i don't have", "i cannot find", "no information",
    "not available in my", "i don't know", "cannot answer", "not certain",
    "my knowledge doesn't", "no specific information", "based on my training",
    "i'm unable to", "unfortunately i don", "i lack", "beyond my knowledge",
]

REFORMULATE_PROMPT = """\
Rewrite this workspace booking query to be more specific and retrieval-friendly.
Only output the rewritten query — no explanation, no quotes.

Original: {query}
Rewritten:\
"""


def reformulate_query(query: str, llm) -> Optional[str]:
    """Use LLM to produce a better RAG query. Returns None if reformulation fails."""
    try:
        prompt = REFORMULATE_PROMPT.format(query=query)
        result = llm.invoke(prompt).strip().strip('"\'')
        if result and result.lower() != query.lower() and len(result) > 5:
            return result
    except Exception:
        pass
    return None
