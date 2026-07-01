import React, { useState } from 'react'
import Header from './components/Header'
import HeroSection from './components/HeroSection'
import ChatWidget from './components/ChatWidget'
import SpaceExplorer from './components/SpaceExplorer'
import BookingModal from './components/BookingModal'
import HowItWorks from './components/HowItWorks'
import StatsSection from './components/StatsSection'

export default function App() {
  const [highlightedIds, setHighlightedIds] = useState([])
  const [bookingSpace, setBookingSpace] = useState(null)

  return (
    <div className="min-h-screen bg-aurbis-dark font-sans">
      <Header />

      <main>
        {/* Hero */}
        <HeroSection />

        {/* Main Demo Section: Chat + Spaces */}
        <section id="demo" className="px-4 md:px-6 pb-8">
          <div className="max-w-7xl mx-auto">
            {/* Section label */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/6" />
              <span className="text-slate-600 text-xs uppercase tracking-widest">Live AI Demo</span>
              <div className="h-px flex-1 bg-white/6" />
            </div>

            {/* Two-column layout */}
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
