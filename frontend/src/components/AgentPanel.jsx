import React, { useState, useRef, useEffect } from 'react'

// ── Tool meta (icon + colour) ─────────────────────────────────────────────────
const TOOL_META = {
  search_spaces:      { icon: '🔍', color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/30' },
  get_space_details:  { icon: '📋', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  calculate_price:    { icon: '💰', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
  compare_spaces:     { icon: '⚖️', color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/30' },
  check_availability: { icon: '📅', color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/30' },
}

const STEP_META = {
  thought:     { icon: '💭', label: 'Reasoning',   border: 'border-blue-500/30',    bg: 'bg-blue-500/8',    text: 'text-blue-300' },
  action:      { icon: '🔧', label: 'Tool Call',   border: 'border-amber-500/30',   bg: 'bg-amber-500/8',   text: 'text-amber-300' },
  observation: { icon: '📊', label: 'Result',      border: 'border-green-500/30',   bg: 'bg-green-500/8',   text: 'text-green-300' },
  final:       { icon: '✅', label: 'Final Answer', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  error:       { icon: '❌', label: 'Error',        border: 'border-red-500/30',     bg: 'bg-red-500/8',     text: 'text-red-300' },
}

// ── Example goals ─────────────────────────────────────────────────────────────
const EXAMPLE_GOALS = [
  'Find the best conference room for 12 people in Koramangala under ₹2000/hr',
  'Compare Innovation Hub and Sprint Room — which gives better value?',
  'Book a quiet private space for 4 people in Whitefield for 3 hours tomorrow',
  'What is the cheapest event venue that fits 100 people?',
  'Find and price a team offsite space for 20 people for a full day',
]

// ── Tool Pill ─────────────────────────────────────────────────────────────────
function ToolPill({ name }) {
  const meta = TOOL_META[name] || { icon: '🔧', color: 'text-slate-400', bg: 'bg-white/5 border-white/10' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-mono ${meta.bg} ${meta.color}`}>
      {meta.icon} {name}
    </span>
  )
}

// ── Single step card ──────────────────────────────────────────────────────────
function StepCard({ step, index }) {
  const meta = STEP_META[step.type] || STEP_META.thought
  const toolMeta = step.tool ? TOOL_META[step.tool] : null

  return (
    <div
      className={`border rounded-xl p-3 mb-2 ${meta.border} ${meta.bg}`}
      style={{ animation: 'slideDown 0.25s ease-out' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-base">{meta.icon}</span>
        <span className={`text-xs font-bold uppercase tracking-widest ${meta.text} opacity-80`}>
          {meta.label}
        </span>
        {step.step && (
          <span className="text-xs text-slate-600 ml-auto">step {step.step}</span>
        )}
      </div>

      {/* Tool call details */}
      {step.type === 'action' && step.tool && (
        <div className={`flex items-center gap-2 mb-2 text-xs px-2 py-1.5 rounded-lg border ${toolMeta?.bg || 'bg-white/5 border-white/10'}`}>
          <span>{toolMeta?.icon || '🔧'}</span>
          <span className={`font-mono font-semibold ${toolMeta?.color || 'text-slate-300'}`}>{step.tool}</span>
          {step.input && Object.keys(step.input).length > 0 && (
            <span className="text-slate-500">
              ({Object.entries(step.input).map(([k, v]) => `${k}="${v}"`).join(', ')})
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {step.content && (
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${meta.text} opacity-90`}>
          {step.content}
        </p>
      )}
    </div>
  )
}

// ── Task tree for goal decomposition ─────────────────────────────────────────
function TaskTree({ tasks, activeId }) {
  const statusStyle = {
    pending:    'bg-slate-700 text-slate-400',
    running:    'bg-blue-500/30 text-blue-300 animate-pulse',
    done:       'bg-emerald-500/20 text-emerald-400',
  }
  return (
    <div className="space-y-2">
      {tasks.map((t, i) => {
        const status = t.id === activeId ? 'running' : t.status === 'done' ? 'done' : 'pending'
        const toolMeta = TOOL_META[t.tool] || { icon: '🔧', color: 'text-slate-400' }
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all ${
              status === 'running'
                ? 'border-blue-500/40 bg-blue-500/8'
                : status === 'done'
                ? 'border-emerald-500/30 bg-emerald-500/6'
                : 'border-white/8 bg-white/3'
            }`}
          >
            {/* Step number */}
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${statusStyle[status]}`}>
              {status === 'done' ? '✓' : t.id}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 leading-snug">{t.task}</p>
              <div className="mt-1">
                <ToolPill name={t.tool} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Agent Panel ──────────────────────────────────────────────────────────
export default function AgentPanel() {
  const [goal, setGoal] = useState('')
  const [steps, setSteps] = useState([])
  const [tasks, setTasks] = useState([])
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [running, setRunning] = useState(false)
  const [decomposing, setDecomposing] = useState(false)
  const [mode, setMode] = useState('react')        // 'react' | 'decompose'
  const [tools, setTools] = useState([])
  const [finalAnswer, setFinalAnswer] = useState(null)
  const stepsEndRef = useRef(null)
  const sourceRef = useRef(null)

  // Fetch tool list on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/agent/tools')
      .then(r => r.json())
      .then(d => setTools(d.tools || []))
      .catch(() => {})
  }, [])

  // Auto-scroll as steps arrive
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  // ── Run ReAct Agent ─────────────────────────────────────────────────────────
  function runReact() {
    if (!goal.trim() || running) return
    setRunning(true)
    setSteps([])
    setFinalAnswer(null)

    if (sourceRef.current) sourceRef.current.close()

    const url = `http://localhost:8000/api/agent/stream?goal=${encodeURIComponent(goal.trim())}`
    const es = new EventSource(url)
    sourceRef.current = es

    es.addEventListener('step', e => {
      const data = JSON.parse(e.data)
      setSteps(prev => [...prev, data])
      if (data.type === 'final') setFinalAnswer(data.content)
    })

    es.addEventListener('done', () => {
      es.close()
      setRunning(false)
    })

    es.addEventListener('error', () => {
      es.close()
      setRunning(false)
    })

    es.onerror = () => {
      es.close()
      setRunning(false)
    }
  }

  // ── Goal Decomposition ──────────────────────────────────────────────────────
  async function runDecompose() {
    if (!goal.trim() || decomposing) return
    setDecomposing(true)
    setTasks([])
    setActiveTaskId(null)
    setFinalAnswer(null)

    try {
      const res = await fetch('http://localhost:8000/api/agent/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      })
      const data = await res.json()
      const taskList = data.tasks || []
      setTasks(taskList)

      // Simulate executing tasks one by one
      for (const task of taskList) {
        setActiveTaskId(task.id)
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done' } : t))
      }
      setActiveTaskId(null)
      setFinalAnswer(`✅ All ${taskList.length} subtasks planned. Switch to **Agent Mode** to execute them with live AI reasoning.`)
    } catch (e) {
      setTasks([{ id: 1, task: 'Failed to decompose goal: ' + e.message, tool: 'search_spaces', status: 'pending' }])
    } finally {
      setDecomposing(false)
    }
  }

  function stop() {
    if (sourceRef.current) {
      sourceRef.current.close()
      sourceRef.current = null
    }
    setRunning(false)
    setDecomposing(false)
  }

  const isRunning = running || decomposing
  const hasOutput = steps.length > 0 || tasks.length > 0

  return (
    <div className="flex flex-col h-full bg-[#0f1117] rounded-2xl border border-white/8 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-sm">
            🤖
          </div>
          <span className="text-white font-semibold text-sm">Nova Agent</span>
          <span className="ml-auto text-xs text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
            ReAct · LangChain · Ollama llama3
          </span>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-white/4 rounded-xl mb-3">
          {[
            { id: 'react', label: '⚡ Agent Run', desc: 'Live ReAct loop' },
            { id: 'decompose', label: '🗂️ Goal Plan', desc: 'Task decomposition' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setSteps([]); setTasks([]); setFinalAnswer(null) }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                mode === m.id
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m.label}
              <span className="block text-[10px] opacity-60 font-normal">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Goal input */}
        <div className="relative">
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                mode === 'react' ? runReact() : runDecompose()
              }
            }}
            placeholder="Enter your goal… e.g. 'Find the best conference room for 12 people under ₹2000/hr'"
            rows={2}
            disabled={isRunning}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/40 disabled:opacity-50"
          />
          <button
            onClick={() => mode === 'react' ? runReact() : runDecompose()}
            disabled={!goal.trim() || isRunning}
            className={`absolute bottom-2 right-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              goal.trim() && !isRunning
                ? 'bg-blue-500 hover:bg-blue-400 text-white'
                : 'bg-white/5 text-slate-600 cursor-not-allowed'
            }`}
          >
            {isRunning ? '⏳' : mode === 'react' ? '▶ Run' : '📋 Plan'}
          </button>
        </div>

        {/* Example goals */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
          {EXAMPLE_GOALS.slice(0, 3).map((eg, i) => (
            <button
              key={i}
              onClick={() => setGoal(eg)}
              disabled={isRunning}
              className="flex-shrink-0 text-xs bg-white/4 hover:bg-white/8 border border-white/8 text-slate-500 hover:text-slate-300 px-2.5 py-1 rounded-full transition-all whitespace-nowrap"
            >
              {eg.length > 45 ? eg.slice(0, 45) + '…' : eg}
            </button>
          ))}
        </div>
      </div>

      {/* ── Available Tools strip ───────────────────────────────────────────── */}
      {tools.length > 0 && !hasOutput && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/6">
          <p className="text-xs text-slate-600 mb-2 uppercase tracking-wider">Available Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {tools.map(t => (
              <div
                key={t.name}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${TOOL_META[t.name]?.bg || 'bg-white/5 border-white/10'}`}
              >
                <span>{t.icon}</span>
                <span className={TOOL_META[t.name]?.color || 'text-slate-400'}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Output area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0" style={{ scrollBehavior: 'smooth' }}>

        {/* Empty state */}
        {!hasOutput && !isRunning && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-slate-400 font-medium mb-1">Nova Agent ready</p>
            <p className="text-slate-600 text-sm max-w-xs">
              {mode === 'react'
                ? 'Enter a goal and watch the agent reason, call tools, and build the answer step by step.'
                : 'Enter a complex goal and the agent will break it into an ordered execution plan.'}
            </p>
          </div>
        )}

        {/* Loading spinner */}
        {isRunning && steps.length === 0 && tasks.length === 0 && (
          <div className="flex items-center gap-3 py-4 px-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-300 font-medium">Agent initialising…</p>
              <p className="text-xs text-slate-500">Loading Ollama llama3</p>
            </div>
          </div>
        )}

        {/* ReAct steps */}
        {mode === 'react' && steps.map((step, i) => (
          <StepCard key={i} step={step} index={i} />
        ))}

        {/* Goal decomposition task tree */}
        {mode === 'decompose' && tasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Execution Plan</span>
              <span className="text-xs bg-white/5 border border-white/8 px-2 py-0.5 rounded-full text-slate-500">
                {tasks.length} tasks
              </span>
            </div>
            <TaskTree tasks={tasks} activeId={activeTaskId} />
          </div>
        )}

        {/* Thinking indicator (while steps are streaming) */}
        {running && steps.length > 0 && !finalAnswer && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            Agent thinking…
          </div>
        )}

        {/* Final answer highlight */}
        {finalAnswer && mode === 'decompose' && (
          <div className="mt-3 p-3 bg-emerald-500/8 border border-emerald-500/30 rounded-xl">
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">Plan Ready</p>
            <p className="text-sm text-emerald-300 leading-relaxed whitespace-pre-wrap">{finalAnswer}</p>
          </div>
        )}

        {/* Stop button while running */}
        {isRunning && (
          <button
            onClick={stop}
            className="w-full mt-2 py-1.5 text-xs text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/8 transition-all"
          >
            ⏹ Stop agent
          </button>
        )}

        <div ref={stepsEndRef} />
      </div>

      {/* ── Stats footer ───────────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/6 px-4 py-2 flex items-center gap-4 text-xs text-slate-600">
          <span>💭 {steps.filter(s => s.type === 'thought').length} thoughts</span>
          <span>🔧 {steps.filter(s => s.type === 'action').length} tool calls</span>
          <span>📊 {steps.filter(s => s.type === 'observation').length} observations</span>
          {finalAnswer && <span className="text-emerald-500 ml-auto">✅ Completed</span>}
        </div>
      )}
    </div>
  )
}
