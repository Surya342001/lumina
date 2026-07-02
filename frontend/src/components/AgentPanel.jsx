import React, { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = 'http://localhost:8000'

// ─── Keyframe animations injected once ──────────────────────────────────
const ANIM_CSS = `
@keyframes slideFromLeft { from { opacity:0; transform:translateX(-14px); } to { opacity:1; transform:translateX(0); } }
@keyframes dropCard { from { opacity:0; transform:translateY(-12px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes liveBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
@keyframes neonPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
@keyframes scanRight { from { left:-40%; } to { left:120%; } }
@keyframes electricGlow { 0%,100% { box-shadow:0 0 6px rgba(59,130,246,0.4); } 50% { box-shadow:0 0 22px rgba(59,130,246,0.9); } }
@keyframes purpleGlow { 0%,100% { box-shadow:0 0 6px rgba(139,92,246,0.4); } 50% { box-shadow:0 0 22px rgba(139,92,246,0.9); } }
@keyframes stampIn { 0% { opacity:0; transform:scale(1.5) rotate(-12deg); } 70% { transform:scale(0.95) rotate(2deg); } 100% { opacity:1; transform:scale(1) rotate(0); } }
@keyframes drawConnector { from { opacity:0; transform:scaleY(0); transform-origin:top; } to { opacity:1; transform:scaleY(1); } }
`

// ─── Data ────────────────────────────────────────────────────────────────
const TOOL_META = {
  search_spaces:     { icon: '🔍', label: 'Search Spaces',  color: 'text-cyan-300',    bg: 'bg-cyan-500/10 border-cyan-500/30' },
  get_space_details: { icon: '📋', label: 'Get Details',    color: 'text-violet-300',  bg: 'bg-violet-500/10 border-violet-500/30' },
  calculate_price:   { icon: '💰', label: 'Price',          color: 'text-amber-300',   bg: 'bg-amber-500/10 border-amber-500/30' },
  compare_spaces:    { icon: '⚖️', label: 'Compare',        color: 'text-pink-300',    bg: 'bg-pink-500/10 border-pink-500/30' },
  check_availability:{ icon: '📅', label: 'Availability',   color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
}

const STEP_META = {
  thought:     { icon: '💭', label: 'AI thinks',      helper: 'Nova decides what to do next',    border: 'border-blue-500/30',    bg: 'bg-blue-500/8',    text: 'text-blue-300' },
  action:      { icon: '🔧', label: 'Tool called',    helper: 'Nova calls a backend function',   border: 'border-amber-500/30',   bg: 'bg-amber-500/8',   text: 'text-amber-300' },
  observation: { icon: '📊', label: 'Result',         helper: 'Database result returned',        border: 'border-green-500/30',   bg: 'bg-green-500/8',   text: 'text-green-300' },
  final:       { icon: '✅', label: 'Final answer',   helper: 'Customer-ready recommendation',   border: 'border-emerald-500/40', bg: 'bg-emerald-500/10',text: 'text-emerald-300' },
  error:       { icon: '⚠️', label: 'Error',          helper: 'Something failed while running',  border: 'border-red-500/30',     bg: 'bg-red-500/8',     text: 'text-red-300' },
}

const PIPELINE_STAGES = [
  { id: 'understand', label: 'Understand', icon: '🧠' },
  { id: 'search',     label: 'Search',     icon: '🔍' },
  { id: 'analyse',    label: 'Analyse',    icon: '⚖️' },
  { id: 'calculate',  label: 'Calculate',  icon: '💰' },
  { id: 'answer',     label: 'Answer',     icon: '✅' },
]

const REACT_EXAMPLES = [
  { tag: 'FIND & RECOMMEND', goal: 'Find the best conference room for 12 people in Bellandur under ₹2000/hr tomorrow afternoon' },
  { tag: 'COMPARE SPACES',   goal: 'Compare Innovation Hub and Sprint Room for a tech team of 10 and tell me which is better value' },
  { tag: 'PRICE A BOOKING',  goal: 'Find a quiet private office for 4 people in Whitefield and calculate the price for 3 hours' },
]

const DECOMPOSE_EXAMPLES = [
  { tag: 'TEAM OFFSITE',   goal: 'Plan a team offsite for 25 people with space search, price comparison, availability check, and final recommendation' },
  { tag: 'LARGE EVENT',    goal: 'Break down how to shortlist an event venue for 100 people near Bannerghatta with budget and availability' },
  { tag: 'CLIENT MEETING', goal: 'Create a step-by-step plan to choose and book a premium client meeting room in MG Road' },
]

const BLUEPRINT_BG = 'repeating-linear-gradient(0deg,rgba(139,92,246,0.045) 0px,rgba(139,92,246,0.045) 1px,transparent 1px,transparent 22px),repeating-linear-gradient(90deg,rgba(139,92,246,0.045) 0px,rgba(139,92,246,0.045) 1px,transparent 1px,transparent 22px)'

// ─── Shared ──────────────────────────────────────────────────────────────
function ToolPill({ name }) {
  const meta = TOOL_META[name] || { icon: '🔧', label: name, color: 'text-slate-400', bg: 'bg-white/5 border-white/10' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${meta.bg} ${meta.color}`}>
      <span>{meta.icon}</span><span>{meta.label}</span>
    </span>
  )
}

// ─── RUN AGENT: Live Stream Board ────────────────────────────────────────
function LiveStreamBoard({ steps, running, finalAnswer }) {
  const latestStep   = steps[steps.length - 1]
  const thoughtCount = steps.filter(s => s.type === 'thought').length
  const actionCount  = steps.filter(s => s.type === 'action').length
  const resultCount  = steps.filter(s => s.type === 'observation').length

  let activeIndex = 0
  if (finalAnswer) activeIndex = 4
  else if (latestStep?.tool === 'calculate_price') activeIndex = 3
  else if (latestStep?.tool === 'compare_spaces')  activeIndex = 2
  else if (latestStep?.type === 'action')          activeIndex = 1
  else if (latestStep?.type === 'observation')     activeIndex = Math.min(2 + resultCount, 3)

  const pct = (activeIndex / 4) * 100

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-blue-500/25 bg-[#040d1c]"
         style={{ boxShadow: '0 0 32px rgba(59,130,246,0.12)' }}>
      <div className="flex items-center gap-3 border-b border-blue-500/12 bg-gradient-to-r from-blue-600/14 to-cyan-500/6 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-500/15 text-base"
             style={{ animation: running ? 'electricGlow 1.6s ease-in-out infinite' : 'none' }}>⚡</div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Live Agent Stream</p>
          <p className="text-xs text-slate-500">{finalAnswer ? 'Mission complete' : running ? 'Execution in progress...' : 'Ready'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {running && <span className="h-2 w-2 rounded-full bg-red-400" style={{ animation: 'liveBlink 0.75s ease-in-out infinite' }} />}
          <span className="rounded-full border border-blue-400/25 bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-300">
            {finalAnswer ? 'DONE' : running ? 'LIVE' : 'READY'}
          </span>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="relative mb-2 h-1 overflow-hidden rounded-full bg-white/6">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-700"
               style={{ width: `${pct}%` }} />
          {running && (
            <div className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                 style={{ animation: 'scanRight 1.4s linear infinite' }} />
          )}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const active   = i === activeIndex && !finalAnswer && (running || steps.length > 0)
            const complete = i < activeIndex || !!finalAnswer
            return (
              <div key={stage.id}
                   className={`flex flex-col items-center rounded-xl border py-2 transition-all duration-300 ${
                     active   ? 'border-blue-400/50 bg-blue-500/20 text-blue-200' :
                     complete ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' :
                                'border-white/6 bg-white/3 text-slate-600'
                   }`}
                   style={active ? { animation: 'electricGlow 1.6s ease-in-out infinite' } : {}}>
                <span className="text-sm">{stage.icon}</span>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider">{stage.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/6 border-t border-white/6 text-center text-xs">
        <div className="px-2 py-2"><p className="text-slate-600">Thoughts</p><p className="font-bold text-blue-300">{thoughtCount}</p></div>
        <div className="px-2 py-2"><p className="text-slate-600">Tools Used</p><p className="font-bold text-amber-300">{actionCount}</p></div>
        <div className="px-2 py-2"><p className="text-slate-600">Results</p><p className="font-bold text-emerald-300">{resultCount}</p></div>
      </div>
    </div>
  )
}

// ─── GOAL BLUEPRINT: Architect Board ─────────────────────────────────────
function BlueprintBoard({ tasks, running, finalAnswer }) {
  const done  = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-purple-500/25 bg-[#060310]"
         style={{ backgroundImage: BLUEPRINT_BG, boxShadow: '0 0 32px rgba(139,92,246,0.12)' }}>
      <div className="flex items-center gap-3 border-b border-purple-500/15 bg-gradient-to-r from-purple-700/16 to-indigo-500/8 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-400/35 bg-purple-500/18 text-base"
             style={{ animation: running ? 'purpleGlow 2s ease-in-out infinite' : 'none' }}>📐</div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-200">Goal Blueprint</p>
          <p className="text-xs text-slate-500">
            {finalAnswer ? `${total} tasks drafted` : running ? `Building plan... ${done}/${total || '?'}` : 'Awaiting your goal'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {running && <span className="h-2 w-2 rounded-full bg-amber-400" style={{ animation: 'liveBlink 1.2s ease-in-out infinite' }} />}
          <span className="rounded-full border border-purple-400/25 bg-purple-500/12 px-2 py-0.5 text-xs font-bold text-purple-300">
            {finalAnswer ? 'DRAFTED' : running ? 'PLANNING' : 'READY'}
          </span>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="relative mb-2.5 h-1 overflow-hidden rounded-full bg-white/6">
          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-400 to-amber-400 transition-all duration-700"
               style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
        </div>
        {tasks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(tasks.map(t => t.tool))].map(tool => <ToolPill key={tool} name={tool} />)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 divide-x divide-purple-500/10 border-t border-purple-500/10 text-center text-xs">
        <div className="px-2 py-2"><p className="text-slate-600">Steps</p><p className="font-bold text-purple-300">{total || '—'}</p></div>
        <div className="px-2 py-2"><p className="text-slate-600">Drafted</p><p className="font-bold text-amber-300">{done}</p></div>
        <div className="px-2 py-2"><p className="text-slate-600">Pending</p><p className="font-bold text-indigo-300">{total - done || '—'}</p></div>
      </div>
    </div>
  )
}

// ─── Step card — terminal aesthetic ──────────────────────────────────────
function StepCard({ step, index }) {
  const meta     = STEP_META[step.type] || STEP_META.thought
  const toolMeta = step.tool ? TOOL_META[step.tool] : null
  return (
    <div className={`mb-2 rounded-xl border p-3 ${meta.border} ${meta.bg}`}
         style={{ animation: `slideFromLeft 0.22s ease-out ${Math.min(index * 0.025, 0.2)}s both` }}>
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 text-base">{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-xs font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
            {step.step && <span className="ml-auto font-mono text-xs text-slate-600">#{step.step}</span>}
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
                {Object.entries(step.input).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </span>
            )}
          </div>
        </div>
      )}
      {step.content && (
        <p className={`whitespace-pre-wrap font-mono text-sm leading-relaxed ${meta.text}`}>{step.content}</p>
      )}
    </div>
  )
}

// ─── Task tree — blueprint DAG with connectors ────────────────────────────
function TaskTree({ tasks, activeId }) {
  return (
    <div>
      {tasks.map((task, i) => {
        const isActive = task.id === activeId
        const isDone   = task.status === 'done' && !isActive
        return (
          <div key={task.id} className="relative flex gap-3"
               style={{ animation: `dropCard 0.32s ease-out ${i * 0.07}s both` }}>
            {i < tasks.length - 1 && (
              <div className="absolute left-[15px] top-10 bottom-0 w-px"
                   style={{
                     background: isDone
                       ? 'linear-gradient(to bottom,rgba(52,211,153,0.4),rgba(52,211,153,0.1))'
                       : 'linear-gradient(to bottom,rgba(139,92,246,0.3),rgba(139,92,246,0.05))',
                     animation: `drawConnector 0.4s ease-out ${i * 0.07 + 0.3}s both`,
                   }} />
            )}
            <div className={`relative z-10 mt-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all ${
              isActive ? 'border-purple-400/60 bg-purple-500/30 text-purple-200' :
              isDone   ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300' :
                         'border-white/10 bg-white/4 text-slate-500'
            }`} style={isActive ? { animation: 'purpleGlow 1.6s ease-in-out infinite' } : {}}>
              {isDone ? '✓' : task.id}
            </div>
            <div className={`mb-2.5 flex-1 rounded-xl border px-3 py-2.5 transition-all ${
              isActive ? 'border-purple-500/45 bg-purple-500/10' :
              isDone   ? 'border-emerald-500/25 bg-emerald-500/6' :
                         'border-white/6 bg-white/3'
            }`}>
              <p className={`text-sm leading-snug ${isActive ? 'text-purple-100' : isDone ? 'text-slate-300' : 'text-slate-500'}`}>{task.task}</p>
              <div className="mt-2 flex items-center gap-2">
                <ToolPill name={task.tool} />
                {isActive && <span className="animate-pulse text-xs text-purple-400">drafting...</span>}
                {isDone   && <span className="text-xs text-emerald-500/80">added ✓</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Idle screens ─────────────────────────────────────────────────────────
function AgentIdleScreen({ tools, onPick }) {
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-[#030c1e] p-4"
           style={{ boxShadow: '0 0 24px rgba(59,130,246,0.08)' }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400" style={{ animation: 'neonPulse 2s ease-in-out infinite' }} />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Instant Execution</span>
        </div>
        <p className="text-sm font-semibold text-white">Nova acts, not just plans</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Calls real backend tools — search, compare, calculate pricing — and returns one final recommendation. Watch every decision in real time.
        </p>
        <div className="relative mt-3 h-px overflow-hidden rounded-full bg-white/6">
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
               style={{ animation: 'scanRight 2.2s linear infinite' }} />
        </div>
      </div>
      <div className="space-y-2">
        {REACT_EXAMPLES.map(({ tag, goal }) => (
          <button key={goal} type="button" onClick={() => onPick(goal)}
                  className="group w-full rounded-xl border border-white/6 bg-[#07101f] p-3 text-left transition-all hover:border-blue-400/30 hover:bg-blue-500/6">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-xs text-blue-500/50">$</span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400/75">{tag}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300 transition-colors group-hover:text-white">{goal}</p>
          </button>
        ))}
      </div>
      {tools.length > 0 && (
        <div className="rounded-xl border border-white/6 bg-white/3 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Backend tools Nova can use</p>
          <div className="flex flex-wrap gap-2">{tools.map(t => <ToolPill key={t.name} name={t.name} />)}</div>
        </div>
      )}
    </div>
  )
}

function PlanIdleScreen({ tools, onPick }) {
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-[#06030f] p-4"
           style={{ backgroundImage: BLUEPRINT_BG, boxShadow: '0 0 24px rgba(139,92,246,0.08)' }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" style={{ animation: 'neonPulse 2.5s ease-in-out infinite' }} />
          <span className="text-xs font-bold uppercase tracking-wider text-purple-300">Strategic Blueprint</span>
        </div>
        <p className="text-sm font-semibold text-white">Design before you execute</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Nova breaks your goal into a numbered execution plan — each step mapped to a specific tool. Review the full task graph before running anything live.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-purple-500/40 font-mono">
          <span>AURBIS_NOVA / BLUEPRINT</span><span className="ml-auto">v2.1</span>
        </div>
      </div>
      <div className="space-y-2">
        {DECOMPOSE_EXAMPLES.map(({ tag, goal }, i) => (
          <button key={goal} type="button" onClick={() => onPick(goal)}
                  className="group relative w-full overflow-hidden rounded-xl border border-purple-500/14 bg-[#06030f] p-3 text-left transition-all hover:border-purple-400/35 hover:bg-purple-500/6"
                  style={{ backgroundImage: 'repeating-linear-gradient(90deg,rgba(139,92,246,0.03) 0px,rgba(139,92,246,0.03) 1px,transparent 1px,transparent 22px)' }}>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded border border-purple-500/30 bg-purple-500/15 text-xs font-bold text-purple-300">{i + 1}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400/75">{tag}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300 transition-colors group-hover:text-white">{goal}</p>
          </button>
        ))}
      </div>
      {tools.length > 0 && (
        <div className="rounded-xl border border-purple-500/12 bg-purple-900/5 p-3"
             style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(139,92,246,0.03) 0px,rgba(139,92,246,0.03) 1px,transparent 1px,transparent 22px)' }}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-500/60">Tools available in the plan</p>
          <div className="flex flex-wrap gap-2">{tools.map(t => <ToolPill key={t.name} name={t.name} />)}</div>
        </div>
      )}
    </div>
  )
}

// ─── Share panel ─────────────────────────────────────────────────────────
function SharePanel({ goal, result }) {
  const [email,   setEmail]   = useState('')
  const [notice,  setNotice]  = useState('')
  const [receipt, setReceipt] = useState(null)
  const [sending, setSending] = useState(false)

  const whatsappUrl = useMemo(() => {
    const text = `Aurbis Nova Agent Result\n\nGoal: ${goal}\n\nResult:\n${result}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [goal, result])

  async function sendEmail() {
    if (!email.trim()) { setNotice('Enter an email address first.'); return }
    setSending(true); setNotice('Processing secure delivery...'); setReceipt(null)
    try {
      const response = await fetch(`${API_BASE}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), goal, result }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not send email')
      setReceipt({
        id: data.notification_id || `AUR-RCPT-${Date.now().toString().slice(-6)}`,
        email: data.email_to || email.trim(),
        status: data.delivery_status || (data.email_sent ? 'DELIVERED' : 'SHARE_READY'),
        message: data.message || 'Delivery successful. Receipt generated.',
        processedAt: data.processed_at ? new Date(data.processed_at).toLocaleString() : new Date().toLocaleString(),
      })
      setNotice('')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/8">
      <div className="border-b border-emerald-500/15 bg-gradient-to-r from-emerald-500/12 to-cyan-500/8 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">📤</span>
          <div>
            <p className="text-sm font-semibold text-emerald-300">Send this result</p>
            <p className="text-xs text-slate-500">Email receipt + WhatsApp share link</p>
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"
                 className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-400/50 focus:outline-none" />
          <button type="button" onClick={sendEmail} disabled={sending}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
            {sending ? 'Sending...' : 'Email'}
          </button>
          <button type="button" onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}
                  className="rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300 transition-all hover:bg-emerald-400/15">
            WhatsApp
          </button>
        </div>
        {notice && <p className="mt-2 text-xs text-slate-500">{notice}</p>}
        {receipt && (
          <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-black/25 p-4 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-xl text-black shadow-[0_0_28px_rgba(52,211,153,0.45)]">✓</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Delivery Successful</p>
                <p className="truncate text-sm text-white">Result sent to {receipt.email}</p>
              </div>
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{receipt.status}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between border-b border-white/8 pb-2">
                <span className="text-xs text-slate-500">Nova Receipt</span>
                <span className="text-sm font-semibold text-emerald-300">₹0.00</span>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="flex justify-between gap-3"><span className="text-slate-600">Receipt ID</span><span className="font-mono text-slate-300">{receipt.id}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-600">Channel</span><span className="text-slate-300">Email</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-600">Processed</span><span className="text-right text-slate-300">{receipt.processedAt}</span></div>
              </div>
            </div>
            <p className="mt-3 text-xs text-emerald-300/80">{receipt.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────
export default function AgentPanel() {
  const [goal,         setGoal]         = useState('')
  const [steps,        setSteps]        = useState([])
  const [tasks,        setTasks]        = useState([])
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [running,      setRunning]      = useState(false)
  const [decomposing,  setDecomposing]  = useState(false)
  const [mode,         setMode]         = useState('react')
  const [tools,        setTools]        = useState([])
  const [finalAnswer,  setFinalAnswer]  = useState(null)
  const outputRef = useRef(null)
  const sourceRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/agent/tools`)
      .then(r => r.json())
      .then(d => setTools(d.tools || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [steps, tasks, finalAnswer])

  function resetOutput() {
    setSteps([]); setTasks([]); setActiveTaskId(null); setFinalAnswer(null)
  }

  function buildPlanResult(taskList = tasks) {
    return taskList.map(t => `${t.id}. ${t.task} (${t.tool})`).join('\n')
  }

  function runReact() {
    if (!goal.trim() || running) return
    setRunning(true); resetOutput()
    if (sourceRef.current) sourceRef.current.close()
    const es = new EventSource(`${API_BASE}/api/agent/stream?goal=${encodeURIComponent(goal.trim())}`)
    sourceRef.current = es
    es.addEventListener('step', e => {
      const data = JSON.parse(e.data)
      setSteps(prev => [...prev, data])
      if (data.type === 'final') setFinalAnswer(data.content)
    })
    es.addEventListener('done',  () => { es.close(); setRunning(false) })
    es.addEventListener('error', () => { es.close(); setRunning(false) })
    es.onerror = () => { es.close(); setRunning(false) }
  }

  async function runDecompose() {
    if (!goal.trim() || decomposing) return
    setDecomposing(true); resetOutput()
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
        await new Promise(r => setTimeout(r, 650))
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done' } : t))
      }
      setActiveTaskId(null)
      setFinalAnswer(`Plan ready with ${taskList.length} backend tasks. Use Run Agent with the same goal to execute it live.`)
    } catch (error) {
      setTasks([{ id: 1, task: `Plan failed: ${error.message}`, tool: 'search_spaces', status: 'pending' }])
    } finally {
      setDecomposing(false)
    }
  }

  function stop() {
    if (sourceRef.current) { sourceRef.current.close(); sourceRef.current = null }
    setRunning(false); setDecomposing(false)
  }

  const isRunning   = running || decomposing
  const hasOutput   = steps.length > 0 || tasks.length > 0
  const shareResult = mode === 'react' ? finalAnswer : (finalAnswer ? buildPlanResult() : null)
  const isReact     = mode === 'react'
  const borderColor = isReact ? 'rgba(59,130,246,0.22)' : 'rgba(139,92,246,0.22)'

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#0f1117]"
         style={{ border: `1px solid ${borderColor}` }}>
      <style>{ANIM_CSS}</style>

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pb-3 pt-4"
           style={{ borderBottom: `1px solid ${isReact ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)'}` }}>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all duration-500"
               style={{ background: isReact ? 'linear-gradient(135deg,#1d4ed8,#0891b2)' : 'linear-gradient(135deg,#7c3aed,#c2410c)' }}>
            {isReact ? '⚡' : '📐'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nova Agent Workspace</p>
            <p className="text-xs text-slate-600">Autonomous search, planning, pricing, and sharing</p>
          </div>
          <span className="ml-auto rounded-full border border-white/8 bg-white/5 px-2 py-1 text-xs text-slate-500">41 spaces · 13 areas</span>
        </div>

        {/* Mode tabs */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { setMode('react'); resetOutput() }}
                  className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-300 ${
                    isReact
                      ? 'border-blue-400/35 bg-blue-500/12 text-blue-200'
                      : 'border-white/8 bg-white/3 text-slate-500 hover:border-blue-400/18 hover:bg-blue-500/4'
                  }`}>
            {isReact && <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/8 to-transparent" />}
            <div className="relative mb-1 flex items-center gap-1.5">
              <span className="text-sm">⚡</span>
              <span className="text-sm font-semibold">Run Agent</span>
              {isReact && (
                <div className="ml-auto flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" style={{ animation: 'liveBlink 0.75s ease-in-out infinite' }} />
                  <span className="text-[10px] font-bold text-red-400" style={{ animation: 'liveBlink 0.75s ease-in-out infinite' }}>LIVE</span>
                </div>
              )}
            </div>
            <p className="relative text-xs leading-snug opacity-60">Searches, compares, calculates &amp; answers live</p>
          </button>

          <button type="button" onClick={() => { setMode('decompose'); resetOutput() }}
                  className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-300 ${
                    !isReact
                      ? 'border-purple-400/35 bg-purple-500/12 text-purple-200'
                      : 'border-white/8 bg-white/3 text-slate-500 hover:border-purple-400/18 hover:bg-purple-500/4'
                  }`}
                  style={!isReact ? { backgroundImage: BLUEPRINT_BG } : {}}>
            {!isReact && <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/8 to-transparent" />}
            <div className="relative mb-1 flex items-center gap-1.5">
              <span className="text-sm">📐</span>
              <span className="text-sm font-semibold">Goal Blueprint</span>
              {!isReact && (
                <div className="ml-auto">
                  <span className="rounded border border-amber-400/35 bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">PLAN</span>
                </div>
              )}
            </div>
            <p className="relative text-xs leading-snug opacity-60">Breaks your goal into a step-by-step task map</p>
          </button>
        </div>

        <div className="relative">
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); isReact ? runReact() : runDecompose() }
            }}
            placeholder={isReact
              ? 'Find the best conference room for 12 people in Bellandur under ₹2000/hr tomorrow afternoon'
              : 'Plan a team offsite for 25 people with search, comparison, availability, and final recommendation'}
            rows={3}
            disabled={isRunning}
            className="w-full resize-none rounded-xl border px-3 py-3 pr-28 text-sm text-white placeholder-slate-600 focus:outline-none disabled:opacity-50 bg-white/5 transition-colors duration-300"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          />
          <button type="button"
                  onClick={() => isReact ? runReact() : runDecompose()}
                  disabled={!goal.trim() || isRunning}
                  className={`absolute bottom-2 right-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    goal.trim() && !isRunning
                      ? isReact
                        ? 'bg-blue-500 text-white hover:bg-blue-400'
                        : 'bg-purple-500 text-white hover:bg-purple-400'
                      : 'cursor-not-allowed bg-white/5 text-slate-600'
                  }`}>
            {isRunning ? 'Working...' : isReact ? '⚡ Run' : '📐 Plan'}
          </button>
        </div>
      </div>

      {/* ── Output ── */}
      <div ref={outputRef} className="flex-1 overflow-y-auto px-4 py-3">

        {!hasOutput && !isRunning && isReact  && <AgentIdleScreen tools={tools} onPick={setGoal} />}
        {!hasOutput && !isRunning && !isReact && <PlanIdleScreen  tools={tools} onPick={setGoal} />}

        {(hasOutput || isRunning) && isReact  && <LiveStreamBoard steps={steps} running={running} finalAnswer={finalAnswer} />}
        {(hasOutput || isRunning) && !isReact && <BlueprintBoard  tasks={tasks} running={decomposing} finalAnswer={finalAnswer} />}

        {isRunning && steps.length === 0 && tasks.length === 0 && (
          <div className={`flex items-center gap-3 rounded-xl border px-3 py-4 ${
            isReact ? 'border-blue-500/20 bg-blue-500/8' : 'border-purple-500/20 bg-purple-500/8'
          }`}>
            <div className={`h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-t-transparent ${isReact ? 'border-blue-400' : 'border-purple-400'}`} />
            <div>
              <p className={`text-sm font-medium ${isReact ? 'text-blue-300' : 'text-purple-300'}`}>
                {isReact ? 'Launching agent...' : 'Starting planner...'}
              </p>
              <p className="text-xs text-slate-500">Connecting to Ollama and backend tools</p>
            </div>
          </div>
        )}

        {isReact && steps.map((step, i) => <StepCard key={`${step.type}-${i}`} step={step} index={i} />)}

        {!isReact && tasks.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400/70">Execution Blueprint</span>
              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">{tasks.length} steps</span>
            </div>
            <TaskTree tasks={tasks} activeId={activeTaskId} />
          </div>
        )}

        {running && steps.length > 0 && !finalAnswer && (
          <div className="flex items-center gap-2 px-1 py-2 text-xs text-blue-500/60">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <div key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            Nova is choosing the next tool...
          </div>
        )}

        {finalAnswer && !isReact && (
          <div className="mt-3 overflow-hidden rounded-xl border border-purple-500/30 bg-[#06030f]"
               style={{ backgroundImage: BLUEPRINT_BG }}>
            <div className="flex items-center gap-2 border-b border-purple-500/15 px-3 py-2">
              <span className="text-sm" style={{ animation: 'stampIn 0.5s ease-out' }}>📋</span>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300">Blueprint Complete</span>
            </div>
            <p className="whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-purple-200/80">{finalAnswer}</p>
          </div>
        )}

        {shareResult && <SharePanel goal={goal} result={shareResult} />}

        {isRunning && (
          <button type="button" onClick={stop}
                  className="mt-3 w-full rounded-xl border border-red-500/20 py-2 text-xs text-red-400 transition-all hover:bg-red-500/8">
            Stop
          </button>
        )}
      </div>

      {isReact && steps.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-4 px-4 py-2 text-xs text-slate-600"
             style={{ borderTop: '1px solid rgba(59,130,246,0.08)' }}>
          <span>{steps.filter(s => s.type === 'thought').length} thoughts</span>
          <span>{steps.filter(s => s.type === 'action').length} tools</span>
          <span>{steps.filter(s => s.type === 'observation').length} results</span>
          {finalAnswer && <span className="ml-auto text-emerald-500">Completed</span>}
        </div>
      )}
    </div>
  )
}
