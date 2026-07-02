"""
Aurbis Nova — WhatsApp Bot Handler
Uses Twilio WhatsApp Sandbox.

Setup:
  1. Free account at https://www.twilio.com/
  2. Sandbox: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
  3. expose backend: ngrok http 8000
  4. Set webhook URL in Twilio sandbox settings → https://xxxx.ngrok.io/api/whatsapp
  5. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER to .env
"""

import asyncio
import os
import re

# ── Twilio helper ─────────────────────────────────────────────────────────────
def _twilio_client():
    from twilio.rest import Client
    sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    tok = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not sid or not tok:
        raise RuntimeError("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set in .env")
    return Client(sid, tok)


def send_whatsapp_message(to: str, body: str):
    """Send a WhatsApp message via Twilio REST API (used for async replies)."""
    from_ = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
    client = _twilio_client()
    client.messages.create(body=body[:4096], from_=from_, to=to)


# ── Markdown → WhatsApp format ────────────────────────────────────────────────
def _to_wa(text: str) -> str:
    """Convert markdown to WhatsApp-compatible formatting."""
    # **bold** → *bold*
    text = re.sub(r'\*\*(.+?)\*\*', r'*\1*', text)
    # # Heading → *Heading*
    text = re.sub(r'^#{1,4}\s+(.+)$', r'*\1*', text, flags=re.MULTILINE)
    # `code` → just the text (WhatsApp doesn't render code)
    text = re.sub(r'`(.+?)`', r'\1', text)
    # Truncate at 3500 chars (WhatsApp max ~65k but keep it readable)
    if len(text) > 3500:
        text = text[:3497] + "..."
    return text.strip()


# ── Static command replies ────────────────────────────────────────────────────
_WELCOME = """\
🏢 *Welcome to Aurbis Nova!*

I'm Nova, your AI workspace booking assistant for Bangalore.

Here's what I can do:

🔍 *Find spaces* — _"Conference room in Koramangala for 10 people"_
💰 *Compare prices* — _"Cheapest event space in HSR Layout"_
📅 *Book a space* — _"Book Innovation Hub tomorrow at 3pm"_
🤖 *Complex queries* — _"Plan a 2-day offsite for 30 people"_

Type *help* anytime for examples.\
"""

_HELP = """\
📖 *Aurbis Nova — Help*

*Commands:*
• *hi* or *hello* — Welcome message
• *help* — This guide
• *reset* — Clear conversation history

*Example queries you can ask:*
• _"Find a quiet room for 5 people in HSR Layout under ₹1,500/hr"_
• _"What's the cheapest conference room in Whitefield?"_
• _"Compare The Boardroom and Innovation Hub"_
• _"Book Sprint Room in Indiranagar on Friday at 2pm"_
• _"I need an event space for 50 people next Monday"_

All 41 Aurbis spaces across 13 Bangalore areas are available to search.\
"""

_RESET_MSG = "🔄 Conversation reset! Say *hi* to start fresh."


# ── Main message processor ────────────────────────────────────────────────────
async def process_message(from_number: str, body: str, rag) -> str:
    """
    Process an incoming WhatsApp message and return the reply text.

    Args:
        from_number: Sender's WhatsApp number (e.g. 'whatsapp:+919164790726')
        body:        The raw message text
        rag:         AurbisRAG instance (has chat_with_healing method)

    Returns:
        Reply string (WhatsApp-formatted)
    """
    text = (body or "").strip()
    lower = text.lower()

    # ── Static commands (instant, no LLM) ────────────────────────────────────
    if lower in ("hi", "hello", "hey", "start", "/start", "hii", "helo"):
        return _WELCOME

    if lower in ("help", "/help", "?"):
        return _HELP

    if lower in ("reset", "clear", "/reset", "restart"):
        return _RESET_MSG

    # ── RAG-powered response ──────────────────────────────────────────────────
    # Use phone number as session_id so conversation history is maintained per user
    session_id = from_number.replace("whatsapp:", "").replace("+", "")

    try:
        result = await asyncio.to_thread(rag.chat_with_healing, text, session_id)

        answer = result.get("answer", "")
        booking_confirmed = result.get("booking_confirmed", False)
        booking_details = result.get("booking_details", {})

        reply = _to_wa(answer)

        # Append booking summary if a booking just happened
        if booking_confirmed and booking_details:
            bid  = booking_details.get("booking_id", "—")
            name = booking_details.get("space_name", "—")
            loc  = booking_details.get("location", "—")
            date = booking_details.get("date", "—")
            time = booking_details.get("time", "—")
            price = booking_details.get("price", "—")
            reply += (
                f"\n\n✅ *Booking Confirmed!*\n"
                f"📋 ID: `{bid}`\n"
                f"🏢 {name} — {loc}\n"
                f"📅 {date} at {time}\n"
                f"💰 {price}\n\n"
                f"Show your booking ID at reception for check-in."
            )

        return reply or "Sorry, I couldn't generate a response. Please try rephrasing your question."

    except Exception as exc:
        print(f"[WhatsApp Bot] Error processing message: {exc}")
        return (
            "⚠️ I ran into an issue processing that. Please try again, "
            "or visit the app at http://localhost:5173"
        )
