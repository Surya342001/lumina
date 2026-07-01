import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, User, Zap, ChevronDown, ChevronUp, Sparkles, RefreshCw, CheckCircle, Calendar, MapPin, Clock, QrCode, X, Mic, MicOff, Search, Database, Cpu } from 'lucide-react'
import { streamChat, getSessionId } from '../api'

// ── AI NLP Helpers ────────────────────────────────────────────────────────────

/** Extracts structured entities from raw input text (location, space type, time, headcount, intent). */
function extractEntities(text) {
  if (!text.trim()) return []
  const t = text.toLowerCase()
  const found = []

  // Location detection
  const LOC_MAP = [
    ['koramangala', 'Koramangala'], ['whitefield', 'Whitefield'], ['itpl', 'Whitefield'],
    ['indiranagar', 'Indiranagar'], ['hsr layout', 'HSR Layout'], ['hsr', 'HSR Layout'],
    ['mg road', 'MG Road'],
  ]
  for (const [k, v] of LOC_MAP) {
    if (t.includes(k)) { found.push({ type: 'loc', label: v, icon: '📍', color: '#3B82F6' }); break }
  }

  // Space type detection
  const TYPE_MAP = [
    ['conference room','Conference Room'], ['meeting room','Meeting Room'],
    ['boardroom','Boardroom'], ['hot desk','Hot Desk'], ['private office','Private Office'],
    ['event space','Event Space'], ['sky deck','Sky Deck'], ['innovation hub','Innovation Hub'],
    ['training room','Training Room'], ['cowork','Co-working'], ['startup den','Startup Den'],
  ]
  for (const [k, v] of TYPE_MAP) {
    if (t.includes(k)) { found.push({ type: 'space', label: v, icon: '🏢', color: '#8B5CF6' }); break }
  }

  // Date/time detection
  if (t.includes('today')) found.push({ type: 'date', label: 'Today', icon: '📅', color: '#10B981' })
  else if (t.includes('tomorrow')) found.push({ type: 'date', label: 'Tomorrow', icon: '📅', color: '#10B981' })
  else {
    for (const d of ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) {
      if (t.includes(d)) { found.push({ type: 'date', label: d.charAt(0).toUpperCase()+d.slice(1), icon: '📅', color: '#10B981' }); break }
    }
  }
  const tm = t.match(/\b(\d{1,2})\s*(am|pm)\b/)
  if (tm) found.push({ type: 'clock', label: `${tm[1]}${tm[2].toUpperCase()}`, icon: '🕐', color: '#10B981' })

  // Headcount
  const pm = t.match(/(\d+)\s*(?:people|persons?|guests?|pax)\b/)
           || t.match(/team\s+of\s+(\d+)/)
           || t.match(/for\s+(\d+)\s*(?:people|persons?|pax)/)
  if (pm) found.push({ type: 'people', label: `${pm[1]} people`, icon: '👥', color: '#F59E0B' })

  // Booking intent
  if (/\bbook\b|\breserve\b/.test(t)) found.push({ type: 'intent', label: 'Book intent', icon: '✅', color: '#EF4444' })

  return found
}

/** Calculates 0-100 booking readiness score based on extracted entities. */
function calcIntentScore(entities) {
  const types = new Set(entities.map(e => e.type))
  let s = 0
  if (types.has('loc'))                       s += 25
  if (types.has('space'))                     s += 20
  if (types.has('date') || types.has('clock')) s += 20
  if (types.has('people'))                    s += 15
  if (types.has('intent'))                    s += 20
  return Math.min(s, 100)
}

/** Builds a preference profile from the conversation history (client-side personalization). */
function buildUserProfile(messages) {
  const locs = [], types = []
  let queryCount = 0
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.content && msg.id !== 1) {
      queryCount++
      for (const loc of ['Koramangala','Whitefield','Indiranagar','HSR Layout','MG Road']) {
        if (msg.content.toLowerCase().includes(loc.toLowerCase()) && !locs.includes(loc)) locs.push(loc)
      }
    }
    if (msg.role === 'user' && msg.content) {
      const c = msg.content.toLowerCase()
      const tm = [
        ['conference room','Conference Room'], ['meeting room','Meeting Room'],
        ['hot desk','Hot Desk'], ['event space','Event Space'], ['private office','Private Office'],
        ['cowork','Co-working'], ['training','Training Room'],
      ]
      for (const [k,v] of tm) { if (c.includes(k) && !types.includes(v)) { types.push(v); break } }
    }
  }
  return { locs, types, queryCount }
}

