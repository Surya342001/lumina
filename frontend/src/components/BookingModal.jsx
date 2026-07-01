import React, { useState } from 'react'
import { X, Calendar, Clock, Users, CheckCircle, Loader2, MapPin, Star } from 'lucide-react'
import { bookSpace } from '../api'

const TODAY = new Date().toISOString().split('T')[0]

export default function BookingModal({ space, onClose }) {
  const [form, setForm] = useState({
    date: TODAY,
    time_slot: space?.available_slots?.[0] || '09:00',
    duration_hours: 2,
    attendees: Math.min(space?.capacity || 10, 10),
    name: '',
    email: '',
    notes: ''
  })
  const [step, setStep] = useState(1) // 1=form, 2=confirmed
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')

  if (!space) return null

  const price = space.pricing?.hourly || 0
  const total = price * form.duration_hours

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Please fill in your name and email.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await bookSpace({
        space_id: space.id,
        space_name: space.name,
        location: space.location,
        ...form,
        total_price: total
      })
      setBooking(res)
      setStep(2)
    } catch {
      setError('Booking failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg glass-card rounded-2xl overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-gradient-to-r from-aurbis-blue/10 to-aurbis-teal/10">
          <div>
            <h2 className="text-white font-semibold">{step === 1 ? 'Book Space' : 'Booking Confirmed!'}</h2>
            <p className="text-slate-400 text-sm">{space.name} · {space.location}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {step === 1 && (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Space summary */}
            <div className="flex items-center gap-3 p-3 bg-white/4 border border-white/8 rounded-xl">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                ${space.color === 'blue' ? 'bg-blue-gradient' : space.color === 'coral' ? 'bg-coral-gradient' : 'bg-teal-gradient'}`}>
                <MapPin size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{space.name}</p>
                <p className="text-slate-400 text-xs">{space.type_label} · {space.location} · {space.capacity} max</p>
              </div>
              <div className="flex items-center gap-1">
                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                <span className="text-white text-xs font-medium">{space.rating}</span>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 flex items-center gap-1">
                  <Calendar size={11} /> Date
                </label>
                <input
                  type="date"
                  min={TODAY}
                  value={form.date}
                  onChange={e => update('date', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-aurbis-blue/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 flex items-center gap-1">
                  <Clock size={11} /> Time Slot
                </label>
                <select
                  value={form.time_slot}
                  onChange={e => update('time_slot', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-aurbis-blue/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors bg-aurbis-dark-3"
                >
                  {(space.available_slots || ['09:00','10:00','11:00','13:00','14:00','15:00','16:00']).map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duration & Attendees */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 flex items-center gap-1">
                  <Clock size={11} /> Duration (hours)
                </label>
                <select
                  value={form.duration_hours}
                  onChange={e => update('duration_hours', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 focus:border-aurbis-blue/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none bg-aurbis-dark-3"
                >
                  {[1,2,3,4,5,6,7,8].map(h => (
                    <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 flex items-center gap-1">
                  <Users size={11} /> Attendees
                </label>
                <input
                  type="number"
                  min={1}
                  max={space.capacity}
                  value={form.attendees}
                  onChange={e => update('attendees', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 focus:border-aurbis-blue/50 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Your full name *"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-aurbis-blue/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
              <input
                type="email"
                placeholder="Work email *"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-aurbis-blue/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
              <textarea
                placeholder="Special requests or notes (optional)"
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                rows={2}
                className="w-full bg-white/5 border border-white/10 focus:border-aurbis-blue/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Price summary */}
            <div className="border-t border-white/8 pt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">₹{price.toLocaleString()} × {form.duration_hours} hour{form.duration_hours > 1 ? 's' : ''}</span>
                <span className="text-white font-semibold">₹{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>GST (18%) applicable</span>
                <span>Free cancellation &lt;24hrs</span>
              </div>
            </div>

            <button
              onClick={submit}
              disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Processing...</>
              ) : (
                <>Confirm Booking · ₹{total.toLocaleString()}</>
              )}
            </button>
          </div>
        )}

        {step === 2 && booking && (
          <div className="p-8 flex flex-col items-center text-center animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-teal-400" />
            </div>
            <h3 className="text-white text-xl font-bold mb-1">Booking Confirmed!</h3>
            <p className="text-slate-400 text-sm mb-6">Your workspace is reserved and ready.</p>

            <div className="w-full bg-white/4 border border-white/8 rounded-xl p-4 space-y-2.5 text-left mb-6">
              {[
                ['Booking ID', booking.booking_id],
                ['Space', booking.space_name],
                ['Location', booking.location],
                ['Date', booking.date],
                ['Time', `${booking.time_slot} · ${booking.duration_hours} hr${booking.duration_hours > 1 ? 's' : ''}`],
                ['Total', `₹${booking.total_price?.toLocaleString()} INR`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500 text-sm">{label}</span>
                  <span className="text-white text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>

            <p className="text-slate-500 text-xs mb-4">
              A confirmation email with your QR access code has been sent.
            </p>
            <button onClick={onClose} className="btn-primary w-full py-2.5">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
