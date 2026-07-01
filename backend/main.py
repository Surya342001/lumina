"""
Aurbis AI Assistant — FastAPI Backend
Run: uvicorn main:app --reload --port 8000
"""
import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from rag_engine import AurbisRAG
from agent_engine import AurbisAgent

# ──────────────────────────────────────────────
# App Setup
# ──────────────────────────────────────────────
app = FastAPI(
    title="Aurbis AI Assistant API",
    description="LangChain + RAG powered workspace booking assistant for Aurbis",
    version="1.0.0"
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Initialize RAG Engine (singleton)
# ──────────────────────────────────────────────
rag = AurbisRAG()

DATA_DIR = Path(__file__).parent / "data"

# Load spaces data
try:
    with open(DATA_DIR / "spaces.json") as f:
        SPACES_DATA = json.load(f)
except Exception:
    SPACES_DATA = {"spaces": [], "locations": []}


# ──────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    mode: str  # "openai" | "ollama" | "demo"
    session_id: str
    suggested_spaces: list[str] = []
    booking_confirmed: bool = False
    booking_details: dict = {}


class BookingRequest(BaseModel):
    space_id: str
    date: str
    time_slot: str
    duration_hours: int = 1
    attendees: int
    name: str
    email: str
    notes: Optional[str] = None


class BookingResponse(BaseModel):
    booking_id: str
    space_name: str
    location: str
    date: str
    time_slot: str
    duration_hours: int
    total_price: int
    currency: str
    status: str
    confirmation_message: str


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "Aurbis AI Assistant API",
        "version": "1.0.0",
        "mode": "rag" if rag.use_rag else "demo",
        "status": "running"
    }


@app.get("/api/health")
def health():
    backend = getattr(rag, "rag_backend", "demo") if rag.use_rag else "demo"
    return {"status": "ok", "rag_mode": rag.use_rag, "backend": backend}


# ── Streaming chat endpoint ───────────────────────────────────────────────────
@app.get("/api/chat/stream")
async def chat_stream(message: str, session_id: str = None):
    """
    Server-Sent Events streaming endpoint.
    Emits: stage → token → done events.
    """
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    sid = session_id or str(uuid.uuid4())
    msg = message.strip()

    async def generate():
        try:
            # Stage 1 — always emitted immediately
            yield f"event: stage\ndata: {json.dumps({'stage': 'searching', 'label': 'Searching knowledge base...', 'icon': '🔍'})}\n\n"

            # Run RAG with self-healing in a thread so we don't block the event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, rag.chat_with_healing, msg, sid)

            # Emit heal event if RAG auto-reformulated the query
            if result.get("healed"):
                yield f"event: heal\ndata: {json.dumps({'original': result['original_query'], 'reformulated': result['reformulated_query']})}\n\n"
                await asyncio.sleep(0.05)

            # Stage 2 — retrieval
            sources = result.get("sources", [])
            src_label = f"Retrieved {len(sources)} source{'s' if len(sources) != 1 else ''}..." if sources else "Retrieving context..."
            yield f"event: stage\ndata: {json.dumps({'stage': 'retrieving', 'label': src_label, 'icon': '📚'})}\n\n"
            await asyncio.sleep(0.08)

            # Stage 3 — generating
            yield f"event: stage\ndata: {json.dumps({'stage': 'generating', 'label': 'Generating response...', 'icon': '⚡'})}\n\n"
            await asyncio.sleep(0.06)

            # Stream answer token by token (word-level chunks)
            answer = result.get("answer", "")
            words = answer.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"event: token\ndata: {json.dumps({'token': chunk})}\n\n"
                await asyncio.sleep(0.022)   # ~45 words/sec — fast but visible

            # Final metadata event
            meta = {
                "sources": sources,
                "mode": result.get("mode", "ollama"),
                "suggested_spaces": result.get("suggested_spaces", []),
                "booking_confirmed": result.get("booking_confirmed", False),
                "booking_details": result.get("booking_details", {}),
                "session_id": sid,
            }
            yield f"event: done\ndata: {json.dumps(meta)}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    Main chat endpoint — returns AI response with sources.
    Uses RAG pipeline if OpenAI key is configured, else demo mode.
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = req.session_id or str(uuid.uuid4())
    result = rag.chat(req.message.strip(), session_id)

    return ChatResponse(
        answer=result["answer"],
        sources=result.get("sources", []),
        mode=result.get("mode", "demo"),
        session_id=session_id,
        suggested_spaces=result.get("suggested_spaces", []),
        booking_confirmed=result.get("booking_confirmed", False),
        booking_details=result.get("booking_details", {})
    )