// ── Chain of Thought helpers ─────────────────────────────────────────────────

/** Build reasoning steps shown in the CoT panel for each AI response. */
function buildReasoning(snapshotEntities, meta) {
  const detected = snapshotEntities.length > 0
    ? snapshotEntities.map(e => `${e.icon} ${e.label}`).join(' · ')
    : 'General inquiry — no specific entities detected'
  const srcCount = meta.sources?.length || 0
  const spaceCount = meta.suggested_spaces?.length || 0
  let strategy = 'Direct conversational response'
  if (meta.booking_confirmed)   strategy = 'Booking confirmation flow completed ✓'
  else if (spaceCount > 0)      strategy = `Matched ${spaceCount} space${spaceCount !== 1 ? 's' : ''} → ranked by relevance & pricing`
  else if (srcCount > 0)        strategy = 'Retrieved context → synthesized answer with citations'
  return [
    { label: 'Entity Detection',    detail: detected },
    { label: 'Knowledge Retrieval', detail: srcCount > 0 ? `${srcCount} chunk${srcCount !== 1 ? 's' : ''} from RAG knowledge base` : 'Using conversational context' },
    { label: 'Response Strategy',   detail: strategy },
    { label: 'AI Engine',           detail: meta.mode === 'ollama' ? 'Ollama llama3 · LangChain RAG · ChromaDB' : meta.mode === 'openai' ? 'GPT-4 · LangChain RAG · ChromaDB' : 'Demo Mode' },
  ]
}

/** Context-aware predictive completions as user types. */
function getPredictiveCompletions(input, messages) {
  const t = input.toLowerCase().trim()
  if (t.length < 3) return []
  const lastBot = messages.filter(m => m.role === 'assistant' && m.content).slice(-1)[0]
  const botCtx  = (lastBot?.content || '').toLowerCase()
  const loc = ['Koramangala','Whitefield','Indiranagar','HSR Layout','MG Road']
    .find(l => botCtx.includes(l.toLowerCase()))
  if (/^book/.test(t)) return [
    loc ? `Book a conference room in ${loc} for tomorrow 3pm` : 'Book a conference room for 10 people',
    'Book a hot desk for today',
    loc ? `Book the Sprint Room in ${loc}` : 'Book Innovation Hub in Koramangala',
  ].filter(c => c.toLowerCase() !== t)
  if (/^conf|^meet/.test(t)) return [
    `Conference room for 12 people in ${loc || 'Koramangala'}`,
    'Conference room pricing and availability',
    'Meeting room with video conferencing',
  ]
  if (/^how much|^price|^cost|^rate/.test(t)) return [
    'How much is a hot desk per day',
    loc ? `How much for a conference room in ${loc}` : 'How much is Innovation Hub per hour',
    'What are the monthly membership plans',
  ]
  if (/^show|^what|^which/.test(t)) return [
    loc ? `Show all spaces in ${loc}` : 'Show all conference rooms in Koramangala',
    'What event spaces can fit 100 people',
    'Which space is cheapest for a team of 5',
  ]
  if (/^comp/.test(t)) return [
    'Compare Innovation Hub vs The Boardroom',
    'Compare hot desk vs private office pricing',
    'Compare Koramangala and Whitefield spaces',
  ]
  return []
}

