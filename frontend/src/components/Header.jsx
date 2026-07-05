import React from 'react'
import { Zap, Mic } from 'lucide-react'

export default function Header({ activePage = 'home', onNavigate }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/8 glass-card">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo — click to go home */}
        <button
          onClick={() => onNavigate?.('home')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-gradient flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">Aurbis</span>
            <span className="text-aurbis-slate text-xs ml-1 uppercase tracking-widest">START. SCALE. SOAR.</span>
          </div>
        </button>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-6">
          {['Spaces', 'Locations', 'Enterprise', 'Pricing'].map(item => (
            <a key={item} href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
              {item}
            </a>
          ))}

          {/* Voice AI nav link */}
          <button
            onClick={() => onNavigate?.(activePage === 'voice' ? 'home' : 'voice')}
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-all
              ${activePage === 'voice'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                : 'text-slate-400 hover:text-white border border-transparent hover:border-white/10'}`}
          >
            <Mic size={13} />
            Voice AI
            {activePage !== 'voice' && (
              <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/30 ml-0.5">
                NEW
              </span>
            )}
          </button>
        </nav>

        {/* Right: AI badge + CTA */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs px-3 py-1.5 rounded-full">
            <Zap size={11} />
            <span>AI-Powered</span>
          </div>
          <button className="btn-primary text-sm py-2 px-4">
            Get Started
          </button>
        </div>
      </div>
    </header>
  )
}