@app.get("/api/spaces")
def get_spaces(
    location: Optional[str] = None,
    space_type: Optional[str] = None,
    min_capacity: Optional[int] = None,
    max_price: Optional[int] = None,
    featured: Optional[bool] = None
):
    """
    Get spaces with optional filtering.
    """
    spaces = SPACES_DATA.get("spaces", [])

    if location:
        spaces = [s for s in spaces if location.lower() in s["location"].lower()]
    if space_type:
        spaces = [s for s in spaces if space_type.lower() in s["type"].lower()]
    if min_capacity:
        spaces = [s for s in spaces if s["capacity"] >= min_capacity]
    if max_price:
        spaces = [s for s in spaces if s["pricing"].get("hourly", 999999) <= max_price]
    if featured is not None:
        spaces = [s for s in spaces if s.get("featured") == featured]

    return {"spaces": spaces, "total": len(spaces)}


@app.get("/api/spaces/semantic-search")
def semantic_search_spaces(q: str = ""):
    """
    AI semantic space search — concept-aware NLP ranking.
    Expands natural language concepts to space attributes, then scores and ranks spaces.
    e.g. 'quiet place for deep work' → finds Focus Pod, The Vault, etc.
    """
    if not q.strip():
        return {"spaces": [], "query": q, "concepts": [], "total": 0}

    query = q.lower().strip()
    query_words = {w for w in query.split() if len(w) > 2}

    # NLP concept expansion map: user intent → space attribute keywords
    CONCEPT_MAP = {
        "quiet":        ["focus", "private", "solo", "concentrated", "pod", "vault", "silent"],
        "creative":     ["creative", "innovation", "design", "studio", "canvas", "art"],
        "tech":         ["tech", "sprint", "agile", "developer", "coding", "hub", "zoom"],
        "luxury":       ["executive", "premium", "butler", "vip", "boardroom"],
        "cheap":        ["hot desk", "desk", "starter", "budget", "walk-in"],
        "affordable":   ["hot desk", "desk", "starter", "walk-in", "350", "250"],
        "large":        ["event", "hall", "deck", "grand", "community", "150", "300"],
        "small":        ["focus", "pod", "private", "vault", "4 pax"],
        "meeting":      ["conference", "meeting", "boardroom", "presentation"],
        "event":        ["event", "hall", "deck", "launch", "celebration"],
        "startup":      ["startup", "founder", "entrepreneur", "network", "pitch", "den"],
        "training":     ["training", "workshop", "classroom", "bootcamp"],
        "networking":   ["community", "open", "network", "startup", "canvas"],
        "focus":        ["focus", "private", "quiet", "concentrated", "solo", "pod"],
        "brainstorm":   ["creative", "collaboration", "innovation", "whiteboard"],
        "presentation": ["conference", "display", "projector", "4k"],
        "interview":    ["private", "confidential", "vault", "secure"],
        "video":        ["zoom", "video", "conferencing", "certified", "4k"],
        "deep":         ["focus", "private", "quiet", "concentrated"],
        "collaborative":["collaboration", "modular", "whiteboard", "multiple screens"],
        "solo":         ["hot desk", "focus", "private", "pod", "individual"],
        "private":      ["private", "focus", "vault", "confidential", "secure"],
    }

    expanded = set(query_words)
    matched_concepts = []
    for concept, terms in CONCEPT_MAP.items():
        if concept in query:
            matched_concepts.append(concept)
            expanded.update(terms)

    spaces = SPACES_DATA.get("spaces", [])

    def score_space(space: dict) -> int:
        searchable = " ".join([
            space.get("name", ""),
            space.get("type_label", ""),
            space.get("description", ""),
            space.get("location", ""),
            str(space.get("capacity", "")),
            " ".join(space.get("ideal_for", [])),
            " ".join(space.get("amenities", [])),
            " ".join(space.get("tags", [])),
        ]).lower()
        score = 0
        for w in query_words:
            if len(w) > 2 and w in searchable:
                score += 3        # direct query match (higher weight)
        for w in (expanded - query_words):
            if len(w) > 3 and w in searchable:
                score += 1        # semantic expansion match
        if space.get("featured"):
            score += 1
        return score

    scored = sorted(spaces, key=lambda s: (-score_space(s), -s.get("rating", 0)))
    ranked = [s for s in scored if score_space(s) > 0]
    if not ranked:
        ranked = scored  # fallback: return all, sorted by rating

    return {
        "spaces": [s["id"] for s in ranked[:8]],
        "query": q,
        "concepts": matched_concepts,
        "total": len(ranked),
    }


