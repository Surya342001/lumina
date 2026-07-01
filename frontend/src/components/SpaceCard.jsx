import React from 'react'
import { Star, Users, Zap } from 'lucide-react'

const ACCENT = {
  blue:  { left: 'border-l-blue-500',   price: 'text-blue-400',   btn: 'bg-blue-600 hover:bg-blue-500',   badge: 'bg-blue-950/60 text-blue-300 border-blue-800/50' },
  coral: { left: 'border-l-orange-500', price: 'text-orange-400', btn: 'bg-orange-600 hover:bg-orange-500', badge: 'bg-orange-950/60 text-orange-300 border-orange-800/50' },
  teal:  { left: 'border-l-teal-500',   price: 'text-teal-400',   btn: 'bg-teal-600 hover:bg-teal-500',   badge: 'bg-teal-950/60 text-teal-300 border-teal-800/50' },
}

export default function SpaceCard({ space, highlighted, onBook }) {
  const a = ACCENT[space.color] || ACCENT.blue
  const price = space.pricing?.hourly

  return (
    <div className={`relative bg-white/4 border-l-2 ${a.left} border border-white/10 rounded-xl
      transition-all duration-200 hover:bg-white/6 hover:border-white/18
      ${highlighted ? 'ring-1 ring-blue-500/40 border-blue-500/30' : ''}`}
    >
      <div className="p-4">
        {/* Name + rating */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-white font-semibold text-sm leading-snug">{space.name}</h3>
            <p className={`text-xs mt-0.5 ${a.price}`}>{space.type_label}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 text-xs">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-slate-300 font-medium">{space.rating}</span>
            <span className="text-slate-600">({space.reviews})</span>
          </div>
        </div>

        {/* Location + capacity */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded border ${a.badge}`}>
            {space.location}
          </span>
          <span className="text-slate-500 text-xs flex items-center gap-1">
            <Users size={10} />
            {space.capacity}
          </span>
          {highlighted && (
            <span className="ml-auto text-xs bg-blue-900/40 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded flex items-center gap-1">
              <Zap size={9} /> AI Pick
            </span>
          )}
        </div>

        {/* Price + Book */}
        <div className="flex items-center justify-between">
          <div>
            {price ? (
              <>
                <span className={`text-base font-bold ${a.price}`}>₹{price.toLocaleString()}</span>
                <span className="text-slate-600 text-xs ml-1">/hr</span>
              </>
            ) : (
              <span className="text-slate-400 text-sm">Contact us</span>
            )}
          </div>
          <button
            onClick={() => onBook(space)}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all duration-150 active:scale-95 text-white ${a.btn}`}
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  )
}


