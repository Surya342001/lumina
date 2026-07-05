import React, { useState } from 'react'
import Header from './components/Header'
import HeroSection from './components/HeroSection'
import ChatWidget from './components/ChatWidget'
import SpaceExplorer from './components/SpaceExplorer'
import BookingModal from './components/BookingModal'
import HowItWorks from './components/HowItWorks'
import StatsSection from './components/StatsSection'
import AgentPanel from './components/AgentPanel'
import AIShowcase from './components/AIShowcase'
import VoiceConversation from './components/VoiceConversation'

export default function App() {
  const [highlightedIds, setHighlightedIds] = useState([])
  const [bookingSpace, setBookingSpace] = useState(null)
  const [appMode, setAppMode] = useState('chat')   // 'chat' | 'agent'
  const [activePage, setActivePage] = useState('home')  // 'home' | 'voice'

  return (
    <div className="min-h-screen bg-aurbis-dark font-sans">
      <Header activePage={activePage} onNavigate={setActivePage} />

      {/* Voice Conversation page */}
      {activePage === 'voice' && <VoiceConversation />}

      <main style={{ display: activePage === 'voice' ? 'none' : undefined }}>
        {/* Hero */}
        <HeroSection />

        {/* Main Demo Section: Chat + Spaces */}
        <section id="demo" className="px-4 md:px-6 pb-8" style={{ overflow: 'hidden' }}>
          <div className="max-w-7xl mx-auto" style={{ minHeight: '820px' }}>
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
                <h3 className="text-white font-semibold mb-1">🤖 Understand Nova Agent</h3>
                <p className="text-slate-500 text-xs mb-4">Think of Nova as an operations assistant that can plan, search the backend, compare options, calculate prices, and share results.</p>

                {[{
                  icon: '⚡', title: 'Run Agent', color: 'text-blue-300',
                  desc: 'Use this when you want Nova to solve the request now. It thinks, chooses a tool, reads the database, and returns a final recommendation.',
                  tags: ['Think', 'Use tool', 'Answer'],
                },{
                  icon: '🗂️', title: 'Goal Plan', color: 'text-violet-300',
                  desc: 'Use this when the request is big. Nova breaks it into smaller backend tasks before you run it live.',
                  tags: ['Break down', 'Order tasks', 'Ready to run'],
                },{
                  icon: '📤', title: 'Email + WhatsApp', color: 'text-emerald-300',
                  desc: 'After Nova produces a result, you can email it from the backend or open a WhatsApp share message instantly.',
                  tags: ['Email result', 'WhatsApp share', 'Client follow-up'],
                },{
                  icon: '🗄️', title: 'Bigger Backend Database', color: 'text-amber-300',
                  desc: 'The demo now has 41 workspaces across 13 Bangalore areas, including Bellandur, Sarjapur, Bannerghatta Road, and Yelahanka.',
                  tags: ['41 spaces', '13 areas', 'More realistic demo'],
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
                  <p className="text-xs text-violet-300 font-semibold mb-1">💡 Best demo examples:</p>
                  {[
                    'Find the best Bellandur room for 12 people under ₹2000/hr',
                    'Plan a team offsite for 25 people with price and availability checks',
                    'Compare Innovation Hub and Sprint Room for a tech team of 10',
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
                '"Bellandur conference room for 12 people"',
                '"Plan an offsite for 25 people"',
                '"Event space near Bannerghatta under ₹10,000/hr"',
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

        {/* AI Features Showcase */}
        <AIShowcase onSwitchMode={(mode) => {
          setAppMode(mode)
          document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
        }} />

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
