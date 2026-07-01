/**
 * Aurbis AI Assistant — API Client
 * Tries real backend first, falls back to mock demo responses
 */
import axios from 'axios'

const BASE_URL = '/api'
const client = axios.create({ baseURL: BASE_URL, timeout: 15000 })

let sessionId = null

export function getSessionId() {
  if (!sessionId) sessionId = crypto.randomUUID()
  return sessionId
}

export async function sendChat(message) {
  try {
    const { data } = await client.post('/chat', {
      message,
      session_id: getSessionId()
    })
    return data
  } catch {
    // Backend not available — use built-in demo
    return localDemo(message)
  }
}

/**
 * Streaming chat via Server-Sent Events.
 * Returns a cleanup function to close the stream.
 */
export function streamChat(message, { onStage, onToken, onDone, onError } = {}) {
  const sid = getSessionId()
  const url = `/api/chat/stream?message=${encodeURIComponent(message)}&session_id=${encodeURIComponent(sid)}`

  const es = new EventSource(url)

  es.addEventListener('stage', e => onStage?.(JSON.parse(e.data)))
  es.addEventListener('token', e => onToken?.(JSON.parse(e.data).token))
  es.addEventListener('done', e => {
    es.close()
    onDone?.(JSON.parse(e.data))
  })
  es.addEventListener('error', e => {
    es.close()
    try { onError?.(e.data ? JSON.parse(e.data) : { error: 'Stream error' }) }
    catch { onError?.({ error: 'Stream error' }) }
  })
  es.onerror = () => {
    es.close()
    onError?.({ error: 'Connection failed — is the backend running?' })
  }

  return () => es.close()
}

export async function fetchSpaces(filters = {}) {
  try {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && params.append(k, v))
    const { data } = await client.get(`/spaces?${params}`)
    return data.spaces
  } catch {
    return localSpaces(filters)
  }
}

