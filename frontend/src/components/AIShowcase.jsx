import React, { useState, useEffect, useRef } from 'react'

// ── Animated typing hook ─────────────────────────────────────────────────────
function useTyping(lines, speed = 38, pause = 1200) {
  const [idx, setIdx] = useState(0)
  const [displayed, setDisplayed] = useState([])
  const [cur, setCur] = useState('')
  const charRef = useRef(0)

  useEffect(() => {
    if (idx >= lines.length) return
    const full = lines[idx]
    if (charRef.current < full.length) {
      const t = setTimeout(() => {
        charRef.current++
        setCur(full.slice(0, charRef.current))
      }, speed)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setDisplayed(p => [...p, full])
        setCur('')
        charRef.current = 0
        setIdx(p => p + 1)
      }, pause)
      return () => clearTimeout(t)
    }
  }, [idx, cur, lines, speed, pause])

  return { displayed, cur }
}

// ── RAG Pipeline Card ────────────────────────────────────────────────────────
const RAG_STEPS = [
  { icon: '💬', label: 'User Query',       desc: '"Find a 10-person room in Koramangala"',         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  { icon: '🔢', label: 'Embed',            desc: 'Query → 1536-dim vector',                        color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  { icon: '🗄️', label: 'ChromaDB Search', desc: 'Top-3 similar docs retrieved',                   color: '#14b8a6', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.3)' },
  { icon: '📄', label: 'Context Inject',   desc: 'Docs + history → LLM prompt',                   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)'  },
  { icon: '✅', label: 'LLM Answer',       desc: 'Grounded, accurate response streamed',           color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)'  },
]

function RagCard({ onTry }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % RAG_STEPS.length), 900)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={{ ...styles.iconBadge, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)' }}>
          🧠
        </div>
        <div>
          <div style={styles.cardTitle}>RAG Pipeline</div>
          <div style={styles.cardSub}>Retrieval-Augmented Generation</div>
        </div>
        <span style={{ ...styles.badge, background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
          LIVE IN CHAT
        </span>
      </div>

      <p style={styles.desc}>
        Nova never guesses. Every response is grounded in real Aurbis data retrieved from a ChromaDB vector store before the LLM generates the answer.
      </p>

      {/* Pipeline flow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0', flexWrap: 'wrap' }}>
        {RAG_STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{
              ...styles.pipeStep,
              background: active === i ? s.bg : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active === i ? s.border : 'rgba(255,255,255,0.06)'}`,
              transform: active === i ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.3s ease',
            }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: active === i ? s.color : '#475569', marginTop: 3 }}>{s.label}</span>
            </div>
            {i < RAG_STEPS.length - 1 && (
              <span style={{ color: active > i ? '#22d3ee' : '#1f2937', fontSize: 14, transition: 'color 0.3s', fontWeight: 700 }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Active step description */}
      <div style={{ ...styles.stepDesc, borderColor: RAG_STEPS[active].border }}>
        <span style={{ color: RAG_STEPS[active].color, fontSize: 13 }}>{RAG_STEPS[active].icon}</span>
        <span style={{ color: '#cbd5e1', fontSize: 12 }}>{RAG_STEPS[active].desc}</span>
      </div>

      {/* Tech pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
        {['LangChain', 'ChromaDB', 'Ollama / GPT-4o-mini', 'SSE Streaming'].map(t => (
          <span key={t} style={styles.techPill}>{t}</span>
        ))}
      </div>

      <button onClick={onTry} style={{ ...styles.tryBtn, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd' }}>
        💬 Try in Chat Mode →
      </button>
    </div>
  )
}

// ── ReAct Agent Card ─────────────────────────────────────────────────────────
const REACT_LINES = [
  'Thought: I need to search for spaces in Bellandur.',
  'Action: search_spaces(location="Bellandur", capacity=25)',
  'Observe: Found BEL-002 (₹1,800/hr, 25 pax, lake view)',
  'Thought: I should verify the price for 3 hours.',
  'Action: calculate_price(space_id="BEL-002", hours=3)',
  'Observe: ₹1,800 × 3 = ₹5,400 total',
  'Final Answer: Best option is Lake View Suite...',
]

const STEP_COLORS = {
  'Thought:':      '#93c5fd',
  'Action:':       '#fcd34d',
  'Observe:':      '#6ee7b7',
  'Final Answer:': '#5eead4',
}

function AgentCard({ onTry }) {
  const { displayed, cur } = useTyping(REACT_LINES, 22, 600)
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [displayed, cur])

  const colorLine = (line) => {
    for (const [prefix, color] of Object.entries(STEP_COLORS)) {
      if (line.startsWith(prefix)) {
        return (
          <span>
            <span style={{ color, fontWeight: 700 }}>{prefix}</span>
            <span style={{ color: '#94a3b8' }}>{line.slice(prefix.length)}</span>
          </span>
        )
      }
    }
    return <span style={{ color: '#94a3b8' }}>{line}</span>
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={{ ...styles.iconBadge, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)' }}>
          ⚡
        </div>
        <div>
          <div style={styles.cardTitle}>ReAct Agent</div>
          <div style={styles.cardSub}>Reason → Act → Observe → Repeat</div>
        </div>
        <span style={{ ...styles.badge, background: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }}>
          AGENT MODE
        </span>
      </div>

      <p style={styles.desc}>
        An autonomous AI that reasons step-by-step, calls real tools (search, price, compare, availability), observes results, and iterates — just like a human assistant thinking out loud.
      </p>

      {/* Live terminal */}
      <div ref={ref} style={styles.terminal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ marginLeft: 6, fontSize: 10, color: '#374151', fontFamily: 'monospace' }}>nova_agent · live</span>
          <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'blink 0.75s ease-in-out infinite' }} />
        </div>
        {displayed.map((line, i) => (
          <div key={i} style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, marginBottom: 2 }}>
            {colorLine(line)}
          </div>
        ))}
        {cur && (
          <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
            {colorLine(cur)}<span style={{ animation: 'blink 0.75s ease-in-out infinite', color: '#22d3ee' }}>█</span>
          </div>
        )}
      </div>

      {/* Tool chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {[
          { icon: '🔍', label: 'search_spaces' },
          { icon: '💰', label: 'calculate_price' },
          { icon: '⚖️', label: 'compare_spaces' },
          { icon: '📅', label: 'check_availability' },
          { icon: '📋', label: 'get_space_details' },
        ].map(t => (
          <span key={t.label} style={{ ...styles.techPill, color: '#fcd34d', borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.06)' }}>
            {t.icon} {t.label}
          </span>
        ))}
      </div>

      <button onClick={onTry} style={{ ...styles.tryBtn, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d' }}>
        ⚡ Try in Agent Mode →
      </button>
    </div>
  )
}

// ── Semantic Search Card ─────────────────────────────────────────────────────
const SEARCH_EXAMPLES = [
  { query: 'quiet place for deep work', concepts: ['quiet', 'focus', 'private'], spaces: ['Focus Pod', 'The Vault', 'Serenity Suite'] },
  { query: 'luxury client meeting room', concepts: ['luxury', 'meeting', 'video'], spaces: ['The Boardroom', 'Executive Suite', 'Think Tank'] },
  { query: 'affordable startup hub',    concepts: ['cheap', 'startup', 'networking'], spaces: ['Startup Den', 'Open Canvas', 'Creative Studio'] },
  { query: 'large tech team training',  concepts: ['large', 'training', 'tech'], spaces: ['Tech Hub', 'Innovation Lab', 'Collaboration Zone'] },
]

function SemanticCard({ onTry }) {
  const [ex, setEx] = useState(0)
  const [phase, setPhase] = useState(0) // 0=query, 1=concepts, 2=spaces

  useEffect(() => {
    setPhase(0)
    const t1 = setTimeout(() => setPhase(1), 600)
    const t2 = setTimeout(() => setPhase(2), 1300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [ex])

  useEffect(() => {
    const t = setInterval(() => setEx(p => (p + 1) % SEARCH_EXAMPLES.length), 3000)
    return () => clearInterval(t)
  }, [])

  const cur = SEARCH_EXAMPLES[ex]

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={{ ...styles.iconBadge, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)' }}>
          🔍
        </div>
        <div>
          <div style={styles.cardTitle}>Semantic Search</div>
          <div style={styles.cardSub}>Natural language → concepts → results</div>
        </div>
        <span style={{ ...styles.badge, background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
          SPACE EXPLORER
        </span>
      </div>

      <p style={styles.desc}>
        Type how you <em>feel</em> about a space, not what it's called. The AI maps your words to workspace concepts and surfaces the most relevant results — no keywords needed.
      </p>

      {/* Live demo flow */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)', marginTop: 12 }}>
        {/* Query */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>You type:</div>
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 13, color: '#d1fae5' }}>
            "{cur.query}"
          </div>
        </div>

        {/* Arrow */}
        <div style={{ textAlign: 'center', color: '#1f2937', fontSize: 18, marginBottom: 10 }}>↓</div>

        {/* Concept expansion */}
        <div style={{ marginBottom: 12, opacity: phase >= 1 ? 1 : 0, transition: 'opacity 0.4s ease', transform: phase >= 1 ? 'translateY(0)' : 'translateY(6px)' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>AI expands to concepts:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {cur.concepts.map(c => (
              <span key={c} style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                ✦ {c}
              </span>
            ))}
            <span style={{ color: '#374151', fontSize: 11, alignSelf: 'center' }}>+ 8 related terms...</span>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ textAlign: 'center', color: '#1f2937', fontSize: 18, marginBottom: 10, opacity: phase >= 1 ? 1 : 0, transition: 'opacity 0.4s 0.2s' }}>↓</div>

        {/* Results */}
        <div style={{ opacity: phase >= 2 ? 1 : 0, transition: 'opacity 0.4s ease', transform: phase >= 2 ? 'translateY(0)' : 'translateY(6px)' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Top matches:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {cur.spaces.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 7, padding: '6px 10px' }}>
                <span style={{ color: '#10b981', fontWeight: 800, fontSize: 11, width: 16 }}>#{i + 1}</span>
                <span style={{ color: '#d1fae5', fontSize: 12, fontWeight: 500 }}>{s}</span>
                <div style={{ marginLeft: 'auto', height: 4, width: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#10b981', width: `${90 - i * 15}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Example switcher dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14 }}>
        {SEARCH_EXAMPLES.map((_, i) => (
          <button key={i} onClick={() => setEx(i)} style={{ width: i === ex ? 20 : 6, height: 6, borderRadius: 3, background: i === ex ? '#10b981' : '#1f2937', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }} />
        ))}
      </div>

      <button onClick={onTry} style={{ ...styles.tryBtn, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
        🔍 Try Semantic Search →
      </button>
    </div>
  )
}

// ── Self-Healing RAG Card ─────────────────────────────────────────────────────
function SelfHealCard() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep(p => (p + 1) % 4), 1400)
    return () => clearInterval(t)
  }, [])

  const HEAL_STEPS = [
    { icon: '💬', label: 'Original query sent to RAG', color: '#3b82f6' },
    { icon: '⚠️', label: 'Low confidence detected: "I\'m not sure..."', color: '#f59e0b' },
    { icon: '🔄', label: 'LLM auto-reformulates the query', color: '#8b5cf6' },
    { icon: '✅', label: 'Retry with improved query → better answer', color: '#10b981' },
  ]

  return (
    <div style={{ ...styles.card, background: 'rgba(8,8,20,0.6)' }}>
      <div style={styles.cardHeader}>
        <div style={{ ...styles.iconBadge, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}>
          🛡️
        </div>
        <div>
          <div style={styles.cardTitle}>Self-Healing RAG</div>
          <div style={styles.cardSub}>Auto-detects and fixes bad answers</div>
        </div>
        <span style={{ ...styles.badge, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
          AUTO
        </span>
      </div>

      <p style={styles.desc}>
        If Nova detects low-confidence phrases like "I'm not sure" or "I don't have information", it automatically reformulates the query and retries — transparently, without user intervention.
      </p>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {HEAL_STEPS.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: step === i ? `rgba(${s.color === '#f59e0b' ? '245,158,11' : s.color === '#8b5cf6' ? '139,92,246' : s.color === '#10b981' ? '16,185,129' : '59,130,246'},0.1)` : 'rgba(255,255,255,0.02)',
            border: `1px solid ${step === i ? s.color + '44' : 'rgba(255,255,255,0.04)'}`,
            borderRadius: 8, padding: '8px 12px',
            transition: 'all 0.4s ease',
            transform: step === i ? 'translateX(4px)' : 'translateX(0)',
          }}>
            <span style={{ fontSize: 16 }}>{s.icon}</span>
            <span style={{ fontSize: 12, color: step === i ? '#e2e8f0' : '#475569', transition: 'color 0.4s' }}>{s.label}</span>
            {step === i && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: s.color, animation: 'blink 0.75s ease-in-out infinite' }} />}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Confidence scoring', 'Query reformulation', 'Automatic retry', 'Zero user friction'].map(t => (
          <span key={t} style={{ ...styles.techPill, color: '#fca5a5', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

// ── Main Export ──────────────────────────────────────────────────────────────
export default function AIShowcase({ onSwitchMode }) {
  return (
    <section style={{ padding: '64px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(6,11,24,0) 0%, rgba(6,11,24,0.6) 100%)' }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.5);opacity:0} }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Section heading */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', color: '#5eead4', borderRadius: 24, padding: '6px 18px', fontSize: 12, fontWeight: 600, marginBottom: 16, letterSpacing: 0.5 }}>
            🤖 Powered by 4 AI Patterns
          </div>
          <h2 style={{ color: '#f1f5f9', fontSize: 32, fontWeight: 800, letterSpacing: -1, margin: '0 0 12px', lineHeight: 1.2 }}>
            Under the Hood
          </h2>
          <p style={{ color: '#64748b', fontSize: 15, maxWidth: 520, margin: '0 auto' }}>
            Nova isn't a simple chatbot. It uses four distinct AI architectures working together to deliver accurate, real-time workspace recommendations.
          </p>
        </div>

        {/* Top row — 3 main cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
          <RagCard   onTry={() => onSwitchMode?.('chat')} />
          <AgentCard onTry={() => onSwitchMode?.('agent')} />
          <SemanticCard onTry={() => onSwitchMode?.('chat')} />
        </div>

        {/* Bottom row — Self-Healing + Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <SelfHealCard />

          {/* Stats / summary card */}
          <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.7 }}>
                All 4 patterns run together on every conversation. RAG grounds facts, the agent autonomously uses tools, semantic search understands intent, and self-healing catches mistakes automatically.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { val: '41',    label: 'Real Spaces',     color: '#3b82f6' },
                  { val: '13',    label: 'Bangalore Areas', color: '#14b8a6' },
                  { val: '5',     label: 'Agent Tools',     color: '#f59e0b' },
                  { val: '100%',  label: 'Local / Private', color: '#10b981' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button
                onClick={() => onSwitchMode?.('chat')}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                💬 Chat Mode
              </button>
              <button
                onClick={() => onSwitchMode?.('agent')}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                ⚡ Agent Mode
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const styles = {
  card: {
    background: 'rgba(8,12,30,0.7)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 18,
    padding: 24,
    backdropFilter: 'blur(8px)',
  },
  cardHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12,
  },
  iconBadge: {
    width: 40, height: 40, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, flexShrink: 0,
  },
  cardTitle: {
    color: '#f1f5f9', fontWeight: 700, fontSize: 16, lineHeight: 1.2,
  },
  cardSub: {
    color: '#475569', fontSize: 11, marginTop: 2,
  },
  badge: {
    marginLeft: 'auto', flexShrink: 0,
    borderRadius: 20, padding: '3px 10px',
    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap',
  },
  desc: {
    color: '#64748b', fontSize: 13, lineHeight: 1.65, margin: 0,
  },
  pipeStep: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    borderRadius: 8, padding: '8px 10px', minWidth: 68,
  },
  stepDesc: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid',
    borderRadius: 8, padding: '8px 12px',
    transition: 'border-color 0.3s',
  },
  terminal: {
    background: '#040912', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
    padding: 14, marginTop: 14, height: 160, overflowY: 'auto',
    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
    scrollBehavior: 'smooth',
  },
  techPill: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#64748b',
  },
  tryBtn: {
    marginTop: 16, width: '100%', padding: '10px 0',
    borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'opacity 0.2s',
    textAlign: 'center',
  },
}
