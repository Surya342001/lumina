import React from 'react'
import { Database, Brain, Zap, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    icon: <Zap size={20} />,
    color: 'blue',
    title: '1. User Query',
    desc: 'User asks in natural language: "I need a conference room for 15 people in Koramangala on Friday afternoon."',
  },
  {
    icon: <Brain size={20} />,
    color: 'coral',
    title: '2. Embedding + Retrieval',
    desc: 'The query is converted to a vector embedding. ChromaDB retrieves the top matching knowledge chunks from the Aurbis database.',
  },
  {
    icon: <Database size={20} />,
    color: 'teal',
    title: '3. RAG Context',
    desc: 'Relevant space details, pricing, amenities, and policies are injected as context into the LLM prompt (LangChain chain).',
  },
  {
    icon: <Zap size={20} />,
    color: 'blue',
    title: '4. LLM Generation',
    desc: 'GPT-4 generates a tailored, accurate response grounded in real Aurbis data — with specific recommendations and booking options.',
  },
]

const C = {
  blue: { bg: 'bg-blue-900/30', border: 'border-blue-700/40', icon: 'text-aurbis-blue-light', num: 'bg-aurbis-blue' },
  coral: { bg: 'bg-orange-900/30', border: 'border-orange-700/40', icon: 'text-orange-400', num: 'bg-aurbis-coral' },
  teal: { bg: 'bg-teal-900/30', border: 'border-teal-700/40', icon: 'text-teal-400', num: 'bg-aurbis-teal' },
}

export default function HowItWorks() {
  return (
    <section className="py-16 px-6 border-t border-white/6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-teal-900/30 border border-teal-700/40 text-teal-300 text-xs px-4 py-2 rounded-full mb-4">
            <Brain size={12} /> How Nova Works
          </div>
          <h2 className="text-white text-2xl md:text-3xl font-bold mb-2">
            Retrieval-Augmented Generation (RAG)
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            Nova doesn't just guess — it retrieves accurate, up-to-date information from Aurbis's knowledge base before responding. No hallucinations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          {STEPS.map((step, i) => {
            const c = C[step.color]
            return (
              <div key={i} className="relative">
                <div className={`${c.bg} border ${c.border} rounded-2xl p-5 h-full`}>
                  <div className={`w-9 h-9 rounded-xl ${c.num} flex items-center justify-center mb-3`}>
                    <span className={c.icon}>{step.icon}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-2 z-10 -translate-y-1/2">
                    <ArrowRight size={16} className="text-slate-600" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Tech stack pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { label: 'LangChain', color: 'blue' },
            { label: 'ChromaDB (Vector Store)', color: 'teal' },
            { label: 'OpenAI GPT-4', color: 'coral' },
            { label: 'FastAPI Backend', color: 'blue' },
            { label: 'React + Vite Frontend', color: 'teal' },
            { label: 'text-embedding-3-small', color: 'coral' },
          ].map(({ label, color }) => (
            <span
              key={label}
              className={`text-xs px-3 py-1.5 rounded-full border font-mono
                ${color === 'blue' ? 'bg-blue-900/30 border-blue-700/40 text-blue-300' :
                  color === 'coral' ? 'bg-orange-900/30 border-orange-700/40 text-orange-300' :
                  'bg-teal-900/30 border-teal-700/40 text-teal-300'}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
