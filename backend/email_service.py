"""
Aurbis Nova — Email Service
Sends booking confirmation emails via Gmail SMTP.
"""
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

GMAIL_USER     = os.getenv("GMAIL_USER", "maheshwaransurya97@gmail.com")
GMAIL_APP_PASS = os.getenv("GMAIL_APP_PASSWORD", "")


def send_booking_confirmation(to_email: str, booking: dict) -> bool:
    """
    Send a beautiful HTML booking confirmation email.
    Returns True on success, False on failure.
    """
    if not GMAIL_APP_PASS:
        print("[Email] GMAIL_APP_PASSWORD not set — skipping email send.")
        return False

    booking_id  = booking.get("booking_id",  "AUR-XXXXXX")
    name        = booking.get("name",        "Guest")
    space_name  = booking.get("space_name",  "Aurbis Space")
    location    = booking.get("location",    "Bangalore")
    date        = booking.get("date",        "Today")
    time_val    = booking.get("time",        "3:00 PM")
    price       = booking.get("price",       "—")

    subject = f"✅ Booking Confirmed — {booking_id} | Aurbis Nova"

    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#F4F6FF;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px 0;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:linear-gradient(135deg,#0D0F1A,#1A1040);border-radius:16px 16px 0 0;overflow:hidden;">
          <tr>
            <td style="padding:36px 40px;">
              <div style="font-size:22px;font-weight:800;letter-spacing:0.15em;color:#fff;margin-bottom:6px;">AURBIS</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.25em;text-transform:uppercase;">START · SCALE · SOAR</div>
            </td>
            <td align="right" style="padding:36px 40px;">
              <div style="background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);border-radius:20px;padding:8px 18px;display:inline-block;">
                <span style="color:#6EE7B7;font-size:13px;font-weight:700;">✅ CONFIRMED</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:0 16px 32px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);">

          <!-- Greeting -->
          <tr>
            <td style="padding:40px 40px 20px;">
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#1E2235;">
                Hey {name}! 🎉
              </h1>
              <p style="margin:0;font-size:15px;color:#6B7280;line-height:1.6;">
                Your workspace is locked in and ready for you. Here's everything you need to know.
              </p>
            </td>
          </tr>

          <!-- Booking ID Banner -->
          <tr>
            <td style="padding:0 40px 24px;">
              <div style="background:linear-gradient(135deg,#6C47FF,#4B2FD4);border-radius:12px;padding:20px 28px;text-align:center;">
                <div style="font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Booking Reference</div>
                <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:0.1em;font-family:'Courier New',monospace;">{booking_id}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px;">Show this ID at reception for entry</div>
              </div>
            </td>
          </tr>

          <!-- Booking Details -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7F0;border-radius:12px;overflow:hidden;">
                <tr style="background:#F8F9FF;">
                  <td colspan="2" style="padding:14px 20px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid #E5E7F0;">
                    📋 Booking Details
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:#9CA3AF;border-bottom:1px solid #F3F4F6;width:40%;">👤 Guest Name</td>
                  <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1E2235;border-bottom:1px solid #F3F4F6;">{name}</td>
                </tr>
                <tr style="background:#FAFBFF;">
                  <td style="padding:14px 20px;font-size:13px;color:#9CA3AF;border-bottom:1px solid #F3F4F6;">🏢 Space</td>
                  <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1E2235;border-bottom:1px solid #F3F4F6;">{space_name}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:#9CA3AF;border-bottom:1px solid #F3F4F6;">📍 Location</td>
                  <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1E2235;border-bottom:1px solid #F3F4F6;">{location}, Bangalore</td>
                </tr>
                <tr style="background:#FAFBFF;">
                  <td style="padding:14px 20px;font-size:13px;color:#9CA3AF;border-bottom:1px solid #F3F4F6;">📅 Date</td>
                  <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1E2235;border-bottom:1px solid #F3F4F6;">{date}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:#9CA3AF;border-bottom:1px solid #F3F4F6;">🕐 Time</td>
                  <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1E2235;border-bottom:1px solid #F3F4F6;">{time_val}</td>
                </tr>
                <tr style="background:#FAFBFF;">
                  <td style="padding:14px 20px;font-size:13px;color:#9CA3AF;">💰 Rate</td>
                  <td style="padding:14px 20px;font-size:14px;font-weight:700;color:#6C47FF;">{price}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What to expect -->
          <tr>
            <td style="padding:0 40px 32px;">
              <h3 style="font-size:14px;font-weight:700;color:#1E2235;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">What to Expect</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:32px;">
                    <div style="width:28px;height:28px;background:rgba(108,71,255,0.1);border-radius:8px;text-align:center;line-height:28px;font-size:14px;">📶</div>
                  </td>
                  <td style="padding:8px 0 8px 12px;font-size:13px;color:#4B5563;">High-speed WiFi (500Mbps+) and ergonomic seating ready for you</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;">
                    <div style="width:28px;height:28px;background:rgba(0,194,168,0.1);border-radius:8px;text-align:center;line-height:28px;font-size:14px;">☕</div>
                  </td>
                  <td style="padding:8px 0 8px 12px;font-size:13px;color:#4B5563;">Complimentary tea, coffee & water throughout your session</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;">
                    <div style="width:28px;height:28px;background:rgba(245,158,11,0.1);border-radius:8px;text-align:center;line-height:28px;font-size:14px;">🔒</div>
                  </td>
                  <td style="padding:8px 0 8px 12px;font-size:13px;color:#4B5563;">Show your booking ID <strong>{booking_id}</strong> at reception for instant access</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;">
                    <div style="width:28px;height:28px;background:rgba(239,68,68,0.1);border-radius:8px;text-align:center;line-height:28px;font-size:14px;">❌</div>
                  </td>
                  <td style="padding:8px 0 8px 12px;font-size:13px;color:#4B5563;">Free cancellation up to 24 hours before. Chat with Nova to reschedule.</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <div style="background:#F8F9FF;border-radius:12px;padding:24px;border:1px solid #E5E7F0;">
                <p style="margin:0 0 16px;font-size:13px;color:#6B7280;">Need to modify or have a question? Chat with Nova anytime.</p>
                <a href="http://localhost:5173" style="display:inline-block;background:linear-gradient(135deg,#6C47FF,#4B2FD4);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.02em;">
                  Chat with Nova 🤖
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8F9FF;padding:24px 40px;border-top:1px solid #E5E7F0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                This email was sent by <strong>Nova, Aurbis AI Assistant</strong> on behalf of Aurbis Workspaces Pvt Ltd, Bangalore.<br>
                © 2026 Aurbis. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Nova (Aurbis) <{GMAIL_USER}>"
    msg["To"]      = to_email

    # Plain text fallback
    text = f"""
Booking Confirmed — {booking_id}

Hi {name},

Your Aurbis workspace is confirmed! Here are your details:

  Space     : {space_name}
  Location  : {location}, Bangalore
  Date      : {date}
  Time      : {time_val}
  Rate      : {price}
  Booking ID: {booking_id}

Show your booking ID at reception for entry.
Free cancellation up to 24 hours before your session.

— Nova, Aurbis AI Assistant
"""
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASS)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())
        print(f"[Email] ✅ Confirmation sent to {to_email} (Booking: {booking_id})")
        return True
    except smtplib.SMTPAuthenticationError:
        print("[Email] ❌ Gmail auth failed — check GMAIL_APP_PASSWORD in .env")
        return False
    except Exception as e:
        print(f"[Email] ❌ Send failed: {e}")
        return False
