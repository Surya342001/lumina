import React from 'react'

const STATS = [
  { value: '500+', label: 'Enterprise Clients', sub: 'Fortune 500s & fast-scaling startups' },
  { value: '5', label: 'Bangalore Locations', sub: 'Koramangala to HSR Layout' },
  { value: '18+', label: 'Premium Spaces', sub: 'Conference, event, hot desk & more' },
  { value: '70%', label: 'Booking via AI', sub: 'Queries resolved without human agent' },
  { value: '< 2s', label: 'AI Response Time', sub: 'Real-time RAG-powered answers' },
  { value: '4.8★', label: 'Avg Space Rating', sub: 'Across 2,400+ verified reviews' },
]

export default function StatsSection() {
  return (
    <section className="py-16 px-6 border-t border-white/6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-white text-2xl md:text-3xl font-bold mb-2">
            Why Aurbis + AI?
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto text-sm">
            Real numbers from Aurbis's workspace ecosystem — and the measurable impact of AI integration.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {STATS.map(({ value, label, sub }, i) => (
            <div
              key={i}
              className="glass-card rounded-2xl p-5 text-center hover:-translate-y-0.5 transition-transform"
            >
              <div className={`text-3xl font-extrabold mb-1
                ${i % 3 === 0 ? 'text-aurbis-blue-light' : i % 3 === 1 ? 'text-aurbis-coral' : 'text-aurbis-teal-light'}`}>
                {value}
              </div>
              <div className="text-white font-semibold text-sm mb-1">{label}</div>
              <div className="text-slate-500 text-xs">{sub}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center p-8 rounded-2xl bg-gradient-to-r from-aurbis-blue/10 via-aurbis-teal/10 to-aurbis-coral/10 border border-white/8">
          <h3 className="text-white text-xl font-bold mb-2">Ready to integrate AI into your workspace operations?</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            This demo shows a fraction of what's possible. LLM + RAG can be deployed across bookings, support, onboarding, and more.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button className="btn-primary">Schedule a Demo</button>
            <button className="btn-outline">View Enterprise Plans</button>
          </div>
        </div>
      </div>
    </section>
  )
}
