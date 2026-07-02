import React, { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, X, Sparkles } from 'lucide-react'
import SpaceCard from './SpaceCard'
import { SPACES } from '../api'

const LOCATIONS = ['All', 'Koramangala', 'Whitefield', 'MG Road', 'Indiranagar', 'HSR Layout']
const TYPES = [
  { label: 'All Types', value: '' },
  { label: 'Conference Room', value: 'conference_room' },
  { label: 'Team Room', value: 'team_room' },
  { label: 'Private Office', value: 'private_office' },
  { label: 'Hot Desk', value: 'hot_desk' },
  { label: 'Training Room', value: 'training_room' },
  { label: 'Event Space', value: 'event_space' },
]

// Semantic concept map: natural language concept → space attribute keywords
const CONCEPT_MAP = {
  quiet:         ['focus','private','solo','concentrated','pod','vault','silent'],
  creative:      ['creative','innovation','design','studio','canvas','art'],
  tech:          ['tech','sprint','agile','developer','coding','hub','zoom'],
  luxury:        ['executive','premium','butler','vip','boardroom'],
  cheap:         ['hot desk','desk','starter','walk-in','350','250'],
  affordable:    ['hot desk','desk','starter','walk-in'],
  large:         ['event','hall','deck','grand','community','150','300'],
  small:         ['focus','pod','private','vault'],
  meeting:       ['conference','meeting','boardroom','presentation'],
  event:         ['event','hall','deck','launch','celebration'],
  startup:       ['startup','founder','entrepreneur','network','pitch','den'],
  training:      ['training','workshop','classroom','bootcamp'],
  networking:    ['community','open','network','startup'],
  focus:         ['focus','private','quiet','concentrated','solo','pod'],
  brainstorm:    ['creative','collaboration','innovation','whiteboard'],
  presentation:  ['conference','display','projector','4k'],
  interview:     ['private','confidential','vault','secure'],
  video:         ['zoom','video','conferencing','certified'],
  collaborative: ['collaboration','modular','whiteboard'],
  private:       ['private','focus','vault','confidential','secure'],
  deep:          ['focus','private','quiet','concentrated'],
}

function semanticScore(space, queryWords, expandedTerms) {
  const searchable = [
    space.name, space.type_label, space.location,
    ...(space.ideal_for || []), ...(space.amenities || []), ...(space.tags || []),
  ].join(' ').toLowerCase()
  let score = 0
  for (const w of queryWords)     if (w.length > 2 && searchable.includes(w))  score += 3
  for (const w of expandedTerms)  if (w.length > 3 && searchable.includes(w))  score += 1
  if (space.featured) score += 1
  return score
}

