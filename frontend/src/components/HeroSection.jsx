import React from 'react'
import { Sparkles } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="relative flex items-center overflow-hidden pt-16" style={{ minHeight: 260 }}>
      {/* Background blobs */}
      <div className="absolute inset-0 bg-aurbis-dark">
        <div className="absolute top-[-60px] left-[10%] w-[420px] h-[420px] rounded-full bg-aurbis-blue opacity-8 blur-[100px]" />
        <div className="absolute bottom-[-60px] right-[5%] w-[320px] h-[320px] rounded-full bg-aurbis-teal opacity-7 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-10 w-full">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 text-blue-300 text-xs px-3 py-1.5 rounded-full mb-4">
            <Sparkles size={11} />
            <span>LangChain RAG + Ollama · Live Demo</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-3">
            Meet <span className="bg-clip-text text-transparent bg-blue-gradient">Nova</span> —
            Your AI Workspace Concierge
          </h1>

          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Describe what you need in plain English. Nova finds and books the perfect workspace — instantly.
          </p>
        </div>
      </div>
    </section>
  )
}
