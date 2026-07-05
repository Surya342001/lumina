// VoiceConversation.jsx — Full-page voice AI conversation (STT + TTS + streaming)
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { streamChat } from '../api'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Strip ALL formatting so TTS only reads natural spoken words */
function cleanForSpeech(text) {
  return text
    // ── Markdown tables: remove entire lines that contain pipes ──────────────
    .replace(/^\|.+$/gm, '')
    // ── Table separator lines (---|---|---) ───────────────────────────────────
    .replace(/^[\s|:\-=]+$/gm, '')
    // ── Emojis (Extended Pictographic + common symbol blocks) ─────────────────
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u2600-\u27FF\u2B00-\u2BFF\u{1F000}-\u{1FFFF}]/gu, '')
    // ── Variation selectors & zero-width chars ─────────────────────────────────
    .replace(/[\uFE00-\uFEFF\u200B-\u200D]/g, '')
    // ── Bold / italic / strikethrough ─────────────────────────────────────────
    .replace(/\*{1,3}([^*\n]*)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_\n]*)_{1,2}/g, '$1')
    .replace(/~~([^~]*)~~/g, '$1')
    // ── Inline code and code fences ───────────────────────────────────────────
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    // ── Headings ──────────────────────────────────────────────────────────────
    .replace(/^#{1,6}\s+/gm, '')
    // ── Markdown links ────────────────────────────────────────────────────────
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // ── Blockquotes ───────────────────────────────────────────────────────────
    .replace(/^>\s*/gm, '')
    // ── Bullet / numbered list markers ────────────────────────────────────────
    .replace(/^[\s]*[-*+•·]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // ── Remaining pipe chars and dashes from tables ───────────────────────────
    .replace(/\|/g, ' ')
    .replace(/---+/g, '')
    // ── Collapse whitespace ───────────────────────────────────────────────────
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\.(\s*\.)+/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Split text into natural sentence chunks for TTS */
function toSentences(text) {
  const raw = text.match(/[^.!?]+[.!?]+["']?/g) || [text]
  return raw.map(s => s.trim()).filter(s => s.length > 2)
}

/** Pick the most human-sounding available voice */
function getBestVoice() {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const PREFS = [
    'Google UK English Female',
    'Google US English',
    'Microsoft Aria Online (Natural)',
    'Microsoft Jenny Online (Natural)',
    'Microsoft Zira Desktop',
    'Samantha',
    'Karen',
    'Moira',
  ]
  for (const pref of PREFS) {
    const v = voices.find(v => v.name === pref)
    if (v) return v
  }
  // Neural / Natural fallback
  const neural = voices.find(v =>
    (v.name.includes('Neural') || v.name.includes('Natural') || v.name.includes('Online')) &&
    v.lang.startsWith('en')
  )
  if (neural) return neural

  // Any en-US / en-GB voice
  return voices.find(v => v.lang === 'en-US') ||
         voices.find(v => v.lang === 'en-GB') ||
         voices.find(v => v.lang.startsWith('en')) ||
         voices[0]
}

// ── Animated Orb ──────────────────────────────────────────────────────────────

function Orb({ status }) {
  const config = {
    idle: {
      outer: 'bg-blue-500/10',
      ring1: 'bg-blue-500/15 scale-110',
      ring2: 'bg-blue-500/8 scale-125',
      core: 'bg-gradient-to-br from-blue-400 to-blue-600',
      glow: 'shadow-blue-500/30',
      label: '',
    },
    listening: {
      outer: 'bg-emerald-500/15 animate-pulse',
      ring1: 'bg-emerald-400/20 scale-110 animate-ping',
      ring2: 'bg-emerald-400/10 scale-130 animate-ping [animation-delay:0.3s]',
      core: 'bg-gradient-to-br from-emerald-400 to-teal-500',
      glow: 'shadow-emerald-500/50',
      label: 'Listening…',
    },
    thinking: {
      outer: 'bg-amber-500/10',
      ring1: 'bg-amber-400/15 scale-110 animate-spin [animation-duration:3s]',
      ring2: 'bg-amber-400/8 scale-125',
      core: 'bg-gradient-to-br from-amber-400 to-orange-500',
      glow: 'shadow-amber-500/40',
      label: 'Nova is thinking…',
    },
    speaking: {
      outer: 'bg-violet-500/15',
      ring1: 'bg-violet-400/20 scale-110 animate-pulse',
      ring2: 'bg-violet-400/10 scale-130 animate-pulse [animation-delay:0.2s]',
      core: 'bg-gradient-to-br from-violet-400 to-purple-600',
      glow: 'shadow-violet-500/50',
      label: 'Nova is speaking…',
    },
  }
  const c = config[status] || config.idle

  return (
    <div className="relative flex items-center justify-center w-48 h-48 mx-auto">
      {/* Outer glow ring */}
      <div className={`absolute inset-0 rounded-full ${c.outer} transition-all duration-700`} />
      {/* Pulse ring 1 */}
      <div className={`absolute inset-3 rounded-full ${c.ring1} transition-all duration-500`} />
      {/* Pulse ring 2 */}
      <div className={`absolute inset-6 rounded-full ${c.ring2} transition-all duration-500`} />
      {/* Core orb */}
      <div className={`relative w-24 h-24 rounded-full ${c.core} shadow-2xl ${c.glow} flex items-center justify-center transition-all duration-500`}>
        {status === 'listening' && (
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
          </svg>
        )}
        {status === 'thinking' && (
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-white animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.15s]" />
            <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.3s]" />
          </div>
        )}
        {status === 'speaking' && (
          <div className="flex items-end gap-0.5 h-8">
            {[3, 6, 9, 7, 4, 8, 5].map((h, i) => (
              <div
                key={i}
                className="w-1.5 bg-white rounded-full animate-pulse"
                style={{ height: `${h * 3}px`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}
        {status === 'idle' && (
          <span className="text-white text-3xl select-none">✦</span>
        )}
      </div>
      {/* Status label */}
      {c.label && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-sm text-slate-400 font-medium">{c.label}</span>
        </div>
      )}
    </div>
  )
}

// ── Voice Waveform (mic feedback) ─────────────────────────────────────────────

function Waveform({ active }) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-150 ${active ? 'bg-emerald-400' : 'bg-slate-700'}`}
          style={{
            height: active ? `${Math.random() * 24 + 4}px` : '4px',
            animationDuration: `${0.4 + Math.random() * 0.4}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Conversation Bubble ───────────────────────────────────────────────────────

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
        ${isUser
          ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
          : 'bg-gradient-to-br from-violet-500 to-purple-700 text-white'}`}>
        {isUser ? 'Y' : 'N'}
      </div>
      {/* Bubble */}
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
        ${isUser
          ? 'bg-blue-600/80 text-white rounded-br-sm'
          : 'bg-slate-800/90 text-slate-200 rounded-bl-sm border border-white/6'}`}>
        <p>{msg.text}</p>
        <p className={`text-xs mt-1 ${isUser ? 'text-blue-200/70' : 'text-slate-500'}`}>
          {msg.time}
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VoiceConversation() {
  const [status, setStatus]       = useState('idle')   // idle | listening | thinking | speaking
  const [messages, setMessages]   = useState([
    {
      id: 0,
      role: 'ai',
      text: "Hi! I'm Nova, your AI workspace assistant. Just press the mic button and speak — I'll find you the perfect workspace in Bangalore.",
      time: now(),
    }
  ])
  const [liveText,  setLiveText]  = useState('')        // live transcript while listening
  const [voiceName, setVoiceName] = useState('')
  const [volume,    setVolume]    = useState(1)
  const [speed,     setSpeed]     = useState(0.9)
  const [autoListen, setAutoListen] = useState(false)   // auto-listen after AI speaks

  const recognitionRef   = useRef(null)
  const utteranceQueueRef = useRef([])
  const isSpeakingRef    = useRef(false)
  const cleanupStreamRef = useRef(null)
  const scrollRef        = useRef(null)
  const accumulatedRef   = useRef('')    // accumulated AI response text

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Load voices ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = () => {
      const v = getBestVoice()
      if (v) setVoiceName(v.name)
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // ── Speak text (TTS) ────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    return new Promise(resolve => {
      if (!text?.trim()) { resolve(); return }
      const cleaned = cleanForSpeech(text)
      if (!cleaned) { resolve(); return }

      const utter = new SpeechSynthesisUtterance(cleaned)
      const voice = getBestVoice()
      if (voice) utter.voice = voice

      utter.rate   = speed
      utter.pitch  = 1.05
      utter.volume = volume

      utter.onend   = () => resolve()
      utter.onerror = () => resolve()

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    })
  }, [speed, volume])

  /** Speak sentence-by-sentence for natural feel */
  const speakFull = useCallback(async (fullText) => {
    setStatus('speaking')
    isSpeakingRef.current = true
    const sentences = toSentences(cleanForSpeech(fullText))
    for (const s of sentences) {
      if (!isSpeakingRef.current) break
      await speak(s)
      // tiny natural gap between sentences
      await new Promise(r => setTimeout(r, 120))
    }
    isSpeakingRef.current = false
    setStatus('idle')
    if (autoListen) setTimeout(() => startListening(), 600)
  }, [speak, autoListen])

  // ── Stop speaking ────────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    isSpeakingRef.current = false
    window.speechSynthesis.cancel()
    setStatus('idle')
  }, [])

  // ── Process user message → stream AI response ─────────────────────────────
  const processInput = useCallback((userText) => {
    if (!userText?.trim()) return

    const userMsg = { id: Date.now(), role: 'user', text: userText.trim(), time: now() }
    setMessages(prev => [...prev, userMsg])
    setStatus('thinking')
    accumulatedRef.current = ''

    // Placeholder for AI response
    const aiId = Date.now() + 1
    setMessages(prev => [...prev, { id: aiId, role: 'ai', text: '…', time: now() }])

    if (cleanupStreamRef.current) cleanupStreamRef.current()

    let full = ''
    cleanupStreamRef.current = streamChat(userText.trim(), {
      onStage: () => {},
      onToken: (token) => {
        full += token
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: full } : m))
      },
      onDone: () => {
        cleanupStreamRef.current = null
        // Clean up final message
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: full, time: now() } : m))
        // Speak the full response
        speakFull(full)
      },
      onError: (err) => {
        const errMsg = "Sorry, I had trouble connecting to the server. Please try again."
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: errMsg } : m))
        speakFull(errMsg)
      },
    })
  }, [speakFull])

  // ── Start listening (STT) ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (status === 'listening') return
    stopSpeaking()

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input requires Chrome or Edge browser.')
      return
    }

    const recog = new SpeechRecognition()
    recog.continuous     = false
    recog.interimResults = true
    recog.lang           = 'en-IN'   // Indian English accent support
    recognitionRef.current = recog

    recog.onstart  = () => { setStatus('listening'); setLiveText('') }

    recog.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setLiveText(transcript)
      if (e.results[e.results.length - 1].isFinal) {
        recog.stop()
        setLiveText('')
        processInput(transcript)
      }
    }

    recog.onerror = (e) => {
      if (e.error !== 'no-speech') console.error('Speech error:', e.error)
      setStatus('idle')
      setLiveText('')
    }

    recog.onend = () => {
      if (status === 'listening') setStatus('idle')
    }

    recog.start()
  }, [status, stopSpeaking, processInput])

  // ── Stop listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setStatus('idle')
    setLiveText('')
  }, [])

  // ── Main button action ─────────────────────────────────────────────────────
  const handleMic = () => {
    if (status === 'speaking') { stopSpeaking(); return }
    if (status === 'listening') { stopListening(); return }
    startListening()
  }

  const canListen = status === 'idle' || status === 'speaking'

  // ── Replay last AI message ────────────────────────────────────────────────
  const replayLast = () => {
    const lastAI = [...messages].reverse().find(m => m.role === 'ai')
    if (lastAI) speakFull(lastAI.text)
  }

  // ── Clear conversation ────────────────────────────────────────────────────
  const clearConversation = () => {
    stopSpeaking()
    setMessages([{
      id: Date.now(), role: 'ai',
      text: "Conversation cleared. I'm ready to help you find your perfect workspace!",
      time: now(),
    }])
  }

  return (
    <div className="min-h-screen bg-aurbis-dark flex flex-col" style={{ paddingTop: '64px' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/6 px-6 py-3 flex items-center justify-between flex-shrink-0"
           style={{ background: 'rgba(11,17,32,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-white font-semibold text-sm">Nova Voice</span>
          <span className="text-slate-500 text-xs">— Conversational AI</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {voiceName && (
            <span className="hidden sm:flex items-center gap-1">
              <span>🔊</span> {voiceName.split(' ').slice(0,3).join(' ')}
            </span>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span>Auto-listen</span>
            <div
              onClick={() => setAutoListen(v => !v)}
              className={`w-9 h-5 rounded-full relative transition-colors ${autoListen ? 'bg-violet-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${autoListen ? 'left-4' : 'left-0.5'}`} />
            </div>
          </label>
          <button onClick={clearConversation} className="text-slate-500 hover:text-slate-300 transition-colors" title="Clear conversation">
            🗑
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 lg:px-6 py-6 gap-6">

        {/* ── Left: Conversation transcript ──────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden lg:max-w-2xl">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Conversation</span>
            <div className="flex-1 h-px bg-white/6" />
            <span className="text-slate-600 text-xs">{messages.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1" style={{ minHeight: 0 }}>
            {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
            {/* Live transcript preview */}
            {liveText && (
              <div className="flex items-end gap-3 flex-row-reverse mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
                  Y
                </div>
                <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-sm bg-blue-600/40 border border-blue-500/30 text-blue-200 text-sm italic">
                  {liveText}
                  <span className="animate-pulse ml-1">|</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* ── Right: Orb + Controls ───────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center gap-8 lg:w-80 flex-shrink-0">

          {/* Orb */}
          <div className="relative pt-8">
            <Orb status={status} />
          </div>

          {/* Status message */}
          <div className="text-center min-h-[2rem]">
            {status === 'idle' && (
              <p className="text-slate-500 text-sm">Press the mic to speak</p>
            )}
            {status === 'thinking' && (
              <p className="text-amber-400 text-sm font-medium animate-pulse">Nova is processing your request…</p>
            )}
          </div>

          {/* Waveform (only while listening) */}
          {status === 'listening' && <Waveform active={true} />}

          {/* Main mic button */}
          <button
            onClick={handleMic}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-95
              ${status === 'listening'
                ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/40 scale-110'
                : status === 'speaking'
                  ? 'bg-gradient-to-br from-violet-500 to-purple-700 shadow-violet-500/40'
                  : 'bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 shadow-blue-500/30 hover:scale-105'}`}
          >
            {status === 'listening' ? (
              /* Stop icon */
              <div className="w-7 h-7 rounded bg-white opacity-90" />
            ) : status === 'speaking' ? (
              /* Speaker/mute icon */
              <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
                <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            ) : (
              /* Mic icon */
              <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" fill="white" stroke="none"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round"/>
                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
              </svg>
            )}
            {/* Pulse ring when listening */}
            {status === 'listening' && (
              <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-50" />
            )}
          </button>

          <p className="text-slate-600 text-xs text-center">
            {status === 'listening' ? 'Tap to stop · speak clearly' :
             status === 'speaking'  ? 'Tap to stop Nova' :
             status === 'thinking'  ? 'Please wait…' :
             'Tap to speak · Chrome/Edge'}
          </p>

          {/* Secondary controls */}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={replayLast}
              disabled={status !== 'idle'}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 text-slate-400 hover:text-white text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              🔁 Replay
            </button>
            <button
              onClick={stopSpeaking}
              disabled={status !== 'speaking'}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 text-slate-400 hover:text-white text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ⏹ Stop
            </button>
          </div>

          {/* Speed control */}
          <div className="w-full space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Voice speed</span>
              <span className="text-slate-400">{speed.toFixed(1)}x</span>
            </div>
            <input
              type="range" min="0.6" max="1.3" step="0.1"
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full accent-violet-500 bg-slate-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-700">
              <span>Slower</span><span>Normal</span><span>Faster</span>
            </div>
          </div>

          {/* Quick prompts */}
          <div className="w-full">
            <p className="text-xs text-slate-600 mb-2">Quick prompts</p>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                'Book a conference room in Koramangala',
                'Show me hot desks available today',
                'I need a quiet space for focus work',
                'What are the prices for event halls?',
              ].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => processInput(prompt)}
                  disabled={status !== 'idle'}
                  className="text-left text-xs text-slate-500 hover:text-blue-300 px-3 py-2 rounded-lg bg-white/3 hover:bg-blue-500/8 border border-white/5 hover:border-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