export default function SpaceExplorer({ highlightedIds = [], onBook }) {
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('All')
  const [type, setType] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [maxPrice, setMaxPrice] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [aiMode, setAiMode] = useState(false)   // semantic search mode

  // Compute semantic expansion when aiMode is on
  const { queryWords, expandedTerms, matchedConcepts } = useMemo(() => {
    if (!aiMode || !search.trim()) return { queryWords: new Set(), expandedTerms: new Set(), matchedConcepts: [] }
    const q = search.toLowerCase()
    const words = new Set(q.split(/\s+/).filter(w => w.length > 2))
    const expanded = new Set(words)
    const concepts = []
    for (const [concept, terms] of Object.entries(CONCEPT_MAP)) {
      if (q.includes(concept)) { concepts.push(concept); terms.forEach(t => expanded.add(t)) }
    }
    return { queryWords: words, expandedTerms: expanded, matchedConcepts: concepts }
  }, [search, aiMode])

  const filtered = useMemo(() => {
    return SPACES.filter(s => {
      // In AI mode, skip text filter — scoring handles ranking instead
      if (!aiMode) {
        if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
            !s.location.toLowerCase().includes(search.toLowerCase()) &&
            !s.type_label.toLowerCase().includes(search.toLowerCase()) &&
            !s.ideal_for.some(i => i.toLowerCase().includes(search.toLowerCase()))) return false
      }

      if (location !== 'All' && s.location !== location) return false
      if (type && s.type !== type) return false
      if (maxPrice && s.pricing.hourly > Number(maxPrice)) return false
      if (minCapacity && s.capacity < Number(minCapacity)) return false
      return true
    }).sort((a, b) => {
      // Highlighted spaces first
      const aH = highlightedIds.includes(a.id)
      const bH = highlightedIds.includes(b.id)
      if (aH && !bH) return -1
      if (!aH && bH) return 1
      // In AI semantic mode, rank by semantic score
      if (aiMode && search.trim()) {
        const diff = semanticScore(b, queryWords, expandedTerms) - semanticScore(a, queryWords, expandedTerms)
        if (diff !== 0) return diff
      }
      // Then featured
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return b.rating - a.rating
    })
  }, [search, location, type, maxPrice, minCapacity, highlightedIds, aiMode, queryWords, expandedTerms])

  const resetFilters = () => {
    setSearch(''); setLocation('All'); setType(''); setMaxPrice(''); setMinCapacity('')
  }

  const hasActiveFilters = search || location !== 'All' || type || maxPrice || minCapacity

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-white font-semibold text-sm">
            Available Spaces
            {highlightedIds.length > 0 && (
              <span className="ml-2 text-xs bg-aurbis-blue/20 border border-aurbis-blue/30 text-aurbis-blue-light px-2 py-0.5 rounded-full">
                {highlightedIds.length} AI picks
              </span>
            )}
          </h2>
          <p className="text-slate-600 text-xs mt-0.5">{filtered.length} of {SPACES.length} spaces</p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all
            ${showFilters ? 'bg-aurbis-blue/20 border-aurbis-blue/40 text-aurbis-blue-light' : 'border-white/10 text-slate-500 hover:text-white hover:border-white/20'}`}
        >
          <SlidersHorizontal size={12} />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-aurbis-coral" />}
        </button>
      </div>

      {/* Search — with AI semantic mode toggle */}
      <div className="relative mb-2.5">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={aiMode ? 'e.g. "quiet place for deep work"…' : 'Search spaces or locations...'}
          className="w-full bg-[#1a2236] border border-white/10 focus:border-aurbis-blue/40 rounded-lg pl-9 pr-20 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors autofill:bg-[#1a2236] [&:-webkit-autofill]:bg-[#1a2236] [&:-webkit-autofill]:shadow-[0_0_0_99px_#1a2236_inset] [&:-webkit-autofill]:[text-fill-color:#fff]"
        />
        {/* AI semantic search toggle */}
        <button
          onClick={() => setAiMode(v => !v)}
          title={aiMode ? 'AI semantic search ON — click to use keyword search' : 'Switch to AI semantic search'}
          className={`absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border transition-all
            ${aiMode
              ? 'bg-aurbis-blue/25 border-aurbis-blue/50 text-aurbis-blue-light'
              : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'}`}
        >
          <Sparkles size={10} />
          AI
        </button>
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Semantic concept badges — shown when AI mode identifies concepts */}
      {aiMode && matchedConcepts.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          <span className="text-xs text-slate-500">Concepts:</span>
          {matchedConcepts.map(c => (
            <span key={c} className="text-xs bg-purple-900/30 border border-purple-700/40 text-purple-300 px-2 py-0.5 rounded-full">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Location pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
        {LOCATIONS.map(loc => (
          <button
            key={loc}
            onClick={() => setLocation(loc)}
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all
              ${location === loc
                ? 'bg-aurbis-blue border-aurbis-blue text-white'
                : 'border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/16'}`}
          >
            {loc}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="grid grid-cols-3 gap-3 mb-3 p-3 bg-white/3 border border-white/8 rounded-xl animate-fade-in">
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Space Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full bg-aurbis-dark-3 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Max ₹/hr</label>
            <input
              type="number"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="e.g. 2000"
              className="w-full bg-aurbis-dark-3 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none placeholder-slate-600"
            />
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Min Capacity</label>
            <input
              type="number"
              value={minCapacity}
              onChange={e => setMinCapacity(e.target.value)}
              placeholder="e.g. 10"
              className="w-full bg-aurbis-dark-3 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none placeholder-slate-600"
            />
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="col-span-3 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 pt-1 transition-colors">
              <X size={11} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Space grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <Search size={28} className="mb-2 opacity-40" />
            <p className="text-sm">No spaces match your filters</p>
            <button onClick={resetFilters} className="text-aurbis-blue-light text-xs mt-2 hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
            {filtered.map(space => (
              <SpaceCard
                key={space.id}
                space={space}
                highlighted={highlightedIds.includes(space.id)}
                onBook={onBook}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
