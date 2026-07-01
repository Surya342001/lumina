import React, { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = 'http://localhost:8000'

const TOOL_META = {
  search_spaces: { icon: '🔍', label: 'Search Spaces', color: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  get_space_details: { icon: '📋', label: 'Get Details', color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-500/30' },
  calculate_price: { icon: '💰', label: 'Price', color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30' },
  compare_spaces: { icon: '⚖️', label: 'Compare', color: 'text-pink-300', bg: 'bg-pink-500/10 border-pink-500/30' },
  check_availability: { icon: '📅', label: 'Availability', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
}

const STEP_META = {
  thought: { icon: '💭', label: 'AI thinks', helper: 'Nova decides what to do next', border: 'border-blue-500/30', bg: 'bg-blue-500/8', text: 'text-blue-300' },
  action: { icon: '🔧', label: 'Tool used', helper: 'Nova calls a backend function', border: 'border-amber-500/30', bg: 'bg-amber-500/8', text: 'text-amber-300' },
  observation: { icon: '📊', label: 'Backend result', helper: 'Database result returned', border: 'border-green-500/30', bg: 'bg-green-500/8', text: 'text-green-300' },
  final: { icon: '✅', label: 'Final answer', helper: 'Customer-ready recommendation', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  error: { icon: '⚠️', label: 'Needs attention', helper: 'Something failed while running', border: 'border-red-500/30', bg: 'bg-red-500/8', text: 'text-red-300' },
}

const MODE_INFO = {
  react: {
    title: 'Run Agent',
    subtitle: 'Nova searches, compares, calculates, checks availability, and gives one final answer.',
    button: 'Run Agent',
    placeholder: 'Find the best conference room for 12 people in Bellandur under ₹2000/hr tomorrow afternoon',
  },
  decompose: {
    title: 'Create Goal Plan',
    subtitle: 'Nova converts one big request into small backend tasks before execution.',
    button: 'Create Plan',
    placeholder: 'Plan an offsite with search, price comparison, availability check, and final recommendation',
  },
}

const EXAMPLES = {
  react: [
    ['Find and recommend', 'Find the best conference room for 12 people in Bellandur under ₹2000/hr tomorrow afternoon'],
    ['Compare spaces', 'Compare Innovation Hub and Sprint Room for a tech team of 10 and tell me which is better value'],
    ['Price a booking', 'Find a quiet private office for 4 people in Whitefield and calculate the price for 3 hours'],
  ],
  decompose: [
    ['Team offsite', 'Plan a team offsite for 25 people with space search, price comparison, availability check, and final recommendation'],
    ['Large event', 'Break down how to shortlist an event venue for 100 people near Bannerghatta with budget and availability checks'],
    ['Client meeting', 'Create a step-by-step plan to choose and book a premium client meeting room in MG Road'],
  ],
}

function ToolPill({ name }) {
  const meta = TOOL_META[name] || { icon: '🔧', label: name, color: 'text-slate-400', bg: 'bg-white/5 border-white/10' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${meta.bg} ${meta.color}`}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  )
}

function ExampleButton({ title, goal, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(goal)}
      className="w-full rounded-xl border border-white/8 bg-white/4 p-3 text-left transition-all hover:border-blue-400/35 hover:bg-blue-500/8"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-300/80">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{goal}</p>
    </button>
  )
}

function StepCard({ step }) {
  const meta = STEP_META[step.type] || STEP_META.thought
  const toolMeta = step.tool ? TOOL_META[step.tool] : null
  return (
    <div className={`mb-2 rounded-xl border p-3 ${meta.border} ${meta.bg}`} style={{ animation: 'slideDown 0.2s ease-out' }}>
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 text-base">{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
            {step.step && <span className="ml-auto text-xs text-slate-600">step {step.step}</span>}
          </div>
          <p className="text-xs text-slate-600">{meta.helper}</p>
        </div>
      </div>

      {step.type === 'action' && step.tool && (
        <div className={`mb-2 rounded-lg border px-2.5 py-2 text-xs ${toolMeta?.bg || 'bg-white/5 border-white/10'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span>{toolMeta?.icon || '🔧'}</span>
            <span className={`font-semibold ${toolMeta?.color || 'text-slate-300'}`}>{toolMeta?.label || step.tool}</span>
            {step.input && Object.keys(step.input).length > 0 && (
              <span className="break-all font-mono text-slate-500">
                {Object.entries(step.input).map(([key, value]) => `${key}: ${value}`).join(' · ')}
              </span>
            )}
          </div>
        </div>
      )}

      {step.content && <p className={`whitespace-pre-wrap text-sm leading-relaxed ${meta.text}`}>{step.content}</p>}
    </div>
  )
}

function TaskTree({ tasks, activeId }) {
  const statusStyle = {
    pending: 'bg-slate-700 text-slate-400',
    running: 'bg-blue-500/30 text-blue-300 animate-pulse',
    done: 'bg-emerald-500/20 text-emerald-400',
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => {
        const status = task.id === activeId ? 'running' : task.status === 'done' ? 'done' : 'pending'
        return (
          <div
            key={task.id}
            className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
              status === 'running'
                ? 'border-blue-500/40 bg-blue-500/8'
                : status === 'done'
                ? 'border-emerald-500/30 bg-emerald-500/6'
                : 'border-white/8 bg-white/3'
            }`}
          >
            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${statusStyle[status]}`}>
              {status === 'done' ? '✓' : task.id}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-slate-300">{task.task}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ToolPill name={task.tool} />
                <span className="text-xs text-slate-600">{status === 'running' ? 'checking now' : status}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SharePanel({ goal, result }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  const whatsappUrl = useMemo(() => {
    const text = `Aurbis Nova Agent Result\n\nGoal: ${goal}\n\nResult:\n${result}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [goal, result])

  async function sendEmail() {
    if (!email.trim()) {
      setStatus('Enter an email address first.')
      return
    }
    setSending(true)
    setStatus('Sending result...')
    try {
      const response = await fetch(`${API_BASE}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), goal, result }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not send email')
      setStatus(data.message || 'Result shared.')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm">📤</span>
        <p className="text-sm font-semibold text-emerald-300">Send this result</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="Email address"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-400/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={sendEmail}
          disabled={sending}
          className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Email'}
        </button>
        <button
          type="button"
          onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}
          className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300 transition-all hover:bg-emerald-400/15"
        >
          WhatsApp
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-slate-500">{status}</p>}
    </div>
  )
}

export default function AgentPanel() {
  const [goal, setGoal] = useState('')
  const [steps, setSteps] = useState([])
  const [tasks, setTasks] = useState([])
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [running, setRunning] = useState(false)
  const [decomposing, setDecomposing] = useState(false)
  const [mode, setMode] = useState('react')
  const [tools, setTools] = useState([])
  const [finalAnswer, setFinalAnswer] = useState(null)
  const outputRef = useRef(null)
  const sourceRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/agent/tools`)
      .then(response => response.json())
      .then(data => setTools(data.tools || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const element = outputRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [steps, tasks, finalAnswer])

  function resetOutput() {
    setSteps([])
    setTasks([])
    setActiveTaskId(null)
    setFinalAnswer(null)
  }

  function buildPlanResult(taskList = tasks) {
    return taskList.map(task => `${task.id}. ${task.task} (${task.tool})`).join('\n')
  }

  function runReact() {
    if (!goal.trim() || running) return
    setRunning(true)
    resetOutput()

    if (sourceRef.current) sourceRef.current.close()

    const eventSource = new EventSource(`${API_BASE}/api/agent/stream?goal=${encodeURIComponent(goal.trim())}`)
    sourceRef.current = eventSource

    eventSource.addEventListener('step', event => {
      const data = JSON.parse(event.data)
      setSteps(previous => [...previous, data])
      if (data.type === 'final') setFinalAnswer(data.content)
    })

    eventSource.addEventListener('done', () => {
      eventSource.close()
      setRunning(false)
    })

    eventSource.addEventListener('error', () => {
      eventSource.close()
      setRunning(false)
    })

    eventSource.onerror = () => {
      eventSource.close()
      setRunning(false)
    }
  }

  async function runDecompose() {
    if (!goal.trim() || decomposing) return
    setDecomposing(true)
    resetOutput()

    try {
      const response = await fetch(`${API_BASE}/api/agent/decompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not create a plan')

      const taskList = data.tasks || []
      setTasks(taskList)
      for (const task of taskList) {
        setActiveTaskId(task.id)
        await new Promise(resolve => setTimeout(resolve, 650))
        setTasks(previous => previous.map(item => (item.id === task.id ? { ...item, status: 'done' } : item)))
      }
      setActiveTaskId(null)
      setFinalAnswer(`Plan ready with ${taskList.length} backend tasks. Use Run Agent with the same goal when you want Nova to execute it live.`)
    } catch (error) {
      setTasks([{ id: 1, task: `Plan failed: ${error.message}`, tool: 'search_spaces', status: 'pending' }])
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
  const modeInfo = MODE_INFO[mode]
  const shareResult = mode === 'react' ? finalAnswer : buildPlanResult()

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#0f1117]">
      <div className="flex-shrink-0 border-b border-white/8 px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 text-sm">🤖</div>
          <div>
            <p className="text-sm font-semibold text-white">Nova Agent Workspace</p>
            <p className="text-xs text-slate-600">Autonomous search, planning, pricing, and sharing</p>
          </div>
          <span className="ml-auto rounded-full border border-white/8 bg-white/5 px-2 py-1 text-xs text-slate-500">41 spaces · 13 areas</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {Object.entries(MODE_INFO).map(([id, info]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id)
                resetOutput()
              }}
              className={`rounded-xl border p-3 text-left transition-all ${
                mode === id ? 'border-blue-400/35 bg-blue-500/12 text-blue-200' : 'border-white/8 bg-white/4 text-slate-400 hover:border-white/16 hover:bg-white/6'
              }`}
            >
              <p className="text-sm font-semibold">{info.title}</p>
              <p className="mt-1 text-xs leading-snug opacity-70">{info.subtitle}</p>
            </button>
          ))}
        </div>

        <div className="relative">
          <textarea
            value={goal}
            onChange={event => setGoal(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                mode === 'react' ? runReact() : runDecompose()
              }
            }}
            placeholder={modeInfo.placeholder}
            rows={3}
            disabled={isRunning}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 pr-28 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => (mode === 'react' ? runReact() : runDecompose())}
            disabled={!goal.trim() || isRunning}
            className={`absolute bottom-2 right-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              goal.trim() && !isRunning ? 'bg-blue-500 text-white hover:bg-blue-400' : 'cursor-not-allowed bg-white/5 text-slate-600'
            }`}
          >
            {isRunning ? 'Working...' : modeInfo.button}
          </button>
        </div>
      </div>

      <div ref={outputRef} className="flex-1 overflow-y-auto px-4 py-3">
        {!hasOutput && !isRunning && (
          <div className="space-y-3">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 p-3">
              <p className="text-sm font-semibold text-blue-300">{modeInfo.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{modeInfo.subtitle}</p>
            </div>

            <div className="grid gap-2">
              {EXAMPLES[mode].map(([title, exampleGoal]) => (
                <ExampleButton key={exampleGoal} title={title} goal={exampleGoal} onPick={setGoal} />
              ))}
            </div>

            {tools.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Backend tools Nova can use</p>
                <div className="flex flex-wrap gap-2">
                  {tools.map(tool => <ToolPill key={tool.name} name={tool.name} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {isRunning && steps.length === 0 && tasks.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/8 px-3 py-4">
            <div className="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <div>
              <p className="text-sm font-medium text-blue-300">Nova is starting...</p>
              <p className="text-xs text-slate-500">Connecting to Ollama and backend tools</p>
            </div>
          </div>
        )}

        {mode === 'react' && steps.map((step, index) => <StepCard key={`${step.type}-${index}`} step={step} />)}

        {mode === 'decompose' && tasks.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Goal plan</span>
              <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-xs text-slate-500">{tasks.length} tasks</span>
            </div>
            <TaskTree tasks={tasks} activeId={activeTaskId} />
          </div>
        )}

        {running && steps.length > 0 && !finalAnswer && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
            <div className="flex gap-0.5">
              {[0, 1, 2].map(index => (
                <div key={index} className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: `${index * 0.15}s` }} />
              ))}
            </div>
            Nova is choosing the next tool...
          </div>
        )}

        {finalAnswer && mode === 'decompose' && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-400">Plan ready</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-emerald-300">{finalAnswer}</p>
          </div>
        )}

        {shareResult && <SharePanel goal={goal} result={shareResult} />}

        {isRunning && (
          <button type="button" onClick={stop} className="mt-3 w-full rounded-xl border border-red-500/20 py-2 text-xs text-red-400 transition-all hover:bg-red-500/8">
            Stop agent
          </button>
        )}
      </div>

      {steps.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-4 border-t border-white/6 px-4 py-2 text-xs text-slate-600">
          <span>{steps.filter(step => step.type === 'thought').length} thoughts</span>
          <span>{steps.filter(step => step.type === 'action').length} tools</span>
          <span>{steps.filter(step => step.type === 'observation').length} results</span>
          {finalAnswer && <span className="ml-auto text-emerald-500">Completed</span>}
        </div>
      )}
    </div>
  )
}