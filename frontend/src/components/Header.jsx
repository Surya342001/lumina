import React from 'react'
import { Zap } from 'lucide-react'

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/8 glass-card">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-gradient flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">Aurbis</span>
            <span className="text-aurbis-slate text-xs ml-1 uppercase tracking-widest">START. SCALE. SOAR.</span>
          </div>
        </div>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-8">
          {['Spaces', 'Locations', 'Enterprise', 'Pricing'].map(item => (
            <a key={item} href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
              {item}
            </a>
          ))}
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
