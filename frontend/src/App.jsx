import React, { useState } from 'react'
import Header from './components/Header'
import HeroSection from './components/HeroSection'
import ChatWidget from './components/ChatWidget'
import SpaceExplorer from './components/SpaceExplorer'
import BookingModal from './components/BookingModal'
import HowItWorks from './components/HowItWorks'
import StatsSection from './components/StatsSection'
import AgentPanel from './components/AgentPanel'

export default function App() {
  const [highlightedIds, setHighlightedIds] = useState([])
  const [bookingSpace, setBookingSpace] = useState(null)
  const [appMode, setAppMode] = useState('chat')   // 'chat' | 'agent'

  return (
    <div className="min-h-screen bg-aurbis-dark font-sans">
      <Header />

      <main>
        {/* Hero */}
        <HeroSection />

        {/* Main Demo Section: Chat + Spaces */}
        <section id="demo" className="px-4 md:px-6 pb-8">
          <div className="max-w-7xl mx-auto">
            {/* Section label + mode switcher */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/6" />
              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-1 bg-white/4 rounded-xl border border-white/8">
                <button
                  onClick={() => setAppMode('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    appMode === 'chat'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  💬 Chat Mode
                </button>
                <button
                  onClick={() => setAppMode('agent')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    appMode === 'agent'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  🤖 Agent Mode
                </button>
              </div>
              <div className="h-px flex-1 bg-white/6" />
            </div>

            {/* Two-column layout — Chat Mode */}
            {appMode === 'chat' && (
            <div className="flex flex-col lg:flex-row gap-4" style={{ height: '720px' }}>
              {/* Chat — left column */}
              <div className="w-full lg:w-[42%] flex flex-col" style={{ height: '720px', minHeight: '720px', maxHeight: '720px' }}>
                <ChatWidget onSpacesHighlight={setHighlightedIds} />
              </div>

              {/* Space Explorer — right column */}
              <div className="w-full lg:flex-1 flex flex-col glass-card rounded-2xl p-4" style={{ height: '720px', minHeight: '720px', maxHeight: '720px', overflow: 'hidden' }}>
                <SpaceExplorer
                  highlightedIds={highlightedIds}
                  onBook={space => setBookingSpace(space)}
                />
              </div>
            </div>
            )}

            {/* Agent Mode — full width */}
            {appMode === 'agent' && (
            <div className="flex flex-col lg:flex-row gap-4" style={{ height: '720px' }}>
              {/* Agent panel — left, wider */}
              <div className="w-full lg:w-[52%] flex flex-col" style={{ height: '720px', minHeight: '720px', maxHeight: '720px' }}>
                <AgentPanel />
              </div>

              {/* Agent info panel — right */}
              <div className="w-full lg:flex-1 flex flex-col glass-card rounded-2xl p-5" style={{ height: '720px', minHeight: '720px', maxHeight: '720px', overflow: 'auto' }}>
                <h3 className="text-white font-semibold mb-1">🤖 Agentic AI Features</h3>
                <p className="text-slate-500 text-xs mb-4">Nova uses a ReAct loop to reason and act autonomously</p>

                {[{
                  icon: '⚡', title: 'ReAct Loop', color: 'text-blue-300',
                  desc: 'Reason → Act → Observe → Repeat. Nova thinks step by step, calls tools, and builds the answer autonomously.',
                  tags: ['Thought', 'Action', 'Observation'],
                },{
                  icon: '🔧', title: 'Multi-Tool Agent', color: 'text-amber-300',
                  desc: '5 callable tools: search spaces, get details, calculate price, compare options, check availability.',
                  tags: ['search_spaces', 'calculate_price', 'compare_spaces'],
                },{
                  icon: '🗂️', title: 'Goal Decomposition', color: 'text-violet-300',
                  desc: 'Complex goals are broken into ordered, executable subtasks automatically.',
                  tags: ['Planning', 'Subtasks', 'Execution Tree'],
                },{
                  icon: '🩹', title: 'Self-Healing RAG', color: 'text-emerald-300',
                  desc: 'When RAG returns low-confidence answers, Nova auto-reformulates the query and retries.',
                  tags: ['Auto-retry', 'Query rewrite', 'Confidence check'],
                }].map(f => (
                  <div key={f.title} className="mb-4 p-3 rounded-xl bg-white/3 border border-white/6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{f.icon}</span>
                      <span className={`font-semibold text-sm ${f.color}`}>{f.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">{f.desc}</p>
                    <div className="flex flex-wrap gap-1">
                      {f.tags.map(t => (
                        <span key={t} className="text-xs bg-white/5 border border-white/8 px-2 py-0.5 rounded-full text-slate-500">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="mt-2 p-3 rounded-xl bg-violet-500/8 border border-violet-500/20">
                  <p className="text-xs text-violet-300 font-semibold mb-1">💡 Try these goals:</p>
                  {[
                    'Compare Innovation Hub and Sprint Room for a tech team of 10',
                    'Find cheapest event space for 100 people in Bangalore',
                    'Book a quiet room for 4 people in Whitefield for 3 hours',
                  ].map(g => (
                    <p key={g} className="text-xs text-slate-500 mt-1">• {g}</p>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* Tip bar */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="text-slate-500">Try:</span>
              {[
                '"Conference room for 15 people tomorrow"',
                '"Event spaces under ₹20,000/hr"',
                '"Book Innovation Hub Friday 2pm"',
              ].map(q => (
                <span key={q} className="bg-white/3 border border-white/6 px-2.5 py-1 rounded-full text-slate-500">
                  {q}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <HowItWorks />

        {/* Stats */}
        <StatsSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-blue-gradient flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="text-white font-semibold">Aurbis</span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-slate-500 text-xs">AI Workspace Demo</span>
        </div>
        <p className="text-slate-600 text-xs">
          Built with LangChain · ChromaDB · FastAPI · React · Tailwind CSS
        </p>
      </footer>

      {/* Booking Modal */}
      {bookingSpace && (
        <BookingModal
          space={bookingSpace}
          onClose={() => setBookingSpace(null)}
        />
      )}
    </div>
  )
}
