"""
Aurbis AI Assistant - RAG Engine
LangChain + ChromaDB + OpenAI (with demo mode fallback)
"""
import os
import json
import re
import random
import string
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from email_service import send_booking_confirmation

load_dotenv(Path(__file__).parent / ".env")

DATA_DIR = Path(__file__).parent / "data"
CHROMA_DIR = Path(__file__).parent / "chroma_db"


def _generate_booking_id() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"AUR-{suffix}"


def _extract_capacity(text: str) -> Optional[int]:
    """Extract number of people from natural language."""
    patterns = [
        r'\bfor\s+(\d+)\b',
        r'(\d+)\s*(?:people|persons?|pax|guests?|attendees?|heads?|members?)',
        r'team\s+of\s+(\d+)',
        r'group\s+of\s+(\d+)',
        r'seats?\s+(?:for\s+)?(\d+)',
        r'(\d+)\s*(?:-|\s*)(?:seater|seat)',
        r'capacity\s+(?:of\s+)?(\d+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 500:
                return n
    return None


def _extract_email(text: str) -> Optional[str]:
    """Extract a valid email address from text."""
    m = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
    if m:
        return m.group(0).lower()
    return None


def _extract_date(text: str) -> Optional[str]:
    """Extract common date phrases, including real user typos."""
    msg = text.lower()
    tomorrow_patterns = [
        'tomorrow', 'tommrow', 'tomorow', 'tommorow', 'tommorrow',
        'tmrw', 'tmr', 'tmrw', 'tomo', 'tomrw', 'tomarrow'
    ]
    if any(pattern in msg for pattern in tomorrow_patterns):
        return 'Tomorrow'
    if any(pattern in msg for pattern in ['today', 'tonight', 'tdy']):
        return 'Today'

    for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
        if day in msg:
            return day.capitalize()

    date_match = re.search(
        r'(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{1,2}[/-]\d{1,2})',
        msg,
        re.IGNORECASE
    )
    if date_match:
        return date_match.group(1)
    return None


def _capacity_hint(cap: int) -> str:
    """One-liner hint about capacity-appropriate spaces."""
    if cap <= 4:
        return f"For {cap} people, something like **Focus Pod** or **The Boardroom** would be a perfect fit."
    elif cap <= 10:
        return f"For {cap} people, **Innovation Hub** or **Sprint Room** would work great."
    elif cap <= 20:
        return f"For {cap} people, **Collaboration Zone** or **Think Tank** would give you plenty of room."
    else:
        return f"For {cap} people, I'll find you a spacious venue that fits everyone comfortably!"

SYSTEM_PROMPT = """You are Nova, the AI workspace assistant for Aurbis — a premium managed office space provider in Bangalore. 

Your role is to help users:
1. Find the perfect workspace (conference rooms, private offices, hot desks, event spaces, training rooms)
2. Get pricing and availability information
3. Collect booking details through natural conversation
4. Answer questions about Aurbis policies, amenities, and locations

Important booking rule:
- Never say a space is booked, confirmed, reserved, locked in, or all set from RAG context alone.
- A real booking is confirmed only by the backend booking workflow after the user says yes on the final summary.
- If a user asks to book but the workflow is missing details, ask for the next missing detail instead of claiming confirmation.

Personality: Warm, professional, efficient. You speak like a knowledgeable concierge who genuinely wants to find the best solution.

When recommending spaces:
- Always mention the space name, location, capacity, and price
- Highlight the most relevant amenities for the user's use case
- Offer to help with booking

Format your responses with clear structure. Use bullet points for lists of spaces or amenities.
Keep responses concise but complete. End with a clear next step or question.

Context from Aurbis knowledge base:
{context}

Conversation history:
{chat_history}

User question: {question}

Nova's response:"""


class DemoRAG:
    """
    Intelligent demo mode — works without any API keys.
    Uses keyword-based response matching with rich Aurbis context.
    """

    SPACES_DATA: list = []

    def __init__(self):
        try:
            with open(DATA_DIR / "spaces.json") as f:
                data = json.load(f)
                self.SPACES_DATA = data.get("spaces", [])
        except Exception:
            self.SPACES_DATA = []

    def _match(self, text: str, keywords: list) -> bool:
        text_lower = text.lower()
        return any(k in text_lower for k in keywords)

    def _spaces_for_ids(self, ids: list) -> list:
        return [s for s in self.SPACES_DATA if s["id"] in ids]

    def chat(self, message: str, history: list) -> dict:
        msg = message.lower()

        # Booking confirmation flow
        if self._match(msg, ["yes", "book it", "confirm", "go ahead", "proceed", "sounds good", "perfect"]):
            if any("book" in str(h).lower() or "reserve" in str(h).lower() or "shall i" in str(h).lower() for h in history[-4:]):
                return {
                    "answer": "🎉 **Booking Confirmed!**\n\nYour space has been reserved. You'll receive a confirmation email shortly with:\n- **Booking ID**: AUR-2024-8847\n- **Access QR Code** for entry\n- **Directions** and parking info\n- **Catering menu** (optional pre-order)\n\nNeed anything else? I can help with catering, equipment, or directions.",
                    "sources": ["Booking Policy", "Aurbis One App"],
                    "mode": "demo",
                    "suggested_spaces": []
                }

        # ── Smart capacity-based suggestion ("i want a room for 3 in bangalore") ──
        cap = _extract_capacity(msg)
        if cap is not None and any(w in msg for w in ['want', 'need', 'book', 'find', 'looking', 'room', 'space', 'spot', 'got']):
            if cap <= 4:
                spaces = self._spaces_for_ids(['WHI-003', 'KOR-002', 'HSR-001'])
                answer = (
                    f"Ooh, a cozy spot for **{cap} people** — I've got just the thing! 😊\n\n"
                    f"🔇 **Focus Pod, Whitefield** — ₹600/hr · 4 pax · Private, quiet, standing desks\n"
                    f"🏆 **The Boardroom, Koramangala** — ₹2,000/hr · 8 pax · Executive feel, butler service\n"
                    f"🔒 **The Vault, HSR Layout** — ₹1,500/hr · 8 pax · Super private, NDA-friendly\n\n"
                    f"Any of these catch your eye? I can get it booked in under a minute! 🚀"
                )
            elif cap <= 10:
                spaces = self._spaces_for_ids(['KOR-001', 'WHI-002', 'IND-001'])
                answer = (
                    f"A room for **{cap} people** — nice, let me find the best options! 🙌\n\n"
                    f"🚀 **Innovation Hub, Koramangala** — ₹1,500/hr · 12 pax · Zoom Room, 85\" 4K display\n"
                    f"⚡ **Sprint Room, Whitefield** — ₹1,200/hr · 10 pax · Agile setup, tech-team favourite\n"
                    f"🎨 **Creative Hub, Indiranagar** — ₹1,200/hr · 10 pax · Great energy for creative sessions\n\n"
                    f"Just tell me which location works and I'll lock it in! 😊"
                )
            elif cap <= 25:
                spaces = self._spaces_for_ids(['KOR-003', 'MGR-003', 'WHI-004'])
                answer = (
                    f"**{cap} people** — love a good team gathering! Here are spaces built for that:\n\n"
                    f"🤝 **Collaboration Zone, Koramangala** — ₹800/hr · 20 pax · Modular, multiple screens\n"
                    f"🧠 **Think Tank, MG Road** — ₹2,500/hr · 25 pax · Strategy-ready, premium location\n"
                    f"🔬 **Innovation Lab, Whitefield** — ₹2,500/hr · 25 pax · Full team suite + maker space\n\n"
                    f"Which one feels right? I'll get it sorted for you! 🎉"
                )
            else:
                spaces = self._spaces_for_ids(['KOR-004', 'MGR-002', 'HSR-002'])
                answer = (
                    f"Wow, **{cap} people** — that's a full house! Here's what can handle the crowd:\n\n"
                    f"🌅 **Sky Deck, Koramangala** — ₹15,000/hr · up to 150 pax · Rooftop, perfect for launches\n"
                    f"🏟️ **Grand Hall, MG Road** — ₹25,000/hr · up to 300 pax · Stage, LED wall, full catering\n"
                    f"🏠 **Community Hall, HSR Layout** — ₹2,000/hr · up to 80 pax · More affordable option\n\n"
                    f"Which direction are you leaning? I'd love to make it happen! 🎊"
                )
            return {"answer": answer, "sources": ["Space Directory — All Hubs"], "mode": "demo", "suggested_spaces": [s["id"] for s in spaces]}

        # Conference / meeting room (check BEFORE events to avoid false match on 'conference')
        if self._match(msg, ["conference room", "meeting room", "boardroom", "board room", "conference call"]):
            spaces = self._spaces_for_ids(["KOR-001", "KOR-002", "WHI-002", "HSR-001"])
            return {"answer": "I have excellent **conference and meeting rooms** across all 5 Bangalore locations:\n\n📍 **Koramangala** — Innovation Hub (12 pax, ₹1,500/hr), The Boardroom (8 pax, ₹2,000/hr)\n📍 **Whitefield** — Sprint Room (10 pax, ₹1,200/hr) — tech team favourite\n📍 **HSR Layout** — The Vault (8 pax, ₹1,500/hr) — secure/confidential\n📍 **MG Road** — Think Tank (25 pax, ₹2,500/hr)\n\nHow many people, which location, and when do you need it?", "sources": ["Conference Rooms — All Hubs"], "mode": "demo", "suggested_spaces": [s["id"] for s in spaces]}

        # Event space queries
        if self._match(msg, ["event space", "event venue", "launch event", "gala", "annual", "200 people", "300 people", "large event", "product launch"]):
            spaces = self._spaces_for_ids(["KOR-004", "MGR-002", "HSR-002"])
            return {
                "answer": "For large-scale events, Aurbis has some outstanding venues:\n\n🏟️ **Grand Hall, MG Road** — ₹25,000/hr | Up to 300 guests | Professional stage, LED video wall, full catering team\n\n🌅 **Sky Deck, Koramangala** — ₹15,000/hr | Up to 150 guests | Rooftop terrace, perfect for launches and celebrations\n\n🏠 **Community Hall, HSR Layout** — ₹2,000/hr | Up to 30 guests | Great for smaller team events with outdoor access\n\nEvent spaces require **24-hour advance booking** and a minimum 3-4 hour slot. Would you like me to check availability for a specific date?",
                "sources": ["Event Spaces — MG Road Hub", "Event Spaces — Koramangala Hub"],
                "mode": "demo",
                "suggested_spaces": [s["id"] for s in spaces]
            }

        # Conference / meeting room (keyword fallback)
        if self._match(msg, ["conference", "meeting", "boardroom", "board room", "presentation", "client meeting", "meet"]):
            capacity_match = re.search(r"(\d+)\s*(?:people|persons|pax|members|seats|attendees)", msg)
            capacity = int(capacity_match.group(1)) if capacity_match else None

            if capacity and capacity <= 8:
                spaces = self._spaces_for_ids(["KOR-002", "HSR-001", "WHI-002"])
                answer = f"For a **{capacity}-person meeting**, I recommend:\n\n🏆 **The Boardroom, Koramangala** — ₹2,000/hr | 8 pax | Executive furniture, butler service, 75\" 4K display — ideal for high-stakes meetings\n\n🔒 **The Vault, HSR Layout** — ₹1,500/hr | 8 pax | Confidential, NDA-compliant, signal-blocking available\n\n⚡ **Sprint Room, Whitefield** — ₹1,200/hr | 10 pax | Agile boards, developer-favourite\n\nAll include HD video conferencing. Which location works best for you?"
            elif capacity and capacity <= 20:
                spaces = self._spaces_for_ids(["KOR-001", "KOR-003", "WHI-002"])
                answer = f"For a **{capacity}-person meeting**, here are my top picks:\n\n🚀 **Innovation Hub, Koramangala** — ₹1,500/hr | 12 pax | Zoom Room certified, 85\" 4K display, recording capability\n\n🤝 **Collaboration Zone, Koramangala** — ₹800/hr | 20 pax | Modular layout, multiple screens, standing desks\n\n⚡ **Sprint Room, Whitefield** — ₹1,200/hr | 10 pax | Best for tech teams\n\nShall I book one for you?"
            else:
                spaces = self._spaces_for_ids(["KOR-001", "KOR-002", "WHI-002", "HSR-001"])
                answer = "I have excellent **conference and meeting rooms** across all 5 Bangalore locations:\n\n📍 **Koramangala** — Innovation Hub (12 pax, ₹1,500/hr), The Boardroom (8 pax, ₹2,000/hr)\n📍 **Whitefield** — Sprint Room (10 pax, ₹1,200/hr) — tech team favourite\n📍 **HSR Layout** — The Vault (8 pax, ₹1,500/hr) — secure/confidential\n📍 **MG Road** — Think Tank (25 pax, ₹2,500/hr)\n\nHow many people, which location, and when do you need it?"

            return {"answer": answer, "sources": ["Conference Rooms — All Hubs", "Booking Policy"], "mode": "demo", "suggested_spaces": [s["id"] for s in spaces]}

        # Training room
        if self._match(msg, ["training", "workshop", "bootcamp", "teach", "instructor", "classroom", "40 people", "30 people"]):
            spaces = self._spaces_for_ids(["WHI-001", "MGR-003"])
            return {
                "answer": "For **training and workshops**, Aurbis has two great options:\n\n💻 **Tech Hub, Whitefield** — ₹5,000/hr | 40 people | 40 computer workstations, dual projectors, recording system — perfect for technical training\n\n🧠 **Think Tank, MG Road** — ₹2,500/hr | 25 people | Workshop supply kit included, design thinking setup, facilitator support available\n\nBoth have full AV, AC, and breakout areas. What type of training and how many participants?",
                "sources": ["Training Rooms — Whitefield Hub", "Workshop Rooms — MG Road Hub"],
                "mode": "demo",
                "suggested_spaces": [s["id"] for s in spaces]
            }

        # Hot desk / open workspace
        if self._match(msg, ["hot desk", "open desk", "coworking", "co-working", "individual", "freelance", "day pass", "flexible"]):
            spaces = self._spaces_for_ids(["KOR-005", "IND-002", "HSR-003"])
            return {
                "answer": "Aurbis has vibrant **hot desk and flexible workspace** options:\n\n☕ **Creative Studio, Koramangala** — ₹350/hr | ₹3,200/day | 30 desks, Nespresso bar, phone booths, dual monitors\n\n🎨 **Open Canvas, Indiranagar** — ₹250/hr | ₹2,800/day | 50 desks, in-house café, great networking community\n\n🚀 **Startup Den, HSR Layout** — ₹300/hr | ₹3,200/day | Mentorship network, investor connect, pitch practice room\n\nAll include WiFi, ergonomic seating, printing, and lockers. No booking required for walk-ins! Which suits you best?",
                "sources": ["Hot Desk Areas — All Hubs", "Membership Plans"],
                "mode": "demo",
                "suggested_spaces": [s["id"] for s in spaces]
            }

        # Pricing / cost
        if self._match(msg, ["price", "cost", "rate", "how much", "pricing", "charges", "fee", "tariff"]):
            return {
                "answer": "Here's a quick **pricing overview** for Aurbis spaces:\n\n| Space Type | Starting Price |\n|---|---|\n| Hot Desks | ₹250/hr or ₹2,800/day |\n| Private Offices | ₹500/hr |\n| Conference Rooms | ₹1,200/hr |\n| Team Suites | ₹800/hr |\n| Training Rooms | ₹3,000/hr |\n| Event Spaces | ₹10,000/hr |\n\n**Membership Plans** offer the best value:\n- 🟦 Starter: ₹5,000/month (20 hrs credits + unlimited hot desk)\n- 🟧 Professional: ₹12,000/month (40 hrs + 20% discount on all bookings)\n- 🟩 Enterprise: Custom pricing with dedicated suite\n\nWhich space type are you interested in? I'll give you the exact quote.",
                "sources": ["Pricing Guide — All Spaces", "Membership Plans"],
                "mode": "demo",
                "suggested_spaces": []
            }

        # Location-specific: Koramangala
        if self._match(msg, ["koramangala"]):
            spaces = self._spaces_for_ids(["KOR-001", "KOR-002", "KOR-003", "KOR-004", "KOR-005"])
            return {
                "answer": "**Koramangala Hub** (our flagship!) has 5 spaces available:\n\n🚀 **Innovation Hub** — Conference, 12 pax, ₹1,500/hr\n🏆 **The Boardroom** — Executive, 8 pax, ₹2,000/hr\n🤝 **Collaboration Zone** — Team Room, 20 pax, ₹800/hr\n🌅 **Sky Deck** — Event Space, 150 pax, ₹15,000/hr\n☕ **Creative Studio** — Hot Desks, 30 desks, ₹350/hr\n\nAddress: 80 Feet Road, 4th Block, Koramangala | **24/7 access**\n\nWhich space interests you?",
                "sources": ["Koramangala Hub — Space Directory"],
                "mode": "demo",
                "suggested_spaces": [s["id"] for s in spaces]
            }

        # Location-specific: Whitefield
        if self._match(msg, ["whitefield", "itpl"]):
            spaces = self._spaces_for_ids(["WHI-001", "WHI-002", "WHI-003", "WHI-004"])
            return {
                "answer": "**Whitefield Hub** (Tech Corridor) has 4 excellent spaces:\n\n💻 **Tech Hub** — Training Room, 40 pax, ₹5,000/hr\n⚡ **Sprint Room** — Agile Conference, 10 pax, ₹1,200/hr\n🔇 **Focus Pod** — Private Office, 4 pax, ₹600/hr\n🔬 **Innovation Lab** — Team Suite with 3D printer, 25 pax, ₹2,500/hr\n\nAddress: ITPL Main Road, Whitefield | **Open 24/7**\n\nWhat type of space do you need?",
                "sources": ["Whitefield Hub — Space Directory"],
                "mode": "demo",
                "suggested_spaces": [s["id"] for s in spaces]
            }

        # Location-specific: expanded Bangalore hubs
        expanded_hubs = [
            (["bannerghatta", "bannerghatta road"], "Bannerghatta Road", ["BAN-001", "BAN-002"], "Bannerghatta Road | Event-friendly, quiet offices, valet options"),
            (["sarjapur", "sarjapur road"], "Sarjapur Road", ["SAR-001", "SAR-002", "SAR-003"], "Sarjapur Road | Startup and training-focused hub"),
            (["bellandur"], "Bellandur", ["BEL-001", "BEL-002", "BEL-003"], "Bellandur | Lake-view suites, agile rooms, large events"),
            (["yelahanka"], "Yelahanka", ["YEL-001", "YEL-002", "YEL-003"], "Yelahanka | Quiet, affordable, north Bangalore hub"),
        ]
        for keywords, hub_name, ids, address in expanded_hubs:
            if self._match(msg, keywords):
                spaces = self._spaces_for_ids(ids)
                lines = [
                    f"• **{s['name']}** — {s['type_label']}, {s['capacity']} pax, ₹{s['pricing']['hourly']:,}/hr"
                    for s in spaces
                ]
                return {
                    "answer": f"**{hub_name} Hub** has {len(spaces)} spaces available:\n\n" + "\n".join(lines) + f"\n\nAddress: {address}\n\nTell me your team size, date, and budget — I can shortlist the best option or book it for you.",
                    "sources": [f"{hub_name} Hub — Space Directory"],
                    "mode": "demo",
                    "suggested_spaces": [s["id"] for s in spaces]
                }

        # Amenities
        if self._match(msg, ["amenities", "facilities", "wifi", "parking", "food", "catering", "coffee", "projector", "av", "video"]):
            return {
                "answer": "All Aurbis spaces include **standard amenities**:\n✅ High-speed WiFi (500Mbps – 1Gbps)\n✅ Air conditioning\n✅ Complimentary tea, coffee & water\n✅ Printing & scanning\n✅ 24/7 security\n✅ Visitor management\n\n**Premium amenities** (available in select spaces):\n🎥 4K displays & Zoom Room certified video conferencing\n🍽️ In-room catering service\n🚗 EV charging stations\n🧘 Wellness & meditation room\n💻 IT support on-call\n🅿️ Parking (limited; valet for executive bookings)\n\nAny specific amenity you need? I'll find spaces that have it!",
                "sources": ["Amenities Guide — All Locations"],
                "mode": "demo",
                "suggested_spaces": []
            }

        # Cancellation / booking policy
        if self._match(msg, ["cancel", "reschedule", "refund", "policy", "rules", "minimum", "advance"]):
            return {
                "answer": "Here's the Aurbis **booking policy**:\n\n📅 **Booking Rules**\n- Minimum booking: 1 hour\n- Advance notice: 2 hours (meeting rooms), 24 hours (event spaces)\n- Max advance booking: 90 days\n\n❌ **Cancellation Policy**\n- Free cancellation: up to 24 hours before\n- 50% refund: 12–24 hours before\n- No refund: less than 12 hours before\n- Event spaces: 72-hour notice for full refund\n\n🔄 **Rescheduling**\nFree rescheduling up to 4 hours before your booking (subject to availability)\n\nNeed help with a specific booking?",
                "sources": ["Booking Policy — Aurbis"],
                "mode": "demo",
                "suggested_spaces": []
            }

        # Greeting / start
        if self._match(msg, ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "start", "help"]) or len(msg.split()) <= 3:
            return {
                "answer": "👋 Hi! I'm **Nova**, your Aurbis AI Workspace Assistant.\n\nI can help you:\n🔍 **Find** the perfect space (meeting rooms, offices, event venues, hot desks)\n💰 **Compare** prices and amenities across 13 Bangalore areas\n📅 **Book** spaces instantly through natural conversation\n❓ **Answer** any questions about Aurbis\n\nWhat are you looking for today? Try asking:\n- *\"I need a conference room for 10 people in Bellandur tomorrow at 2pm\"*\n- *\"What's your cheapest event space near Bannerghatta?\"*\n- *\"Find a Sarjapur training room for 30 people\"*",
                "sources": [],
                "mode": "demo",
                "suggested_spaces": ["KOR-001", "BEL-002", "SAR-003"]
            }

        # Private office
        if self._match(msg, ["private office", "office space", "dedicated", "team suite", "for my team"]):
            spaces = self._spaces_for_ids(["MGR-001", "WHI-003", "BEL-001", "BAN-002", "YEL-001"])
            return {
                "answer": "Aurbis has great **private office** options across premium and budget ranges:\n\n🏙️ **Executive Suite, MG Road** — ₹3,000/hr | 6 pax | City view, butler service, VIP setup\n\n🌊 **Lake View Suite, Bellandur** — ₹2,500/hr | 8 pax | Premium lake view, executive feel\n\n🔇 **Focus Pod, Whitefield** — ₹600/hr | 4 pax | Private, quiet, dedicated internet\n\n🌿 **Serenity Suite, Yelahanka** — ₹550/hr | 5 pax | Peaceful garden-view focus space\n\nFor **monthly private offices**, prices start at ₹30,000/month. Want premium, quiet, or budget-friendly?",
                "sources": ["Private Offices — All Hubs", "Monthly Plans"],
                "mode": "demo",
                "suggested_spaces": [s["id"] for s in spaces]
            }

        # Startup / accelerator
        if self._match(msg, ["startup", "accelerator", "founder", "entrepreneur", "early stage"]):
            spaces = self._spaces_for_ids(["HSR-003", "IND-002"])
            return {
                "answer": "Aurbis is a **startup-favourite** workspace! Here's what we offer founders:\n\n🚀 **Startup Den, HSR Layout** — ₹300/hr | Built for early-stage startups | Mentorship network, investor connect programs, pitch practice room\n\n🎨 **Open Canvas, Indiranagar** — ₹250/hr | 50-desk community hub | Active startup community, networking events\n\n💡 **Special Startup Perks**:\n- Discounted Starter membership (₹5,000/month)\n- Access to Aurbis Founders Network\n- Pitch events hosted monthly\n- Investor introductions through our ecosystem\n\nInterested in joining the Aurbis startup community?",
                "sources": ["Startup Ecosystem — HSR Hub", "Community Programs"],
                "mode": "demo",
                "suggested_spaces": [s["id"] for s in spaces]
            }

        # Default — general availability / what do you have
        spaces = self._spaces_for_ids(["KOR-001", "WHI-002", "IND-001", "MGR-001", "BEL-002", "SAR-001", "BAN-001", "YEL-002"])
        return {
            "answer": f"I'd love to help you find the right Aurbis workspace! We have **{len(self.SPACES_DATA)} spaces** across **13 Bangalore areas**:\n\n📍 **Koramangala, Whitefield, MG Road, Indiranagar, HSR Layout** — core premium hubs\n📍 **Electronic City, Hebbal, Jayanagar, Marathahalli** — expanded business hubs\n📍 **Bannerghatta Road, Sarjapur Road, Bellandur, Yelahanka** — new demo database additions\n\nCould you tell me more about:\n1. **What type of space** you need (meeting, office, event, hot desk)?\n2. **How many people**?\n3. **Which area of Bangalore**?\n4. **When** do you need it?",
            "sources": ["Aurbis Space Directory — All Locations"],
            "mode": "demo",
            "suggested_spaces": [s["id"] for s in spaces]
        }