// ── Chain of Thought Panel ────────────────────────────────────────────────────
function CoTPanel({ reasoning }) {
  const [open, setOpen] = useState(false)
  if (!reasoning?.length) return null
  return (
    <div style={{ marginTop: 6, marginLeft: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: open ? '#60A5FA' : '#4B5563', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span>💭</span>
        <span>{open ? 'Hide reasoning' : 'View reasoning'}</span>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reasoning.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#60A5FA', fontWeight: 700, marginTop: 1 }}>
                {i + 1}
              </span>
              <div>
                <span style={{ color: '#6B7280', fontWeight: 600 }}>{step.label}:</span>
                <span style={{ color: '#4B5563', marginLeft: 4 }}>{step.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AI Session Analytics Panel ────────────────────────────────────────────────
function AIInsightsPanel({ messages }) {
  const stats = useMemo(() => {
    const botMsgs    = messages.filter(m => m.role === 'assistant' && m.id !== 1)
    const userMsgs   = messages.filter(m => m.role === 'user')
    const sourcesUsed = botMsgs.reduce((acc, m) => acc + (m.sources?.length || 0), 0)
    const topics = { Booking: 0, Exploring: 0, Pricing: 0, Amenities: 0 }
    for (const m of userMsgs) {
      const c = m.content.toLowerCase()
      if (/book|reserve/.test(c))                             topics.Booking++
      else if (/price|cost|rate|how much|cheap/.test(c))     topics.Pricing++
      else if (/amenities|wifi|parking|facilities|coffee/.test(c)) topics.Amenities++
      else                                                   topics.Exploring++
    }
    return { botCount: botMsgs.length, userCount: userMsgs.length, sourcesUsed, topics }
  }, [messages])

  const COLORS = { Booking: '#10B981', Exploring: '#3B82F6', Pricing: '#F59E0B', Amenities: '#8B5CF6' }
  const total  = stats.userCount || 1

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.18)', animation: 'slideDown 0.22s ease-out' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', marginBottom: 10 }}>📊 AI Session Analytics</div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[['Queries', stats.userCount], ['Responses', stats.botCount], ['Sources', stats.sourcesUsed]].map(([label, value]) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#E5E7EB' }}>{value}</div>
            <div style={{ fontSize: 9, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          </div>
        ))}
      </div>
      {/* Intent distribution */}
      {stats.userCount > 0 ? (
        <div>
          <div style={{ fontSize: 10, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Query Distribution</div>
          {Object.entries(stats.topics).filter(([,v]) => v > 0).map(([topic, count]) => (
            <div key={topic} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: '#9CA3AF' }}>{topic}</span>
                <span style={{ color: '#6B7280' }}>{Math.round(count/total*100)}%</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${count/total*100}%`, height: '100%', background: COLORS[topic], borderRadius: 2, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 11, color: '#374151', padding: '4px 0' }}>Start chatting to see analytics</div>
      )}
    </div>
  )
}

let bookingAudioContext = null

function getBookingAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!bookingAudioContext || bookingAudioContext.state === 'closed') {
    bookingAudioContext = new AudioCtx()
  }
  return bookingAudioContext
}

function primeBookingSuccessSound() {
  try {
    const ctx = getBookingAudioContext()
    if (!ctx) return
    ctx.resume?.()
  } catch {
    // Audio unlock is best-effort.
  }
}

function playBookingSuccessSound() {
  try {
    const ctx = getBookingAudioContext()
    if (!ctx) return
    ctx.resume?.()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.95)
    master.connect(ctx.destination)

    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + index * 0.09
      osc.type = index === notes.length - 1 ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
      osc.connect(gain)
      gain.connect(master)
      osc.start(start)
      osc.stop(start + 0.32)
    })
  } catch {
    // Browsers can block audio in some cases; the visual receipt still appears.
  }
}

// ── Booking Success Modal ─────────────────────────────────────────────────────
function BookingSuccessModal({ details, onClose }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    playBookingSuccessSound()
    const t = setTimeout(() => setShow(true), 30)
    return () => clearTimeout(t)
  }, [])

  const close = () => { setShow(false); setTimeout(onClose, 320) }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: show ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.3s ease',
      }}
    >
      <style>{`
        @keyframes slideUp {
          0%   { transform: translateY(40px) scale(0.97); opacity: 0; }
          100% { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes checkDraw {
          0%   { stroke-dashoffset: 100; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes receiptGlow {
          0%, 100% { box-shadow: 0 0 28px rgba(16,185,129,0.16); }
          50% { box-shadow: 0 0 46px rgba(16,185,129,0.34); }
        }
      `}</style>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400, margin: '0 16px',
        animation: show ? 'slideUp 0.36s cubic-bezier(0.22,1,0.36,1) forwards' : 'none',
        opacity: 0,
      }}>
        <div style={{
          background: '#0D1117',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(16,185,129,0.08)',
          overflow: 'hidden',
          animation: show ? 'receiptGlow 1.6s ease-in-out infinite' : 'none',
        }}>
          {/* Green top accent */}
          <div style={{ height: 3, background: 'linear-gradient(90deg,#10B981,#34D399,#6EE7B7)' }} />

          {/* Header */}
          <div style={{ padding: '28px 24px 18px', textAlign: 'center', position: 'relative' }}>
            {/* Close */}
            <button onClick={close} style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '5px 7px',
              cursor: 'pointer', color: '#6B7280',
              display: 'flex', alignItems: 'center', lineHeight: 1,
            }}>
              <X size={13} />
            </button>

            {/* Animated checkmark */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(16,185,129,0.1)',
              border: '1.5px solid rgba(16,185,129,0.4)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M9 19 L15.5 25.5 L27 12" stroke="#10B981" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="100" strokeDashoffset="100"
                  style={{ animation: show ? 'checkDraw 0.5s 0.2s ease-out forwards' : 'none' }} />
              </svg>
            </div>

            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              Booking Confirmed Successfully
            </div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Your workspace is reserved and receipt is ready</div>
            <div style={{
              marginTop: 12, display: 'inline-block',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.22)',
              borderRadius: 20, padding: '4px 14px',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#34D399', letterSpacing: '0.1em' }}>
                {details.booking_id}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 20px' }} />

          {/* Details grid */}
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Guest',    value: details.name,       emoji: '👤' },
              { label: 'Space',    value: details.space_name, emoji: '🏢' },
              { label: 'Location', value: details.location,   emoji: '📍' },
              { label: 'Date',     value: details.date,       emoji: '📅' },
              { label: 'Time',     value: details.time,       emoji: '🕐' },
              { label: 'Rate',     value: details.price,      emoji: '💳', accent: true },
            ].map(({ label, value, emoji, accent }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '9px 12px',
              }}>
                <div style={{ fontSize: 10, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{emoji} {label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: accent ? '#34D399' : '#E5E7EB' }}>{value || '—'}</div>
              </div>
            ))}
          </div>

          <div style={{
            margin: '0 20px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rate</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#E5E7EB' }}>{details.price || 'Confirmed'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#34D399' }}>CONFIRMED</div>
            </div>
          </div>

          {/* Email badge */}
          {details.email && (
            <div style={{
              margin: '0 20px 14px',
              background: details.email_sent === false ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.06)',
              border: details.email_sent === false ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(16,185,129,0.2)',
              borderRadius: 12, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>📧</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: details.email_sent === false ? '#FBBF24' : '#6EE7B7' }}>
                  {details.email_sent === false ? 'Email delivery needs SMTP config' : 'Confirmation email sent!'}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{details.email}</div>
              </div>
            </div>
          )}

          {!details.email && (
            <div style={{
              margin: '0 20px 14px',
              background: 'rgba(59,130,246,0.07)',
              border: '1px solid rgba(59,130,246,0.18)',
              borderRadius: 12, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>ℹ️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#93C5FD' }}>Email was skipped</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>Add an email during booking to receive the confirmation note.</div>
              </div>
            </div>
          )}

          {/* Footer strip */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 20px', textAlign: 'center',
            fontSize: 11, color: '#4B5563',
          }}>
            Show booking ID at Aurbis reception for instant access
          </div>
        </div>
      </div>
    </div>
  )
}

const SUGGESTED = [
  'Conference room for 12 people in Koramangala',
  'Cheapest event space for 100 guests',
  'Book Sprint Room Whitefield for Friday 2pm',
  'What amenities are included?',
  'Hot desk pricing options',
  'Show all spaces with video conferencing',
]

function BookingConfirmCard({ details }) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0) // 0=processing, 1=confirmed

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 80)
    const t2 = setTimeout(() => setStep(1), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className={`mt-2 transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      {step === 0 ? (
        /* Processing state */
        <div className="bg-aurbis-dark-3 border border-aurbis-blue/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-aurbis-blue border-t-transparent animate-spin flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-medium">Processing your booking…</p>
            <p className="text-slate-500 text-xs">Reserving your space at Aurbis</p>
          </div>
        </div>
      ) : (
        /* Confirmed state */
        <div className="bg-gradient-to-br from-teal-950/60 to-aurbis-dark-3 border border-teal-500/40 rounded-2xl overflow-hidden">
          {/* Header bar */}
          <div className="bg-teal-500/15 px-4 py-3 flex items-center gap-2.5 border-b border-teal-500/20">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={16} className="text-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-teal-300 font-semibold text-sm">Booking Confirmed!</p>
              <p className="text-teal-600 text-xs font-mono">{details.booking_id}</p>
            </div>
          </div>

          {/* Details grid */}
          <div className="p-4 grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-slate-500 text-xs mb-0.5">Guest Name</p>
              <p className="text-white font-semibold text-sm">{details.name}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-slate-500 text-xs mb-0.5">Space</p>
              <p className="text-white font-semibold text-sm">{details.space_name}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 flex items-start gap-2">
              <MapPin size={12} className="text-aurbis-coral mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Location</p>
                <p className="text-white text-sm font-medium">{details.location}</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 flex items-start gap-2">
              <Clock size={12} className="text-aurbis-teal-light mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Date & Time</p>
                <p className="text-white text-sm font-medium">{details.date} · {details.time}</p>
              </div>
            </div>
          </div>

          {/* QR / access section */}
          <div className="mx-4 mb-4 bg-white/5 border border-white/8 rounded-xl p-3 flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <QrCode size={22} className="text-slate-300" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold">QR Access Pass</p>
              <p className="text-slate-400 text-xs">
                {details.email && details.email_sent !== false
                  ? 'Sent to your email · Show at Aurbis entrance'
                  : 'Generated in chat · Show at Aurbis entrance'}
              </p>
            </div>
            <div className="ml-auto text-right flex-shrink-0">
              <p className="text-teal-400 text-xs font-semibold">{details.price}</p>
              <p className="text-slate-600 text-xs">per hour</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const STAGE_ICONS = { searching: Search, retrieving: Database, generating: Cpu }
const STAGE_COLORS = {
  searching:  'text-blue-400',
  retrieving: 'text-teal-400',
  generating: 'text-orange-400',
}

function RagPipeline({ stages, streaming }) {
  if (!stages || stages.length === 0) return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0,1,2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400/60"
          style={{ animation: `typing 1.2s ease-in-out ${i*0.2}s infinite` }} />
      ))}
    </div>
  )
  return (
    <div className="px-3 py-2.5 space-y-1.5">
      {stages.map((s, i) => {
        const Icon = STAGE_ICONS[s.stage] || Zap
        const isLast = i === stages.length - 1
        return (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-300
            ${isLast && streaming ? STAGE_COLORS[s.stage] : 'text-slate-500'}`}>
            <Icon size={11} className={isLast && streaming ? '' : 'opacity-50'} />
            <span>{s.label}</span>
            {isLast && streaming && (
              <span className="inline-flex gap-0.5 ml-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1 h-1 rounded-full bg-current"
                    style={{ animation: `typing 0.9s ease-in-out ${i*0.15}s infinite` }} />
                ))}
              </span>
            )}
            {!streaming && <span className="ml-0.5 opacity-40">✓</span>}
          </div>
        )
      })}
    </div>
  )
}

function SourceBadge({ source }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-full">
      <Zap size={9} className="text-aurbis-teal-light" />
      {source}
    </span>
  )
}

function Message({ msg }) {
  const [showSources, setShowSources] = useState(false)
  const isUser = msg.role === 'user'
  const isStreaming = msg.streaming === true

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
        ${isUser ? 'bg-aurbis-coral/20 border border-aurbis-coral/30 text-aurbis-coral' : 'bg-aurbis-blue/20 border border-aurbis-blue/30 text-aurbis-blue-light'}`}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        <div className={`rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-aurbis-blue rounded-tr-sm text-white px-4 py-3'
            : 'bg-aurbis-dark-3 border border-white/8 rounded-tl-sm overflow-hidden'}`}>
          {isUser ? (
            <p className="text-white">{msg.content}</p>
          ) : (
            <>
              {/* RAG pipeline stages (shown while streaming or when no content yet) */}
              {!isUser && (isStreaming || msg.ragStages?.length > 0) && (
                <RagPipeline stages={msg.ragStages || []} streaming={isStreaming && !msg.content} />
              )}

              {/* Streamed / final content */}
              {msg.content ? (
                <div className="chat-prose px-4 pb-3 pt-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  {isStreaming && (
                    <span className="inline-block w-0.5 h-[1em] bg-blue-400 align-middle ml-0.5"
                      style={{ animation: 'typing 0.8s ease-in-out infinite' }} />
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Booking confirmation card */}
        {!isUser && msg.booking_confirmed && msg.booking_details && (
          <div className="w-full">
            <BookingConfirmCard details={msg.booking_details} />
          </div>
        )}

        {/* Sources */}
        {!isUser && !isStreaming && msg.sources && msg.sources.length > 0 && (
          <div className="ml-1">
            <button
              onClick={() => setShowSources(v => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Zap size={10} />
              {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} used
              {showSources ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showSources && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {msg.sources.map((s, i) => <SourceBadge key={i} source={s} />)}
              </div>
            )}
          </div>
        )}

        {/* Mode badge */}
        {!isUser && !isStreaming && msg.mode && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ml-1
            ${msg.mode === 'demo'
              ? 'bg-purple-900/30 border-purple-700/40 text-purple-400'
              : 'bg-teal-900/30 border-teal-700/40 text-teal-400'}`}>
            {msg.mode === 'openai' ? '⚡ GPT-4 RAG'
              : msg.mode === 'ollama' ? '🦙 Ollama RAG'
              : '🤖 Demo Mode'}
          </span>
        )}

        {/* Chain of Thought — expandable reasoning panel */}
        {!isUser && !isStreaming && msg.reasoning && (
          <CoTPanel reasoning={msg.reasoning} />
        )}
      </div>
    </div>
  )
}

// ── Context-aware suggestion generator ───────────────────────────────────────
function getSmartSuggestions(messages) {
  const last = messages.filter(m => m.role === 'assistant').slice(-1)[0]
  if (!last || !last.content) return SUGGESTED

  const c = last.content.toLowerCase()

  if (last.booking_confirmed) return [
    'Book another space',
    'Same booking but in Whitefield',
    'Show all Koramangala spaces',
  ]
  if (c.includes('koramangala')) return [
    'Book Innovation Hub for tomorrow 3pm',
    'Cheapest space in Koramangala',
    'Conference room for 15 people there',
  ]
  if (c.includes('whitefield') || c.includes('itpl')) return [
    'Book Sprint Room for Friday 2pm',
    'Show event spaces in Whitefield',
    'Private office in Whitefield',
  ]
  if (c.includes('indiranagar')) return [
    'Conference room in Indiranagar',
    'Hot desk options in Indiranagar',
    'What amenities in Indiranagar?',
  ]
  if (c.includes('event') || c.includes('150') || c.includes('300')) return [
    'Book Sky Deck for next Friday',
    'Compare event venues pricing',
    'Any event space under ₹20,000/hr?',
  ]
  if (c.includes('conference') || c.includes('meeting')) return [
    'Book a conference room now',
    'Conference room for 20 people',
    'Show meeting rooms in Whitefield',
  ]
  if (c.includes('₹') || c.includes('price') || c.includes('cost')) return [
    'Cheapest space available',
    'Monthly membership plans',
    'Best value for 10 people?',
  ]
  return SUGGESTED
}

export default function ChatWidget({ onSpacesHighlight }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: "👋 Hi! I'm **Nova**, your Aurbis AI Workspace Assistant.\n\nI can help you **find**, **compare**, and **book** premium workspaces across 5 Bangalore locations.\n\nWhat are you looking for today?",
      sources: [],
      mode: 'ollama'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [celebrationDetails, setCelebrationDetails] = useState(null)
  // AI features state
  const [entities, setEntities] = useState([])
  const [intentScore, setIntentScore] = useState(0)
  const [completions, setCompletions] = useState([])
  const [showInsights, setShowInsights] = useState(false)
  const messagesContainerRef = useRef(null)
  const inputRef = useRef(null)
  const streamCleanupRef = useRef(null)

  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  // Cleanup stream on unmount
  useEffect(() => () => streamCleanupRef.current?.(), [])

  // Live NLP entity extraction — debounced 180ms
  useEffect(() => {
    const t = setTimeout(() => {
      const e = extractEntities(input)
      setEntities(e)
      setIntentScore(calcIntentScore(e))
    }, 180)
    return () => clearTimeout(t)
  }, [input])

  // Predictive autocomplete — debounced 260ms
  useEffect(() => {
    const t = setTimeout(() => {
      setCompletions(getPredictiveCompletions(input, messages))
    }, 260)
    return () => clearTimeout(t)
  }, [input, messages])

  const send = useCallback((text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    primeBookingSuccessSound()

    const snapshotEntities = [...entities]   // capture NLP entities at send time for CoT
    setInput('')
    setCompletions([])
    const asstId = Date.now() + 1
    setMessages(prev => [
      ...prev,
      { id: Date.now(), role: 'user', content: msg },
      { id: asstId, role: 'assistant', content: '', streaming: true, ragStages: [], sources: [], mode: 'ollama' }
    ])
    setLoading(true)

    const cleanup = streamChat(msg, {
      onStage: stage => {
        setMessages(prev => prev.map(m =>
          m.id === asstId ? { ...m, ragStages: [...(m.ragStages || []), stage] } : m
        ))
      },
      onToken: token => {
        setMessages(prev => prev.map(m =>
          m.id === asstId ? { ...m, content: m.content + token } : m
        ))
      },
      onDone: meta => {
        const reasoning = buildReasoning(snapshotEntities, meta)
        setMessages(prev => prev.map(m =>
          m.id === asstId ? { ...m, streaming: false, reasoning, ...meta } : m
        ))
        if (meta.booking_confirmed && meta.booking_details) {
          setCelebrationDetails(meta.booking_details)
        }
        if (meta.suggested_spaces?.length && onSpacesHighlight) {
          onSpacesHighlight(meta.suggested_spaces)
        }
        setLoading(false)
        inputRef.current?.focus()
      },
      onError: () => {
        setMessages(prev => prev.map(m =>
          m.id === asstId
            ? { ...m, content: "Sorry, something went wrong. Please try again!", streaming: false }
            : m
        ))
        setLoading(false)
        inputRef.current?.focus()
      }
    })
    streamCleanupRef.current = cleanup
  }, [input, loading, onSpacesHighlight])

  // Voice input via Web Speech API
  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported in this browser. Try Chrome.'); return }

    if (voiceActive) { setVoiceActive(false); return }

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-IN'

    setVoiceActive(true)
    rec.start()

    rec.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      setInput(transcript)
      if (e.results[0].isFinal) {
        setVoiceActive(false)
        // Auto-send on final result
        setTimeout(() => {
          const finalText = transcript.trim()
          if (finalText) send(finalText)
        }, 200)
      }
    }
    rec.onend = () => setVoiceActive(false)
    rec.onerror = () => setVoiceActive(false)
  }, [voiceActive, send])

  const reset = () => {
    streamCleanupRef.current?.()
    setLoading(false)
    setMessages([{
      id: 1, role: 'assistant',
      content: "👋 Hi! I'm **Nova**, your Aurbis AI Workspace Assistant.\n\nI can help you **find**, **compare**, and **book** premium workspaces across 5 Bangalore locations.\n\nWhat are you looking for today?",
      sources: [], mode: 'ollama'
    }])
    if (onSpacesHighlight) onSpacesHighlight([])
  }

  const suggestions = getSmartSuggestions(messages)
  const userProfile = buildUserProfile(messages)

  return (
    <>
    <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-gradient-to-r from-aurbis-blue/10 to-aurbis-teal/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-gradient flex items-center justify-center shadow-glow-blue">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Nova</p>
            <p className="text-aurbis-teal-light text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-aurbis-teal-light inline-block" />
              AI Workspace Assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowInsights(v => !v)}
            title="AI Session Analytics"
            className={`p-2 rounded-lg transition-colors text-sm ${showInsights ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/8 text-slate-500 hover:text-slate-300'}`}
          >
            📊
          </button>
          <button onClick={reset} className="p-2 rounded-lg hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-colors" title="Reset conversation">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* AI Session Analytics Dashboard */}
      {showInsights && <AIInsightsPanel messages={messages} />}

      {/* AI Persona Memory — "Nova knows you" bar */}
      {userProfile.queryCount >= 2 && (userProfile.locs.length > 0 || userProfile.types.length > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '6px 14px',
          background: 'rgba(59,130,246,0.06)',
          borderBottom: '1px solid rgba(59,130,246,0.12)',
          fontSize: 11,
        }}>
          <span style={{ color: '#60A5FA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            🧠 Nova knows you:
          </span>
          {userProfile.locs.map(l => (
            <span key={l} style={{
              background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.28)',
              borderRadius: 20, padding: '1px 8px', color: '#93C5FD',
            }}>📍 {l}</span>
          ))}
          {userProfile.types.map(t => (
            <span key={t} style={{
              background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.28)',
              borderRadius: 20, padding: '1px 8px', color: '#C4B5FD',
            }}>🏢 {t}</span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
      </div>

      {/* Context-aware suggestions */}
      <div className="px-4 pb-2 overflow-x-auto">
        <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
          {suggestions.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              className="flex-shrink-0 text-xs bg-white/5 hover:bg-aurbis-blue/20 border border-white/10 hover:border-aurbis-blue/40 text-slate-400 hover:text-white px-3 py-1.5 rounded-full transition-all disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-4">

        {/* Predictive autocomplete chips */}
        {completions.length > 0 && !loading && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#374151' }}>💡</span>
            {completions.map((c, i) => (
              <button
                key={i}
                onClick={() => { setInput(c); setCompletions([]); inputRef.current?.focus() }}
                style={{ fontSize: 11, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 14, padding: '2px 10px', color: '#93C5FD', cursor: 'pointer' }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Intent confidence bar */}
        {intentScore > 0 && (
          <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1, marginBottom: 7, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${intentScore}%`,
              background: intentScore >= 80
                ? 'linear-gradient(90deg,#10B981,#34D399)'
                : intentScore >= 50
                  ? 'linear-gradient(90deg,#3B82F6,#60A5FA)'
                  : 'linear-gradient(90deg,#6B7280,#9CA3AF)',
              transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1), background 0.3s',
              borderRadius: 1,
            }} />
          </div>
        )}

        {/* NLP entity chips — shown as the AI "understands" what user is typing */}
        {entities.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            {entities.map((e, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: `${e.color}16`, border: `1px solid ${e.color}38`,
                borderRadius: 20, padding: '2px 9px', fontSize: 10.5, color: '#D1D5DB',
                animation: 'fadeChip 0.18s ease-out',
              }}>
                {e.icon} {e.label}
              </span>
            ))}
            <span style={{ fontSize: 9.5, color: '#374151', marginLeft: 2 }}>NLP extracted</span>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder={voiceActive ? '🎙️ Listening...' : 'Ask Nova anything about Aurbis workspaces...'}
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/12 hover:border-white/20 focus:border-aurbis-blue/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none outline-none transition-colors disabled:opacity-50"
            style={{ maxHeight: '120px', overflowY: 'auto', lineHeight: '1.5' }}
          />

          {/* Voice button */}
          <button
            onClick={toggleVoice}
            disabled={loading}
            title={voiceActive ? 'Stop listening' : 'Voice input'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0
              ${voiceActive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white/8 hover:bg-white/14 text-slate-400 hover:text-white border border-white/10'}`}
            style={voiceActive ? { animation: 'micPulse 1s ease-in-out infinite' } : {}}
          >
            {voiceActive ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Send button */}
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-aurbis-blue hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-2 text-center">
          Powered by LangChain RAG · Enter to send · 🎙️ Voice input supported
        </p>
      </div>
    </div>

    {/* Celebration Modal */}
    {celebrationDetails && (
      <BookingSuccessModal
        details={celebrationDetails}
        onClose={() => setCelebrationDetails(null)}
      />
    )}
    </>
  )
}