@app.get("/api/spaces/{space_id}")
def get_space(space_id: str):
    """Get a single space by ID."""
    spaces = SPACES_DATA.get("spaces", [])
    space = next((s for s in spaces if s["id"] == space_id), None)
    if not space:
        raise HTTPException(status_code=404, detail=f"Space {space_id} not found")
    return space


@app.get("/api/locations")
def get_locations():
    """Get all Aurbis locations."""
    return {"locations": SPACES_DATA.get("locations", [])}


# ── Agent endpoints ──────────────────────────────────────────────────────────

class AgentGoalRequest(BaseModel):
    goal: str
    session_id: Optional[str] = None


@app.get("/api/agent/stream")
async def agent_stream(goal: str, session_id: str = None):
    """
    ReAct agent — SSE streaming.
    Emits: step events (thought | action | observation | final | error) + done.
    """
    if not goal or not goal.strip():
        raise HTTPException(status_code=400, detail="Goal cannot be empty")

    async def generate():
        agent = AurbisAgent()
        step_queue = agent.run_stream_queued(goal.strip())
        loop = asyncio.get_event_loop()

        while True:
            try:
                step = await loop.run_in_executor(None, step_queue.get, True, 120)
                if step is None:
                    break
                yield f"event: step\ndata: {json.dumps(step)}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
                break

        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.post("/api/agent/decompose")
async def agent_decompose(req: AgentGoalRequest):
    """
    Goal decomposition — breaks a complex goal into ordered subtasks.
    Returns a JSON list of task dicts.
    """
    if not req.goal or not req.goal.strip():
        raise HTTPException(status_code=400, detail="Goal cannot be empty")

    loop = asyncio.get_event_loop()
    agent = AurbisAgent()
    tasks = await loop.run_in_executor(None, agent.decompose_goal, req.goal.strip())
    return {"goal": req.goal, "tasks": tasks, "total": len(tasks)}


@app.get("/api/agent/tools")
def agent_tools():
    """List available agent tools with descriptions."""
    return {
        "tools": [
            {"name": "search_spaces",      "description": "Find workspace options by location, capacity, type, or max price", "icon": "🔍"},
            {"name": "get_space_details",  "description": "Get full amenities, pricing tiers, and description for a space",   "icon": "📋"},
            {"name": "calculate_price",    "description": "Calculate total booking cost for a space and duration",            "icon": "💰"},
            {"name": "compare_spaces",     "description": "Side-by-side comparison of multiple spaces",                       "icon": "⚖️"},
            {"name": "check_availability", "description": "Verify if a space is free on a given date and time",               "icon": "📅"},
        ]
    }


class NotifyRequest(BaseModel):
    email: str
    goal: str
    result: str


@app.post("/api/notify")
def notify_result(req: NotifyRequest):
    """
    Send agent search result to user via email.
    Also returns a WhatsApp share URL.
    """
    import re as _re
    if not _re.match(r"[\w.+-]+@[\w-]+\.[\w.]+", req.email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    from email_service import send_agent_result
    sent = send_agent_result(req.email, req.goal, req.result)

    # Build WhatsApp share link (no API key needed — uses wa.me deep link)
    wa_text = f"🤖 Aurbis Nova Agent Result\n\nGoal: {req.goal}\n\nAnswer:\n{req.result}\n\nBook at: https://aurbis.in"
    import urllib.parse
    wa_url = f"https://wa.me/?text={urllib.parse.quote(wa_text)}"

    return {
        "email_sent": sent,
        "email_to": req.email,
        "whatsapp_url": wa_url,
        "message": "Email sent successfully!" if sent else "Email skipped (no SMTP config). Use WhatsApp link to share."
    }


@app.post("/api/book", response_model=BookingResponse)
def book_space(req: BookingRequest):
    """
    Simulate a booking confirmation.
    In production, this would integrate with the actual booking system.
    """
    spaces = SPACES_DATA.get("spaces", [])
    space = next((s for s in spaces if s["id"] == req.space_id), None)

    if not space:
        raise HTTPException(status_code=404, detail=f"Space {req.space_id} not found")

    hourly_price = space["pricing"].get("hourly", 0)
    total_price = hourly_price * req.duration_hours

    booking_id = f"AUR-{uuid.uuid4().hex[:6].upper()}"

    return BookingResponse(
        booking_id=booking_id,
        space_name=space["name"],
        location=space["location"],
        date=req.date,
        time_slot=req.time_slot,
        duration_hours=req.duration_hours,
        total_price=total_price,
        currency="INR",
        status="confirmed",
        confirmation_message=(
            f"✅ Booking confirmed! {space['name']} at {space['location']} "
            f"on {req.date} at {req.time_slot} for {req.duration_hours} hour(s). "
            f"Total: ₹{total_price:,}. Booking ID: {booking_id}"
        )
    )