class AurbisRAG:
    """
    Main RAG engine — uses LangChain + ChromaDB + OpenAI when available,
    falls back to DemoRAG automatically.
    RAG setup runs in a background thread so the server starts instantly.
    """

    def __init__(self):
        self.retriever = None
        self.llm = None
        self.session_histories: dict = {}
        self.booking_sessions: dict = {}
        self.last_bookings: dict = {}   # remembers last confirmed booking per session
        self.spaces_catalog = self._load_spaces_catalog()
        self.demo = DemoRAG()
        self.use_rag = False
        self.rag_backend = "demo"
        # Setup Ollama RAG synchronously so server is NEVER in demo mode
        self._try_setup_rag()

    # ── Booking Flow Helpers ───────────────────────────────────────────────────

    def _detect_booking_intent(self, msg: str) -> bool:
        keywords = ['book', 'reserve', 'reservation', 'want to book', 'wanna book',
                    'wnna book', 'need to book', 'id like to book', 'i want a room',
                    'book a room', 'book a space', 'schedule a']
        return any(k in msg.lower() for k in keywords)

    def _detect_rebooking(self, msg: str) -> bool:
        """Detect 'same booking but in X' style re-booking intent."""
        patterns = ['same booking', 'same again', 'same but', 'do the same',
                    'repeat the booking', 'book the same', 'same one', 'same space',
                    'can u do the same', 'same thing']
        return any(p in msg.lower() for p in patterns)

    def _extract_name(self, msg: str) -> Optional[str]:
        patterns = [
            r'in\s+the\s+name\s+of\s+([a-zA-Z]+)',
            r'name\s+of\s+([a-zA-Z]+)',
            r'(?:my\s+name\s+is|name\s+is|i\s+am|iam|i\'m)\s+([a-zA-Z]+)',
            r'for\s+([A-Z][a-zA-Z]+)\b',          # "for Surya"
            r'under\s+([A-Z][a-zA-Z]+)\b',         # "under Surya"
        ]
        for p in patterns:
            m = re.search(p, msg, re.IGNORECASE)
            if m:
                name = m.group(1).strip().capitalize()
                if name.lower() not in {'a', 'an', 'the', 'me', 'us', 'our', 'you', 'hi', 'hey'}:
                    return name
        return None

    def _extract_time(self, msg: str) -> Optional[str]:
        m = re.search(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm))', msg, re.IGNORECASE)
        return m.group(1).upper() if m else None

    def _extract_location(self, msg: str) -> Optional[str]:
        # Ordered from most-specific to avoid partial matches
        loc_patterns = [
            (['koramangala', 'koramanagla', 'koramanagal', 'koraman', 'korama'], 'Koramangala'),
            (['whitefield', 'whitefild', 'whitefiled', 'white field', 'whitefeild', 'itpl'], 'Whitefield'),
            (['mg road', 'mgroad', 'mg rd', 'brigade road', 'brigade', 'mg'], 'MG Road'),
            (['indiranagar', 'indira nagar', 'indiranager', 'indranagar', 'indiranagr'], 'Indiranagar'),
            (['hsr layout', 'hsr', 'h.s.r'], 'HSR Layout'),
            (['electronic city', 'electroniccity', 'e city', 'ecity'], 'Electronic City'),
            (['hebbal'], 'Hebbal'),
            (['jayanagar', 'jaya nagar'], 'Jayanagar'),
            (['marathahalli', 'marathalli'], 'Marathahalli'),
            (['bannerghatta road', 'bannerghatta'], 'Bannerghatta Road'),
            (['sarjapur road', 'sarjapur'], 'Sarjapur Road'),
            (['bellandur'], 'Bellandur'),
            (['yelahanka'], 'Yelahanka'),
        ]
        msg_lower = msg.lower()
        for patterns, val in loc_patterns:
            if any(p in msg_lower for p in patterns):
                return val
        return None

    def _load_spaces_catalog(self) -> list[dict]:
        try:
            with open(DATA_DIR / "spaces.json") as f:
                return json.load(f).get("spaces", [])
        except Exception:
            return []

    def _booking_type_label(self, type_key: str) -> str:
        return {
            'conference': 'Conference Room',
            'event': 'Event Space',
            'office': 'Private Office',
            'desk': 'Hot Desk',
        }.get(type_key, type_key or 'Space')

    def _extract_booking_type(self, msg: str) -> Optional[str]:
        text = msg.lower()
        if any(w in text for w in ['conference', 'meeting', 'boardroom', 'scrum', 'sprint room', 'vault']) or re.search(r'\broom\b', text):
            return 'conference'
        if any(w in text for w in ['event', 'hall', 'venue', 'auditorium', 'launch', 'community hall']):
            return 'event'
        if any(w in text for w in ['office', 'private', 'cabin', 'suite', 'pod']):
            return 'office'
        if any(w in text for w in ['desk', 'hot desk', 'cowork', 'startup den', 'accelerator']):
            return 'desk'
        return None

    def _space_to_booking_type(self, space: dict) -> str:
        text = f"{space.get('type', '')} {space.get('type_label', '')} {space.get('name', '')}".lower()
        capacity = space.get('capacity') or 0
        if 'private' in text or 'office' in text or 'cabin' in text:
            return 'office'
        if 'desk' in text or 'cowork' in text or 'accelerator' in text:
            return 'desk'
        if 'event' in text or 'hall' in text or 'auditorium' in text or 'venue' in text or capacity >= 60:
            return 'event'
        return 'conference'

    def _price_label(self, space: dict) -> str:
        hourly = (space.get('pricing') or {}).get('hourly')
        return f"₹{hourly:,}/hr" if hourly else "Price on request"

    def _manual_booking_options(self, cap: int = 0) -> dict:
        def option(space_id, space_name, location, space_type, price):
            return {
                'space_id': space_id,
                'space_name': space_name,
                'location': location,
                'space_type': space_type,
                'price': price,
            }
        return {
            'koramangala_conference': option('KOR-002', 'The Boardroom', 'Koramangala', 'conference', '₹2,000/hr') if cap <= 8 else option('KOR-001', 'Innovation Hub', 'Koramangala', 'conference', '₹1,500/hr'),
            'koramangala_event':      option('KOR-004', 'Sky Deck', 'Koramangala', 'event', '₹15,000/hr'),
            'koramangala_office':     option('KOR-002', 'The Boardroom', 'Koramangala', 'office', '₹2,000/hr'),
            'koramangala_desk':       option('KOR-005', 'Creative Studio', 'Koramangala', 'desk', '₹350/hr'),
            'whitefield_conference':  option('WHI-003', 'Focus Pod', 'Whitefield', 'conference', '₹600/hr') if cap and cap <= 4 else option('WHI-002', 'Sprint Room', 'Whitefield', 'conference', '₹1,200/hr'),
            'whitefield_office':      option('WHI-003', 'Focus Pod', 'Whitefield', 'office', '₹600/hr'),
            'whitefield_event':       option('WHI-001', 'Tech Hub', 'Whitefield', 'event', '₹5,000/hr'),
            'mg road_conference':     option('MGR-003', 'Think Tank', 'MG Road', 'conference', '₹2,500/hr'),
            'mg road_event':          option('MGR-002', 'Grand Hall', 'MG Road', 'event', '₹25,000/hr'),
            'mg road_office':         option('MGR-001', 'Executive Suite', 'MG Road', 'office', '₹3,000/hr'),
            'indiranagar_conference': option('IND-001', 'The Gallery', 'Indiranagar', 'conference', '₹1,000/hr'),
            'indiranagar_desk':       option('IND-002', 'Open Canvas', 'Indiranagar', 'desk', '₹250/hr'),
            'hsr layout_conference':  option('HSR-001', 'The Vault', 'HSR Layout', 'conference', '₹1,500/hr'),
            'hsr layout_desk':        option('HSR-003', 'Startup Den', 'HSR Layout', 'desk', '₹300/hr'),
            'hsr layout_event':       option('HSR-002', 'Community Hall', 'HSR Layout', 'event', '₹2,000/hr'),
        }

    def _get_booking_option(self, location: str, space_type: str, cap: int = 0, preferred_space_id: Optional[str] = None) -> Optional[dict]:
        location_key = (location or '').lower()
        if preferred_space_id:
            for option in self._manual_booking_options(cap).values():
                if option['space_id'] == preferred_space_id:
                    return option
            for space in self.spaces_catalog:
                if space.get('id') == preferred_space_id:
                    return {
                        'space_id': space.get('id'),
                        'space_name': space.get('name'),
                        'location': space.get('location'),
                        'space_type': self._space_to_booking_type(space),
                        'price': self._price_label(space),
                    }

        manual = self._manual_booking_options(cap).get(f"{location_key}_{space_type}")
        if manual:
            return manual

        candidates = []
        for space in self.spaces_catalog:
            if (space.get('location') or '').lower() != location_key:
                continue
            if self._space_to_booking_type(space) != space_type:
                continue
            capacity = space.get('capacity') or 0
            if cap and capacity < cap:
                continue
            candidates.append(space)

        if not candidates:
            return None
        candidates.sort(key=lambda s: ((s.get('capacity') or 999) - cap if cap else 0, -float(s.get('rating') or 0)))
        selected = candidates[0]
        return {
            'space_id': selected.get('id'),
            'space_name': selected.get('name'),
            'location': selected.get('location'),
            'space_type': self._space_to_booking_type(selected),
            'price': self._price_label(selected),
        }

    def _available_booking_types(self, location: str, cap: int = 0) -> list[str]:
        available = []
        for type_key in ['conference', 'desk', 'event', 'office']:
            if self._get_booking_option(location, type_key, cap):
                available.append(type_key)
        return available

    def _extract_space_option(self, msg: str, cap: int = 0) -> Optional[dict]:
        def normalize(text: str) -> str:
            return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', text.lower())).strip()

        normalized_msg = f" {normalize(msg)} "
        options = list(self._manual_booking_options(cap).values())
        seen = {option['space_id'] for option in options}
        for space in self.spaces_catalog:
            if space.get('id') in seen:
                continue
            options.append({
                'space_id': space.get('id'),
                'space_name': space.get('name'),
                'location': space.get('location'),
                'space_type': self._space_to_booking_type(space),
                'price': self._price_label(space),
            })
        options.sort(key=lambda option: len(option['space_name'] or ''), reverse=True)
        for option in options:
            name = normalize(option.get('space_name') or '')
            if name and f" {name} " in normalized_msg:
                return option
        return None

    def _apply_booking_updates_from_message(self, booking: dict, message: str) -> bool:
        changed = False
        cap = booking.get('capacity') or 0
        requested_location = self._extract_location(message)
        requested_space = self._extract_space_option(message, cap)
        requested_type = self._extract_booking_type(message)
        requested_date = _extract_date(message)
        requested_time = self._extract_time(message)
        requested_capacity = _extract_capacity(message)
        requested_email = _extract_email(message)

        if requested_location:
            booking['location'] = requested_location
            preferred_space_id = booking.get('_preferred_space_id')
            if preferred_space_id:
                preferred = self._get_booking_option('', '', cap, preferred_space_id)
                if preferred and (preferred.get('location') or '').lower() != requested_location.lower():
                    booking.pop('_preferred_space_id', None)
            changed = True
        if requested_capacity:
            booking['capacity'] = requested_capacity
            cap = requested_capacity
            changed = True
        if requested_date:
            booking['date'] = requested_date
            changed = True
        if requested_time:
            booking['time'] = requested_time
            changed = True
        if requested_email:
            booking['email'] = requested_email
            changed = True

        if requested_space:
            booking['space_type'] = requested_space['space_type']
            if requested_location and requested_location.lower() != (requested_space.get('location') or '').lower():
                replacement = self._get_booking_option(requested_location, requested_space['space_type'], cap)
                if replacement:
                    booking.pop('_preferred_space_id', None)
                    booking['_space_correction'] = (
                        f"{requested_space['space_name']} is in {requested_space['location']}; "
                        f"for {requested_location}, I selected {replacement['space_name']} instead."
                    )
                else:
                    booking['_space_correction'] = f"{requested_space['space_name']} is in {requested_space['location']}, not {requested_location}."
            else:
                booking['location'] = requested_space['location']
                booking['_preferred_space_id'] = requested_space['space_id']
                booking.pop('_space_correction', None)
            changed = True
        elif requested_type:
            booking['space_type'] = requested_type
            booking.pop('_preferred_space_id', None)
            booking.pop('_space_correction', None)
            changed = True

        return changed

    def _handle_booking_flow(self, session_id: str, message: str, history: list) -> Optional[dict]:
        """Multi-step conversational booking. Returns response dict or None to fall through."""
        booking = self.booking_sessions.get(session_id, {})
        msg = message.lower().strip()

        # Cancel active booking
        if booking and any(w in msg for w in ['cancel', 'nevermind', 'never mind', 'stop', 'forget it', 'no thanks']):
            name = booking.get('name', '')
            del self.booking_sessions[session_id]
            sign_off = f" Take care, **{name}**!" if name else ""
            return {"answer": f"No worries at all! I've cleared that out.{sign_off} Whenever you're ready to book, just say the word 😊", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}
        # ── Same booking in a different location ──────────────────────────────
        if not booking and self._detect_rebooking(message):
            last = self.last_bookings.get(session_id)
            if last:
                new_loc = self._extract_location(message)
                if not new_loc:
                    return {"answer": f"Sure! Which location would you like for this one?\n\n• **Koramangala** · **Whitefield** · **MG Road** · **Indiranagar** · **HSR Layout**", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}
                # Check if that location has the required space type
                loc_key = new_loc.lower()
                type_key = last.get('space_type', 'conference')
                available = [
                    'koramangala_conference','koramangala_event','koramangala_office','koramangala_desk',
                    'whitefield_conference','whitefield_office','whitefield_event',
                    'mg road_conference','mg road_event','mg road_office',
                    'indiranagar_conference','indiranagar_desk',
                    'hsr layout_conference','hsr layout_desk','hsr layout_event',
                ]
                type_labels = {'conference': 'Conference Room', 'event': 'Event Space', 'office': 'Private Office', 'desk': 'Hot Desk'}
                if f"{loc_key}_{type_key}" not in available:
                    # Tell them what IS available at that location
                    loc_types = [t.split('_',1)[1] for t in available if t.startswith(loc_key+'_')]
                    if not loc_types:
                        return {"answer": f"Sorry, we don't have any spaces in **{new_loc}** yet. Try Koramangala, Whitefield, MG Road, Indiranagar, or HSR Layout!", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}
                    readable = ' / '.join(type_labels.get(t, t).replace(' Room','').replace(' Space','') for t in loc_types)
                    return {"answer": f"Sorry, we don't have a **{type_labels.get(type_key, type_key)}** in **{new_loc}**.\n\nWe do have: **{readable}** there. Would any of those work?", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}
                # All good — pre-fill and jump to confirming
                booking = {
                    'step': 'confirming',
                    'name': last['name'],
                    'space_type': type_key,
                    'location': new_loc,
                    'date': last.get('date', 'Today'),
                    'time': last.get('time', '3:00 PM'),
                    'capacity': last.get('capacity'),
                    'email': last.get('email'),
                    '_rebooking': True,
                }
                self.booking_sessions[session_id] = booking
                type_label = type_labels.get(type_key, type_key)
                cap_row = f"| \U0001f465 **Capacity** | {booking['capacity']} people |\n" if booking.get('capacity') else ""
                return {
                    "answer": f"Got it! Here's your re-booking for **{new_loc}** \U0001f447\n\n| | |\n|---|---|\n| \U0001f464 **Guest** | {booking['name']} |\n| \U0001f3e2 **Space** | {type_label} |\n| \U0001f4cd **Location** | {new_loc} |\n{cap_row}| \U0001f4c5 **Date** | {booking['date']} |\n| \U0001f550 **Time** | {booking['time']} |\n\nShall I confirm? Say **yes** to lock it in! \u2705",
                    "sources": [], "mode": self.rag_backend, "suggested_spaces": []
                }
            else:
                # No previous booking to repeat — fall through to normal intent detection
                pass
        # Start a new booking flow on intent detection
        if not booking and self._detect_booking_intent(message):
            booking = {
                'step': 'start',
                'name': self._extract_name(message),
                'time': self._extract_time(message),
                'location': self._extract_location(message),
                'space_type': None,
                'date': _extract_date(message),
                'capacity': _extract_capacity(message),
            }
            if any(w in msg for w in ['conference room', 'meeting room', 'boardroom', 'conference call']):
                booking['space_type'] = 'conference'
            elif any(w in msg for w in ['event space', 'event venue', 'event hall']):
                booking['space_type'] = 'event'
            elif any(w in msg for w in ['private office', 'office space', 'dedicated office']):
                booking['space_type'] = 'office'
            elif any(w in msg for w in ['hot desk', 'cowork', 'open desk']):
                booking['space_type'] = 'desk'
            # Auto-infer type from capacity when not specified
            elif booking['capacity'] and booking['capacity'] >= 30 and not booking['space_type']:
                booking['space_type'] = 'event'
            self.booking_sessions[session_id] = booking

        if not booking:
            return None  # Not in a booking flow

        # Handle user input at each step
        step = booking.get('step', 'start')

        # ── Name correction allowed at ANY step ───────────────────────────
        if step != 'awaiting_name' and re.search(
                r'(?:my\s+name\s+is|i\s+am\s+called|call\s+me|iam|i\'m)\s+([a-zA-Z]+)',
                message, re.IGNORECASE):
            corrected = self._extract_name(message)
            if corrected:
                booking['name'] = corrected

        message_updated_booking = False
        if step != 'awaiting_name':
            message_updated_booking = self._apply_booking_updates_from_message(booking, message)

        if step == 'awaiting_name':
            # Self-reference phrases mean "use the name I already gave you"
            is_self_ref = bool(re.search(
                r'\b(in\s+my\s+name|my\s+name|use\s+my\s+name|book\s+(it\s+)?in\s+my|same\s+name)\b',
                msg))
            extracted = self._extract_name(message)
            if extracted:
                booking['name'] = extracted
            elif is_self_ref:
                # Look back through history for their name (e.g. "hi iam surya")
                for entry in reversed(history or []):
                    if entry.get('role') == 'user':
                        hist_name = self._extract_name(entry.get('content', ''))
                        if hist_name:
                            booking['name'] = hist_name
                            break
            else:
                # Last-resort: first meaningful non-stopword
                _stop = {'in', 'my', 'the', 'a', 'an', 'me', 'it', 'is', 'ok',
                         'yes', 'no', 'hi', 'hey', 'book', 'please'}
                words = [w for w in message.strip().split()
                         if len(w) > 1 and w.lower() not in _stop]
                if words:
                    booking['name'] = words[0].capitalize()

        elif step == 'awaiting_type':
            # Only treat a bare single digit as a shortcut ('1' → conference, etc.)
            shortcut = msg.strip() if re.match(r'^\d$', msg.strip()) else None
            if any(w in msg for w in ['conference', 'meeting', 'conf', 'boardroom', 'room']) or shortcut == '1':
                booking['space_type'] = 'conference'
            elif any(w in msg for w in ['event', 'hall', 'venue', 'launch']) or shortcut == '2':
                booking['space_type'] = 'event'
            elif any(w in msg for w in ['office', 'private']) or shortcut == '3':
                booking['space_type'] = 'office'
            elif any(w in msg for w in ['desk', 'hot', 'cowork', 'flexible']) or shortcut == '4':
                booking['space_type'] = 'desk'
            elif self._extract_time(message) or _extract_date(message):
                # User skipped the type step and gave a date/time — default conference + extract datetime now
                booking['space_type'] = 'conference'
                t = self._extract_time(message)
                if t:
                    booking['time'] = t
                date_val = _extract_date(message)
                if date_val:
                    booking['date'] = date_val
            else:
                # "any", "you suggest", "doesn't matter", unrecognised → pick best for them
                cap = booking.get('capacity') or 0
                booking['space_type'] = 'event' if cap >= 30 else 'conference'
                booking['_type_auto'] = True

        elif step == 'awaiting_location':
            loc = self._extract_location(message)
            if loc:
                booking['location'] = loc
            else:
                # Only standalone single digit as shortcuts
                shortcut = msg.strip() if re.match(r'^\d$', msg.strip()) else None
                if shortcut == '1':   booking['location'] = 'Koramangala'
                elif shortcut == '2': booking['location'] = 'Whitefield'
                elif shortcut == '3': booking['location'] = 'MG Road'
                elif shortcut == '4': booking['location'] = 'Indiranagar'
                elif shortcut == '5': booking['location'] = 'HSR Layout'
                elif any(w in msg for w in ['any', 'suggest', 'you pick', 'you choose', 'wherever', 'anywhere', 'up to you', 'whatever', 'fine', 'ok', 'okay']):
                    booking['location'] = 'Koramangala'
                    booking['_loc_auto'] = True

        elif step == 'awaiting_alternative':
            available_types = booking.get('_available_types') or self._available_booking_types(
                booking.get('location'), booking.get('capacity') or 0
            )
            selected_type = booking.get('space_type') if message_updated_booking else self._extract_booking_type(message)
            if not selected_type and any(w in msg for w in [
                'yes', 'sure', 'ok', 'okay', 'fine', 'go ahead', 'book it', 'proceed',
                'whatever', 'wharever', 'what ever', 'works', 'any', 'you choose', 'you pick'
            ]):
                selected_type = available_types[0] if available_types else None

            if selected_type in available_types:
                booking['space_type'] = selected_type
                booking.pop('_available_types', None)
                booking['step'] = 'start'
            else:
                readable = ', '.join(self._booking_type_label(t) for t in available_types) or 'another available space'
                return {
                    "answer": f"I can switch it, but that option is not available in **{booking.get('location', 'this location')}**. Pick one of these: **{readable}**.",
                    "sources": [],
                    "mode": self.rag_backend,
                    "suggested_spaces": []
                }

        elif step == 'awaiting_datetime':
            t = self._extract_time(message)
            if t: booking['time'] = t
            date_val = _extract_date(message)
            if date_val:
                booking['date'] = date_val
            # "anytime", "flexible", "fine", "ok", "any" etc. → default Today 3PM
            if not booking.get('date') and not booking.get('time'):
                if any(w in msg for w in ['anytime', 'any time', 'flexible', 'whenever', 'up to you', 'you decide', 'you pick', 'asap', 'now', 'fine', 'ok', 'okay', 'sure', 'any', 'doesn\'t matter', 'works for me']):
                    booking['date'] = 'Today'
                    booking['time'] = '3:00 PM'
                    booking['_dt_auto'] = True

        elif step == 'awaiting_email':
            email = _extract_email(message)
            if email:
                booking['email'] = email
            elif any(w in msg for w in ['skip', 'no email', 'no thanks', 'pass', 'none', 'nope']):
                booking['email'] = None
            else:
                # Not a valid email — re-prompt
                return {"answer": f"Hmm, that doesn't look like a valid email address. Could you type it again? (e.g. **yourname@gmail.com**)\n\nOr say **skip** to proceed without email confirmation.", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        elif step == 'confirming':
            if any(w in msg for w in ['yes','confirm','go ahead','book it','proceed','sure','ok','okay','yep','yeah','perfect','great','done']):
                # ── CONFIRM BOOKING ────────────────────────────────────────────
                booking_id = _generate_booking_id()
                loc_key = (booking.get('location') or 'koramangala').lower()
                type_key = booking.get('space_type') or 'conference'
                cap = booking.get('capacity') or 0
                name = booking.get('name') or 'Guest'
                date = booking.get('date') or 'Today'
                time_val = booking.get('time') or '11:00 PM'
                loc_display = booking.get('location') or 'Koramangala'
                user_email = booking.get('email')
                selected_option = self._get_booking_option(loc_display, type_key, cap, booking.get('_preferred_space_id'))
                if not selected_option:
                    available_types = self._available_booking_types(loc_display, cap)
                    booking['_available_types'] = available_types
                    booking['step'] = 'awaiting_alternative'
                    self.booking_sessions[session_id] = booking
                    readable = ', '.join(self._booking_type_label(t) for t in available_types)
                    type_display = self._booking_type_label(type_key)
                    if readable:
                        return {"answer": f"Sorry, we don't have a **{type_display}** in **{loc_display}**.\n\nAvailable there: **{readable}**. Reply with one of those and I'll switch this booking right away.", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}
                    return {"answer": f"Sorry, we don't have any spaces in **{loc_display}** yet.", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

                space_id = selected_option['space_id']
                space_name = selected_option['space_name']
                price = selected_option['price']
                loc_display = selected_option['location']

                booking_details = {
                    "booking_id": booking_id,
                    "name": name,
                    "space_name": space_name,
                    "space_id": space_id,
                    "location": loc_display,
                    "date": date,
                    "time": time_val,
                    "price": price,
                    "email": user_email,
                    "email_sent": False,
                }

                # Send confirmation email if we have one
                email_note = ""
                if user_email:
                    sent = send_booking_confirmation(user_email, booking_details)
                    booking_details["email_sent"] = sent
                    email_note = f"\n\n📧 Confirmation email sent to **{user_email}**" if sent else f"\n\n⚠️ Couldn't send email to {user_email} — check Gmail config in .env"
                # Remember this booking for re-booking flows
                self.last_bookings[session_id] = booking_details
                del self.booking_sessions[session_id]
                return {
                    "answer": f"🎉 Done and dusted, **{name}**! Your spot at **{space_name}**, {loc_display} is all confirmed.{email_note}\n\nBooking ID: `{booking_id}`",
                    "sources": ["Booking System"],
                    "mode": self.rag_backend,
                    "suggested_spaces": [space_id],
                    "booking_confirmed": True,
                    "booking_details": booking_details
                }
            elif message_updated_booking or self._detect_booking_intent(message):
                booking['step'] = 'start'
            else:
                del self.booking_sessions[session_id]
                return {"answer": f"No worries, **{booking.get('name', 'friend')}**! I've cleared that out — no charges at all. Whenever you want to try again, just say the word! 😊", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        # Save updated state and ask for the next missing piece
        self.booking_sessions[session_id] = booking
        name      = booking.get('name')
        space_type = booking.get('space_type')
        location   = booking.get('location')
        date       = booking.get('date')
        time_val   = booking.get('time')
        type_labels = {'conference': 'Conference Room', 'event': 'Event Space', 'office': 'Private Office', 'desk': 'Hot Desk'}

        if not name:
            booking['step'] = 'awaiting_name'
            self.booking_sessions[session_id] = booking
            cap = booking.get('capacity')
            if cap:
                hint = _capacity_hint(cap)
                intro = f"Love it! A space for **{cap} people** — {hint}\n\nBut first — what **name** should I put the reservation under? 😊"
            else:
                intro = "Sure thing! What **name** should I put this reservation under? 😊"
            return {"answer": intro, "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        if not space_type:
            booking['step'] = 'awaiting_type'
            self.booking_sessions[session_id] = booking
            cap = booking.get('capacity')
            if cap and cap <= 12:
                type_hint = f" For **{cap} people**, a conference room usually hits the spot — but happy to go a different route!"
            elif cap and cap <= 50:
                type_hint = f" For **{cap} people**, a larger room or team suite would be ideal."
            else:
                type_hint = ""
            return {"answer": f"Nice, **{name}**!{type_hint} What kind of space are you after?\n\n🏢 **Conference / Meeting Room**\n🎪 **Event Space** — launches & large gatherings\n💼 **Private Office** — focused, dedicated work\n☕ **Hot Desk** — flexible co-working vibes", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        if not location:
            booking['step'] = 'awaiting_location'
            self.booking_sessions[session_id] = booking
            type_display = type_labels.get(space_type, space_type)
            return {"answer": f"A **{type_display}** for **{name}** — love it! 🙌\n\nWe've got 5 great spots across Bangalore — which area works for you?\n\n• **Koramangala** — Our flagship, buzzing energy\n• **Whitefield** — Tech corridor, great for dev teams\n• **MG Road** — Premium central location\n• **Indiranagar** — Creative & chill vibe\n• **HSR Layout** — Startup scene, community feel", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        preview_option = self._get_booking_option(location, space_type, booking.get('capacity') or 0, booking.get('_preferred_space_id')) if location and space_type else None
        if location and space_type and not preview_option:
            available_types = self._available_booking_types(location, booking.get('capacity') or 0)
            booking['_available_types'] = available_types
            booking['step'] = 'awaiting_alternative'
            self.booking_sessions[session_id] = booking
            readable = ', '.join(self._booking_type_label(t) for t in available_types)
            type_display = self._booking_type_label(space_type)
            if readable:
                return {"answer": f"Sorry, we don't have a **{type_display}** in **{location}**.\n\nAvailable there: **{readable}**. Reply **Conference Room**, **Hot Desk**, or **Event Space** and I'll switch it without starting over.", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}
            return {"answer": f"Sorry, we don't have any spaces in **{location}** yet. Try another Aurbis location and I'll update this booking.", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        if not date or not time_val:
            booking['step'] = 'awaiting_datetime'
            self.booking_sessions[session_id] = booking
            return {"answer": f"**{location}** — great choice! ✨ Almost done, **{name}**!\n\nJust one more thing — when do you need it?\n*(Try: \"Tomorrow 3pm\", \"Friday morning\", \"July 5th at 2pm\" — whatever works!)*", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        if 'email' not in booking:
            booking['step'] = 'awaiting_email'
            self.booking_sessions[session_id] = booking
            return {"answer": f"Got it, **{name}** — **{date} at {time_val}** is set. 🙌\n\nWhat's your **email address**? I'll send the booking confirmation straight to your inbox.\n\n*(Or say **skip** if you prefer not to.)*", "sources": [], "mode": self.rag_backend, "suggested_spaces": []}

        # All details collected — show summary for confirmation
        booking['step'] = 'confirming'
        self.booking_sessions[session_id] = booking
        cap = booking.get('capacity')
        cap_row = f"| 👥 **Capacity** | {cap} people |\n" if cap else ""
        selected_row = f"| 🏷️ **Selected Room** | {preview_option['space_name']} ({preview_option['price']}) |\n" if preview_option else ""
        # Auto-pick notes
        auto_notes = []
        if booking.get('_space_correction'):
            auto_notes.append(f"📌 *{booking['_space_correction']}*")
        if booking.get('_type_auto'):
            auto_notes.append(f"📌 *Space type auto-selected as **{type_labels.get(space_type, space_type)}** — change anytime!*")
        if booking.get('_loc_auto'):
            auto_notes.append("📌 *Location auto-selected as **Koramangala** (our flagship) — change anytime!*")
        if booking.get('_dt_auto'):
            auto_notes.append("📌 *Time auto-set to **Today at 3PM** — change anytime!*")
        auto_note_str = ("\n\n" + "\n".join(auto_notes)) if auto_notes else ""
        return {
            "answer": f"Alright **{name}**, here's what I've got for you 👇\n\n| | |\n|---|---|\n| 👤 **Guest** | {name} |\n| 🏢 **Space** | {type_labels.get(space_type, space_type)} |\n{selected_row}| 📍 **Location** | {location} |\n{cap_row}| 📅 **Date** | {date} |\n| 🕐 **Time** | {time_val} |{auto_note_str}\n\nLooking good? Just say **yes** to confirm and I'll get it locked in! ✅",
            "sources": [],
            "mode": self.rag_backend,
            "suggested_spaces": []
        }

    def _try_setup_rag(self):
        force_demo = os.getenv("DEMO_MODE", "false").lower() == "true"
        if force_demo:
            print("⚡ Running in DEMO MODE (forced via DEMO_MODE=true)")
            return

        # Go straight to Ollama (local, always available)
        self._setup_ollama_rag()
        if self.use_rag:
            return

        # Only try OpenAI as last resort if Ollama unavailable
        api_key = os.getenv("OPENAI_API_KEY", "")
        if api_key and api_key != "your_openai_api_key_here":
            self._setup_openai_rag(api_key)
            if self.use_rag:
                return

        print("⚡ Running in DEMO MODE (Ollama unavailable and no OpenAI key)")

    def _setup_openai_rag(self, api_key: str):
        try:
            from langchain_openai import ChatOpenAI, OpenAIEmbeddings
            from langchain_community.vectorstores import Chroma

            print("🔧 Setting up RAG pipeline with OpenAI...")
            docs = self._load_docs()
            embeddings = OpenAIEmbeddings(
                model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
                api_key=api_key
            )

            CHROMA_DIR.mkdir(exist_ok=True)
            vectorstore = Chroma.from_documents(
                docs, embeddings,
                persist_directory=str(CHROMA_DIR),
                collection_name="aurbis_knowledge_openai"
            )

            self.retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
            self.llm = ChatOpenAI(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                temperature=0.3,
                api_key=api_key
            )
            self.use_rag = True
            self.rag_backend = "openai"
            print("✅ RAG ready with OpenAI GPT-4o-mini")

        except Exception as e:
            print(f"⚠️  OpenAI RAG setup failed: {e}")

    def _setup_ollama_rag(self):
        try:
            import requests as _req
            _req.get("http://localhost:11434/api/version", timeout=2).raise_for_status()
        except Exception:
            print("⚠️  Ollama not reachable on localhost:11434 — skipping")
            return

        try:
            from langchain_ollama import OllamaLLM, OllamaEmbeddings
            from langchain_community.vectorstores import Chroma

            ollama_model = os.getenv("OLLAMA_MODEL", "llama3")
            print(f"🦙 Setting up RAG with Ollama ({ollama_model})...")

            embeddings = OllamaEmbeddings(model=ollama_model)

            CHROMA_DIR.mkdir(exist_ok=True)
            if (CHROMA_DIR / "chroma.sqlite3").exists():
                vectorstore = Chroma(
                    persist_directory=str(CHROMA_DIR),
                    embedding_function=embeddings,
                    collection_name="aurbis_knowledge_ollama"
                )
            else:
                docs = self._load_docs()
                vectorstore = Chroma.from_documents(
                    docs, embeddings,
                    persist_directory=str(CHROMA_DIR),
                    collection_name="aurbis_knowledge_ollama"
                )

            self.retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
            self.llm = OllamaLLM(model=ollama_model, temperature=0.3)
            self.use_rag = True
            self.rag_backend = "ollama"
            print(f"✅ RAG ready with Ollama {ollama_model} (100% local, no API key!)")

        except Exception as e:
            print(f"⚠️  Ollama RAG setup failed: {e}")

    def _load_docs(self) -> list:
        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
        docs = []

        kb_path = DATA_DIR / "knowledge_base.md"
        if kb_path.exists():
            text = kb_path.read_text()
            chunks = splitter.create_documents([text], metadatas=[{"source": "knowledge_base"}])
            docs.extend(chunks)

        spaces_path = DATA_DIR / "spaces.json"
        if spaces_path.exists():
            with open(spaces_path) as f:
                spaces_data = json.load(f)
            for space in spaces_data.get("spaces", []):
                content = (
                    f"Space: {space['name']} ({space['id']})\n"
                    f"Type: {space['type_label']}\n"
                    f"Location: {space['location']}\n"
                    f"Capacity: {space['capacity']} people\n"
                    f"Price: ₹{space['pricing'].get('hourly', 'N/A')}/hour\n"
                    f"Amenities: {', '.join(space['amenities'])}\n"
                    f"Best for: {', '.join(space['ideal_for'])}\n"
                    f"Rating: {space['rating']} ({space['reviews']} reviews)"
                )
                docs.append(Document(
                    page_content=content,
                    metadata={"source": f"space_{space['id']}", "space_id": space["id"]}
                ))
        return docs

    def chat(self, message: str, session_id: str) -> dict:
        history = self.session_histories.get(session_id, [])

        # Booking flow always takes priority (instant, no LLM needed)
        booking_response = self._handle_booking_flow(session_id, message, history)
        if booking_response:
            history.append({"role": "user", "content": message})
            history.append({"role": "assistant", "content": booking_response["answer"]})
            self.session_histories[session_id] = history[-20:]
            return booking_response

        if not self.use_rag:
            # Ollama not ready yet — try to reconnect once before giving up
            print("[Nova] RAG not active — attempting Ollama reconnect...")
            self._setup_ollama_rag()
            if not self.use_rag:
                return {
                    "answer": "⏳ Nova's AI brain is warming up — Ollama is loading. Please send your message again in a few seconds!",
                    "sources": [],
                    "mode": "ollama",
                    "suggested_spaces": []
                }

        for attempt in range(2):  # try twice before giving up
            try:
                # Retrieve relevant documents
                docs = self.retriever.invoke(message)
                context = "\n\n".join(doc.page_content for doc in docs)
                sources = list({
                    doc.metadata.get("source", "Aurbis Knowledge Base")
                    for doc in docs
                })

                # Build chat history string
                chat_history_str = "\n".join(
                    f"{'User' if h['role'] == 'user' else 'Nova'}: {h['content']}"
                    for h in history[-6:]
                )

                # Format the prompt
                prompt_text = SYSTEM_PROMPT.format(
                    context=context,
                    chat_history=chat_history_str,
                    question=message
                )

                # Call LLM
                raw = self.llm.invoke(prompt_text)
                answer = raw.content if hasattr(raw, "content") else str(raw)
                if self._looks_like_false_booking_confirmation(answer):
                    answer = (
                        "I can help book that, but I have not confirmed it yet. "
                        "To complete a real booking, please tell me the guest name, space/location, date, time, and email. "
                        "Once I show the final summary, reply **yes** and I will send the confirmation email."
                    )

                history.append({"role": "user", "content": message})
                history.append({"role": "assistant", "content": answer})
                self.session_histories[session_id] = history[-20:]

                return {
                    "answer": answer,
                    "sources": sources[:3],
                    "mode": self.rag_backend
                }
            except Exception as e:
                print(f"[Nova] Ollama attempt {attempt+1} failed: {e}")
                if attempt == 0:
                    # First failure — try to reconnect Ollama and retry
                    import time
                    time.sleep(1)
                    self._setup_ollama_rag()

        # Both attempts failed — honest message, still show ollama mode
        return {
            "answer": "🦙 Ollama is taking a moment to respond. Please try again — it usually recovers in seconds!",
            "sources": [],
            "mode": "ollama",
            "suggested_spaces": []
        }

    def _looks_like_false_booking_confirmation(self, answer: str) -> bool:
        """Block RAG-only answers from pretending that a booking happened."""
        text = answer.lower()
        confirmation_terms = [
            'is booked', 'has been booked', 'booking is confirmed', 'booking confirmed',
            'confirmed the booking', 'reserved for you', 'all set', 'locked in',
            'your booking details', 'recap, your booking', 'booking id:'
        ]
        if any(term in text for term in confirmation_terms if term not in {'all set', 'locked in'}):
            return True
        return any(term in text for term in {'all set', 'locked in'}) and any(
            signal in text for signal in {'booking', 'booked', 'reserved', 'workspace', 'space'}
        )

    # ── Self-Healing RAG ───────────────────────────────────────────────────────
    _LOW_CONF = [
        "i'm not sure", "i don't have", "i cannot find", "no information",
        "not available in my", "i don't know", "cannot answer", "not certain",
        "no specific information", "based on my training", "i'm unable to",
        "unfortunately i don", "i lack the", "beyond my knowledge",
    ]

    def _is_low_confidence(self, answer: str) -> bool:
        a = answer.lower()
        return any(sig in a for sig in self._LOW_CONF)

    def _reformulate_query(self, query: str) -> Optional[str]:
        """Use the LLM to rewrite the query for better RAG retrieval."""
        if not self.llm:
            return None
        try:
            prompt = (
                "Rewrite this workspace booking query to be more specific and "
                "retrieval-friendly. Output ONLY the rewritten query — no quotes, "
                "no explanation.\n\n"
                f"Original: {query}\nRewritten:"
            )
            raw = self.llm.invoke(prompt)
            result = (raw.content if hasattr(raw, "content") else str(raw)).strip().strip('"\'')
            if result and result.lower() != query.lower() and 5 < len(result) < 300:
                return result
        except Exception:
            pass
        return None

    def chat_with_healing(self, message: str, session_id: str) -> dict:
        """
        Self-Healing RAG wrapper.
        1. Runs normal RAG chat.
        2. If response shows low confidence, auto-reformulates the query.
        3. Retries with the improved query.
        4. Returns healed=True + both queries so the UI can show the heal event.
        """
        result = self.chat(message, session_id)
        answer = result.get("answer", "")

        if self._is_low_confidence(answer):
            reformulated = self._reformulate_query(message)
            if reformulated:
                healed_result = self.chat(reformulated, session_id)
                healed_result["healed"] = True
                healed_result["original_query"] = message
                healed_result["reformulated_query"] = reformulated
                return healed_result

        return result