export async function bookSpace(payload) {
  try {
    const { data } = await client.post('/book', payload)
    return data
  } catch {
    const bookingId = `AUR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    return {
      booking_id: bookingId,
      space_name: payload.space_name || 'Selected Space',
      location: payload.location || 'Bangalore',
      date: payload.date,
      time_slot: payload.time_slot,
      duration_hours: payload.duration_hours,
      total_price: payload.total_price || 0,
      currency: 'INR',
      status: 'confirmed',
      confirmation_message: `✅ Booking confirmed! Booking ID: ${bookingId}`
    }
  }
}

// ──────────────────────────────────────────────────────
// LOCAL DEMO DATA (mirrors backend demo mode)
// ──────────────────────────────────────────────────────

const SPACES = [
  { id:'KOR-001', name:'Innovation Hub', type:'conference_room', type_label:'Conference Room', location:'Koramangala', capacity:12, pricing:{hourly:1500,half_day:6000,full_day:10000,currency:'INR'}, amenities:['85" 4K Display','Zoom Room Certified','Dual Whiteboards','1Gbps WiFi','Video Recording','In-room Catering'], ideal_for:['Client Presentations','Team Meetings','Product Demos'], rating:4.9, reviews:167, featured:true, color:'blue', tags:['Most Popular','Tech-Enabled'], available_slots:['09:00','11:00','14:00','16:00'] },
  { id:'KOR-002', name:'The Boardroom', type:'conference_room', type_label:'Executive Meeting Room', location:'Koramangala', capacity:8, pricing:{hourly:2000,half_day:8000,full_day:14000,currency:'INR'}, amenities:['Premium Executive Furniture','75" 4K Display','HD Video Conferencing','Natural Lighting','Butler Service','Complimentary Refreshments'], ideal_for:['Executive Meetings','Investor Pitches','Board Discussions'], rating:4.8, reviews:98, featured:false, color:'coral', tags:['Executive','Premium'], available_slots:['10:00','13:00','15:00'] },
  { id:'KOR-003', name:'Collaboration Zone', type:'team_room', type_label:'Team Room', location:'Koramangala', capacity:20, pricing:{hourly:800,half_day:3500,full_day:6000,currency:'INR'}, amenities:['3 Moveable Screens','Modular Furniture','Multiple Whiteboards','500Mbps WiFi','Standing Desks'], ideal_for:['Workshops','Hackathons','Design Sprints'], rating:4.7, reviews:204, featured:false, color:'teal', tags:['Collaborative','Agile-Ready'], available_slots:['09:00','10:00','13:00','14:00','16:00'] },
  { id:'KOR-004', name:'Sky Deck', type:'event_space', type_label:'Premium Event Space', location:'Koramangala', capacity:150, pricing:{hourly:15000,currency:'INR'}, amenities:['Rooftop Terrace','Professional PA System','LED Lighting','Catering Kitchen','Event Staff'], ideal_for:['Corporate Events','Product Launches','Team Celebrations'], rating:4.9, reviews:55, featured:true, color:'blue', tags:['Rooftop','Events'], available_slots:['18:00','19:00'] },
  { id:'KOR-005', name:'Creative Studio', type:'hot_desk', type_label:'Hot Desk Area', location:'Koramangala', capacity:30, pricing:{hourly:350,day:3200,currency:'INR'}, amenities:['Ergonomic Chairs','Dual Monitor Option','Phone Booths','Nespresso Bar','Lockers'], ideal_for:['Individuals','Freelancers','Remote Employees'], rating:4.6, reviews:312, featured:false, color:'teal', tags:['Flexible','Walk-in Welcome'], available_slots:['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'] },
  { id:'WHI-001', name:'Tech Hub', type:'training_room', type_label:'Training Room', location:'Whitefield', capacity:40, pricing:{hourly:5000,half_day:20000,full_day:35000,currency:'INR'}, amenities:['Dual 4K Projectors','40 Computer Workstations','Recording System','Breakout Lounge'], ideal_for:['Corporate Training','Certifications','Bootcamps'], rating:4.8, reviews:89, featured:true, color:'blue', tags:['Tech-Enabled','Large Capacity'], available_slots:['09:00','14:00'] },
  { id:'WHI-002', name:'Sprint Room', type:'conference_room', type_label:'Agile Conference Room', location:'Whitefield', capacity:10, pricing:{hourly:1200,half_day:5000,full_day:8000,currency:'INR'}, amenities:['Agile Scrum Boards','Multiple TVs','Standing Desks','Modular Seating','Unlimited Coffee'], ideal_for:['Sprint Planning','Retrospectives','Daily Standups'], rating:4.9, reviews:143, featured:true, color:'coral', tags:['Agile','Developer Favourite'], available_slots:['09:00','10:00','11:00','14:00','15:00','16:00'] },
  { id:'WHI-003', name:'Focus Pod', type:'private_office', type_label:'Private Office', location:'Whitefield', capacity:4, pricing:{hourly:600,half_day:2500,full_day:4500,currency:'INR'}, amenities:['Standing Desks','Privacy Screens','Dedicated 500Mbps Line','Mini Fridge'], ideal_for:['Deep Work','Confidential Projects','Interviews'], rating:4.7, reviews:67, featured:false, color:'teal', tags:['Private','Quiet Zone'], available_slots:['09:00','11:00','13:00','15:00'] },
  { id:'WHI-004', name:'Innovation Lab', type:'team_room', type_label:'Team Suite', location:'Whitefield', capacity:25, pricing:{hourly:2500,half_day:10000,full_day:18000,currency:'INR'}, amenities:['Maker Space Equipment','3D Printer','Large Interactive Displays','Collaborative Furniture'], ideal_for:['R&D Teams','Product Development','Hackathons'], rating:4.8, reviews:76, featured:false, color:'blue', tags:['Innovation','Maker Space'], available_slots:['10:00','14:00'] },
  { id:'MGR-001', name:'Executive Suite', type:'private_office', type_label:'Premium Office', location:'MG Road', capacity:6, pricing:{hourly:3000,half_day:12000,full_day:20000,currency:'INR'}, amenities:['Panoramic City View (12th Floor)','Premium Furniture','Butler Service','Private Washroom','Bar Setup'], ideal_for:['Executive Meetings','VIP Clients','High-Stakes Negotiations'], rating:5.0, reviews:42, featured:true, color:'coral', tags:['Premium','City View','VIP'], available_slots:['10:00','14:00','16:00'] },
  { id:'MGR-002', name:'Grand Hall', type:'event_space', type_label:'Flagship Event Space', location:'MG Road', capacity:300, pricing:{hourly:25000,currency:'INR'}, amenities:['Professional Stage','20ft LED Video Wall','Full PA System','Dedicated Catering Team','Event Coordinator'], ideal_for:['Annual Conferences','Product Launches','Gala Dinners'], rating:4.9, reviews:28, featured:true, color:'blue', tags:['Flagship','300+ Capacity'], available_slots:['09:00','18:00'] },
  { id:'MGR-003', name:'Think Tank', type:'team_room', type_label:'Workshop Room', location:'MG Road', capacity:25, pricing:{hourly:2500,half_day:10000,full_day:17000,currency:'INR'}, amenities:['Workshop Supply Kit','Flip Charts','Sticky Notes','Design Materials','Breakout Spaces'], ideal_for:['Strategy Workshops','Leadership Offsites','Design Thinking'], rating:4.7, reviews:91, featured:false, color:'teal', tags:['Workshop Ready','Materials Included'], available_slots:['09:00','11:00','14:00'] },
  { id:'IND-001', name:'The Gallery', type:'team_room', type_label:'Creative Team Space', location:'Indiranagar', capacity:15, pricing:{hourly:1000,half_day:4000,full_day:7000,currency:'INR'}, amenities:['Gallery Display Walls','Mood Lighting','Creative Toolkit','Inspiration Library','Nespresso Bar'], ideal_for:['Creative Agencies','Design Teams','Advertising'], rating:4.8, reviews:118, featured:true, color:'coral', tags:['Creative','Insta-worthy'], available_slots:['09:00','11:00','13:00','15:00','17:00'] },
  { id:'IND-002', name:'Open Canvas', type:'hot_desk', type_label:'Hot Desk Community', location:'Indiranagar', capacity:50, pricing:{hourly:250,day:2800,currency:'INR'}, amenities:['Ergonomic Chairs','Standing Desk Option','In-house Café','Networking Lounge'], ideal_for:['Startups','Freelancers','Remote Workers'], rating:4.6, reviews:389, featured:false, color:'teal', tags:['Community','Best Value'], available_slots:['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'] },
  { id:'IND-003', name:'Podcast Studio', type:'private_office', type_label:'Media Production Room', location:'Indiranagar', capacity:4, pricing:{hourly:2000,half_day:8000,currency:'INR'}, amenities:['Pro Condenser Microphones','Acoustic Treatment','4K Camera','Lighting Kit','Editing Workstation'], ideal_for:['Podcasting','Video Production','Corporate Videos'], rating:4.9, reviews:53, featured:false, color:'blue', tags:['Media','Unique'], available_slots:['10:00','13:00','16:00'] },
  { id:'HSR-001', name:'The Vault', type:'conference_room', type_label:'Secure Meeting Room', location:'HSR Layout', capacity:8, pricing:{hourly:1500,half_day:6000,full_day:10000,currency:'INR'}, amenities:['Signal-Blocking Option','Secure Document Filing','NDA-Compliant Setup','No CCTV Inside','White-Noise System'], ideal_for:['Legal Meetings','M&A Discussions','Confidential HR'], rating:4.8, reviews:74, featured:false, color:'coral', tags:['Secure','Confidential'], available_slots:['09:00','11:00','14:00','16:00'] },
  { id:'HSR-002', name:'Community Hall', type:'team_room', type_label:'Large Team Space', location:'HSR Layout', capacity:30, pricing:{hourly:2000,half_day:8000,full_day:14000,currency:'INR'}, amenities:['Modular Furniture','Outdoor Terrace Access','BBQ Setup','AV System'], ideal_for:['Team All-Hands','Community Events','Networking Meetups'], rating:4.7, reviews:112, featured:true, color:'teal', tags:['Community Hub','Outdoor Access'], available_slots:['09:00','10:00','14:00','16:00'] },
  { id:'HSR-003', name:'Startup Den', type:'hot_desk', type_label:'Accelerator Space', location:'HSR Layout', capacity:20, pricing:{hourly:300,day:3200,currency:'INR'}, amenities:['Mentorship Network','Investor Connect','Pitch Practice Room','Startup Resources'], ideal_for:['Early-Stage Startups','Accelerator Cohorts','Entrepreneurs'], rating:4.8, reviews:87, featured:false, color:'blue', tags:['Startup Friendly','Mentorship'], available_slots:['09:00','10:00','11:00','14:00','15:00','16:00'] },
]

function localSpaces(filters = {}) {
  let result = [...SPACES]
  if (filters.location) result = result.filter(s => s.location.toLowerCase().includes(filters.location.toLowerCase()))
  if (filters.space_type) result = result.filter(s => s.type.toLowerCase().includes(filters.space_type.toLowerCase()))
  if (filters.min_capacity) result = result.filter(s => s.capacity >= Number(filters.min_capacity))
  if (filters.max_price) result = result.filter(s => (s.pricing.hourly || 9999) <= Number(filters.max_price))
  if (filters.featured) result = result.filter(s => s.featured)
  return result
}

export { SPACES }

function localDemo(message) {
  const m = message.toLowerCase()
  const match = (...kw) => kw.some(k => m.includes(k))

  if (match('hi','hello','hey','start','help') && m.split(' ').length <= 3)
    return { answer: "👋 Hi! I'm **Nova**, your Aurbis AI Workspace Assistant.\n\nI can help you:\n🔍 **Find** the perfect space across 5 Bangalore locations\n💰 **Compare** prices and amenities\n📅 **Book** spaces instantly\n❓ **Answer** anything about Aurbis\n\nWhat are you looking for today? Try:\n- *\"Conference room for 12 people in Koramangala\"*\n- *\"Cheapest event space for 100 people\"*\n- *\"Book Sprint Room Whitefield Friday 3pm\"*", sources:[], mode:'demo', suggested_spaces:['KOR-001','WHI-002','MGR-001'] }

  if (match('event space','launch event','gala','conference hall','200 people','300 people','large event','product launch'))
    return { answer: "For large events, Aurbis has outstanding venues:\n\n🏟️ **Grand Hall, MG Road** — ₹25,000/hr | 300 guests | Stage, LED wall, catering\n🌅 **Sky Deck, Koramangala** — ₹15,000/hr | 150 guests | Rooftop, perfect for launches\n🏠 **Community Hall, HSR Layout** — ₹2,000/hr | 30 guests | Outdoor terrace\n\nEvent spaces require 24-hour advance booking (min 3–4 hrs). Want me to check a date?", sources:['Event Spaces — MG Road','Event Spaces — Koramangala'], mode:'demo', suggested_spaces:['MGR-002','KOR-004','HSR-002'] }

  if (match('conference','meeting room','boardroom','board room','presentation','client meeting'))
    return { answer: "Great! Aurbis has **premium conference rooms** across Bangalore:\n\n🚀 **Innovation Hub, Koramangala** — ₹1,500/hr | 12 pax | Zoom certified, 85\" display\n🏆 **The Boardroom, Koramangala** — ₹2,000/hr | 8 pax | Executive setup, butler service\n⚡ **Sprint Room, Whitefield** — ₹1,200/hr | 10 pax | Agile boards, developer fav\n🔒 **The Vault, HSR** — ₹1,500/hr | 8 pax | Confidential, NDA-compliant\n\nHow many people and which area? I'll find the perfect match!", sources:['Conference Rooms'], mode:'demo', suggested_spaces:['KOR-001','KOR-002','WHI-002','HSR-001'] }

  if (match('training','workshop','bootcamp','classroom'))
    return { answer: "For **training and workshops**:\n\n💻 **Tech Hub, Whitefield** — ₹5,000/hr | 40 pax | 40 workstations, dual projectors, recording\n🧠 **Think Tank, MG Road** — ₹2,500/hr | 25 pax | Workshop kit included, facilitator support\n\nBoth have full AV and breakout areas. What kind of training?", sources:['Training Rooms'], mode:'demo', suggested_spaces:['WHI-001','MGR-003'] }

  if (match('hot desk','cowork','freelance','day pass','open work','flexible'))
    return { answer: "Aurbis has vibrant **hot desk** communities:\n\n☕ **Creative Studio, Koramangala** — ₹350/hr | ₹3,200/day | Nespresso bar, phone booths\n🎨 **Open Canvas, Indiranagar** — ₹250/hr | ₹2,800/day | 50 desks, café, networking\n🚀 **Startup Den, HSR** — ₹300/hr | ₹3,200/day | Investor network, mentorship\n\nNo booking needed for walk-ins! Which area suits you?", sources:['Hot Desks'], mode:'demo', suggested_spaces:['KOR-005','IND-002','HSR-003'] }

  if (match('price','cost','rate','how much','pricing','fee'))
    return { answer: "Quick **pricing guide** for Aurbis:\n\n| Type | From |\n|---|---|\n| Hot Desks | ₹250/hr |\n| Private Offices | ₹500/hr |\n| Conference Rooms | ₹1,200/hr |\n| Team Rooms | ₹800/hr |\n| Training Rooms | ₹3,000/hr |\n| Event Spaces | ₹10,000/hr |\n\n**Best value**: Professional Plan ₹12,000/month (40 hrs credits + 20% discount)\n\nWhich space type do you need?", sources:['Pricing Guide'], mode:'demo', suggested_spaces:[] }

  if (match('koramangala'))
    return { answer: "**Koramangala Hub** (Flagship!) has 5 great spaces:\n\n🚀 Innovation Hub — Conference, 12 pax, ₹1,500/hr\n🏆 The Boardroom — Executive, 8 pax, ₹2,000/hr\n🤝 Collaboration Zone — Team Room, 20 pax, ₹800/hr\n🌅 Sky Deck — Event, 150 pax, ₹15,000/hr\n☕ Creative Studio — Hot Desks, 30 desks, ₹350/hr\n\n📍 80 Feet Road, 4th Block | **24/7 access**", sources:['Koramangala Hub'], mode:'demo', suggested_spaces:['KOR-001','KOR-002','KOR-003','KOR-004','KOR-005'] }

  if (match('whitefield','itpl'))
    return { answer: "**Whitefield Hub** (Tech Corridor):\n\n💻 Tech Hub — Training, 40 pax, ₹5,000/hr\n⚡ Sprint Room — Agile, 10 pax, ₹1,200/hr\n🔇 Focus Pod — Private, 4 pax, ₹600/hr\n🔬 Innovation Lab — Team Suite, 25 pax, ₹2,500/hr (3D printer!)\n\n📍 ITPL Main Road | **Open 24/7**", sources:['Whitefield Hub'], mode:'demo', suggested_spaces:['WHI-001','WHI-002','WHI-003','WHI-004'] }

  if (match('indiranagar'))
    return { answer: "**Indiranagar Hub** (Creative District):\n\n🎨 The Gallery — Creative Team, 15 pax, ₹1,000/hr\n🎙️ Podcast Studio — Media Room, 4 pax, ₹2,000/hr\n🧑‍💻 Open Canvas — Hot Desks, 50 desks, ₹250/hr\n\n📍 100 Feet Road | **24/7 member access**", sources:['Indiranagar Hub'], mode:'demo', suggested_spaces:['IND-001','IND-002','IND-003'] }

  if (match('book','reserve','schedule','confirm'))
    return { answer: "I'd love to help you book a space! Let me gather the details:\n\n1. **Which space?** (e.g., Innovation Hub, Sprint Room)\n2. **Date?** (e.g., Tomorrow, 30 June)\n3. **Time?** (e.g., 2pm – 4pm)\n4. **How many people?**\n\nOr you can click **\"Book Now\"** on any space card in the explorer. I'll confirm instantly!", sources:[], mode:'demo', suggested_spaces:['KOR-001','WHI-002','MGR-001'] }

  if (match('amenities','wifi','parking','food','catering','coffee','projector'))
    return { answer: "**Standard amenities** at all Aurbis locations:\n✅ High-speed WiFi (500Mbps–1Gbps)\n✅ Air conditioning\n✅ Complimentary tea, coffee & water\n✅ Printing & scanning\n✅ 24/7 security\n\n**Premium** (select spaces):\n🎥 4K displays + Zoom/Teams certified video conferencing\n🍽️ In-room catering\n🚗 EV charging stations\n🧘 Wellness room\n🅿️ Parking + valet for events", sources:['Amenities Guide'], mode:'demo', suggested_spaces:[] }

  if (match('cancel','reschedule','refund','policy'))
    return { answer: "**Booking Policy:**\n\n📅 Min booking: 1 hour | Max advance: 90 days\n⚡ Conference rooms: 2hr advance notice\n🏟️ Event spaces: 24hr advance notice\n\n❌ **Cancellation:**\n- Free: 24+ hours before\n- 50% refund: 12–24 hours before\n- No refund: < 12 hours\n\n🔄 Free rescheduling up to 4 hrs before (subject to availability)", sources:['Booking Policy'], mode:'demo', suggested_spaces:[] }

  // Default
  return { answer: "I can help you find and book the perfect Aurbis workspace! We have **18 spaces** across **5 Bangalore locations**:\n\n📍 Koramangala | Whitefield | MG Road | Indiranagar | HSR Layout\n\nSpace types: Conference rooms, private offices, team suites, hot desks, training rooms, event spaces.\n\nWhat are you looking for? Tell me:\n- **Type of space** (meeting, event, office, hot desk)\n- **Number of people**\n- **Location preference**\n- **When** you need it", sources:['Aurbis Directory'], mode:'demo', suggested_spaces:['KOR-001','WHI-002','IND-001','MGR-001'] }
}
