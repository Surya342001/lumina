# Aurbis Nova — AI Workspace Assistant

> A full-stack AI-powered workspace booking assistant with **10 live AI features** — built with FastAPI, LangChain RAG, Ollama llama3, React 18, and Tailwind CSS.

![FastAPI](https://img.shields.io/badge/FastAPI-0.138-green) ![LangChain](https://img.shields.io/badge/LangChain-RAG-blue) ![Ollama](https://img.shields.io/badge/Ollama-llama3-orange) ![React](https://img.shields.io/badge/React-18.2-61DAFB) ![Vite](https://img.shields.io/badge/Vite-5.4-purple)

---

## 🚀 Quick Start

### 1. Start Ollama (local LLM — no API key needed)
```bash
ollama run llama3
```

### 2. Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --port 8000 --host 0.0.0.0
```
Health check → http://localhost:8000/api/health should return `{"status":"ok","rag_mode":true,"backend":"ollama"}`

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open: **http://localhost:5173/**

---

## 🧠 10 AI Features — How to Test Each One

### 1. 💬 Conversational RAG Booking
**What it does:** Multi-turn AI conversation powered by LangChain + ChromaDB + Ollama llama3. Nova remembers context across the whole conversation.  
**How to test:**
1. Type: `"I want to book a conference room in Koramangala"`
2. Nova asks for your name → reply with your name
3. Nova asks for date → say `"tomorrow"`
4. Nova asks for time → say `"3pm"`
5. Nova asks for headcount → say `"10 people"`
6. Confirm the booking — you get a Booking ID and email confirmation

---

### 2. 🔴 SSE Streaming + Live RAG Pipeline
**What it does:** Responses stream token-by-token in real time. A 3-step animated pipeline shows Nova's thinking process.  
**How to test:**
1. Send any message
2. Watch the pipeline animate immediately:
   - ⏳ Searching knowledge base...  ✓
   - ⏳ Retrieving context...  ✓
   - ⏳ Generating response...  ✓
3. Text streams in live — no waiting for the full response

---

### 3. 📍 Live NLP Entity Extraction
**What it does:** Extracts location, space type, date/time, headcount, and booking intent from your input in real time as you type.  
**How to test:**
1. Click in the input box
2. Type: `"conference room Koramangala tomorrow 3pm 10 people"`
3. Chips appear instantly below the input:  
   `📍 Koramangala` `🏢 Conference Room` `📅 Tomorrow` `🕐 3pm` `👥 10 people` `✅ Book intent`
4. Try removing words — chips disappear dynamically

---

### 4. 🎯 Booking Intent Confidence Bar
**What it does:** A gradient progress bar that animates and changes colour as you add more booking details.  
**How to test:**
1. Type a vague query like `"hello"` → bar is short and grey
2. Type `"book a room"` → bar grows, turns blue
3. Type `"book conference room Koramangala tomorrow 3pm for 10"` → bar is full and green
4. The score (0–100) updates with every keystroke

---

### 5. 💡 Predictive Autocomplete
**What it does:** Context-aware query suggestions appear as clickable chips while you type (triggers on 3+ characters).  
**How to test:**
1. Type `"book"` → 3 chips appear above the input:
   - `Book a conference room for 10 people`
   - `Book a hot desk for today`
   - `Book Innovation Hub in Koramangala`
2. Click any chip → input fills instantly, ready to send
3. Try typing `"conf"`, `"how much"`, `"show"` for different suggestions
4. Send a message → chips clear automatically

---

### 6. 💭 Chain of Thought Reasoning Panel
**What it does:** Every AI response includes a collapsible reasoning panel showing exactly how Nova processed your query — 4 transparent steps.  
**How to test:**
1. Send any message (e.g. `"Book Innovation Hub in Koramangala"`)
2. After the response appears, click **"💭 View reasoning"** below the message
3. Panel expands with 4 numbered steps:
   - **1. Entity Detection** — what NLP entities were extracted
   - **2. Knowledge Retrieval** — how many RAG chunks were used
   - **3. Response Strategy** — how Nova chose to respond
   - **4. AI Engine** — Ollama llama3 · LangChain RAG · ChromaDB
4. Click **"💭 Hide reasoning"** to collapse

---

### 7. 📊 AI Session Analytics Dashboard
**What it does:** Live session stats panel that updates after every exchange.  
**How to test:**
1. Click the **📊** button in the top-right of the chat header to open the panel
2. Send a few messages — watch the numbers update live:
   - **Queries** — how many you've asked
   - **Responses** — how many Nova replied
   - **Sources** — RAG document chunks retrieved
3. See the **Query Distribution** bar chart grow with colour-coded categories:
   - 🟢 Booking · 🔵 Exploring · 🟡 Pricing · 🟣 Amenities
4. Click 📊 again to close

---

### 8. 🔍 AI Semantic Space Search
**What it does:** Natural language workspace search in the Space Explorer that understands concepts, not just keywords.  
**How to test:**
1. Click **"Explore Spaces"** at the top of the page
2. Click the **"AI"** toggle button in the search bar (turns blue)
3. Type concept-based queries (no exact keywords needed):
   - `"quiet place to focus"` → finds Focus Pods / Hot Desks
   - `"big room for events"` → finds Event Halls
   - `"tech meetup space"` → finds Innovation Hubs
   - `"executive meeting"` → finds Boardrooms
4. See matching **concept badges** appear on each result card
5. Toggle AI mode off → back to keyword search

---

### 9. 🧠 AI Persona Memory — "Nova knows you"
**What it does:** Nova builds a profile of your preferences from your messages and displays it as a live panel.  
**How to test:**
1. Send 2–3 messages mentioning specific locations and space types
   - e.g., `"Koramangala conference room"` then `"Indiranagar hot desk"`
2. A **"Nova knows you 🧠"** panel appears above the input showing:
   - Detected favourite locations
   - Preferred space types
   - Total queries in session
3. The profile updates with each new message

---

### 10. 🎤 Voice Input
**What it does:** Speak your booking request instead of typing — uses the browser's built-in Web Speech API.  
**⚠️ Requires Chrome browser**  
**How to test:**
1. Click the **🎤 microphone** button (bottom-right of input bar)
2. Button turns **red** while listening
3. Say: `"Book a conference room in Koramangala for tomorrow at 3pm for 10 people"`
4. Your speech is transcribed into the input automatically
5. Press Enter or click Send

---

## 🎯 Full Demo Script (for interviews / presentations)

| Step | Action | Feature Shown |
|---|---|---|
| 1 | Open http://localhost:5173/ | App load |
| 2 | Type `"book"` | 💡 Predictive autocomplete chips appear |
| 3 | Click `"Book Innovation Hub in Koramangala"` chip | 💡 Input fills instantly |
| 4 | Watch message send | 🔴 SSE streaming + RAG pipeline animation |
| 5 | Expand "💭 View reasoning" | 💭 Chain of Thought — 4 transparent steps |
| 6 | Click 📊 button | 📊 Analytics dashboard with live bar chart |
| 7 | Switch to Explore Spaces, toggle AI | 🔍 Semantic search — concept-aware results |
| 8 | Slowly type a booking query | 📍 NLP chips + 🎯 confidence bar animating |
| 9 | Click 🎤, speak a request | 🎤 Voice transcription |
| 10 | Complete the multi-turn booking | 💬 RAG conversation + 🧠 Persona memory panel |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              React 18 Frontend               │
│  Vite · Tailwind · Web Speech API · SSE     │
└──────────────────┬──────────────────────────┘
                   │ HTTP / Server-Sent Events
┌──────────────────▼──────────────────────────┐
│             FastAPI Backend                  │
│  LangChain RAG · ChromaDB · Email Service   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Ollama llama3 (local)              │
│  OllamaLLM + OllamaEmbeddings · port 11434  │
└─────────────────────────────────────────────┘
```

**Key API endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Backend + Ollama health check |
| `/api/chat` | POST | Standard chat (JSON) |
| `/api/chat/stream` | GET | SSE streaming chat |
| `/api/spaces` | GET | All workspace listings |
| `/api/spaces/semantic-search` | POST | AI semantic search |
| `/api/booking/confirm` | POST | Confirm booking + send email |

---

## 📁 Project Structure

```
llm projecct/
├── backend/
│   ├── main.py              # FastAPI app + all API routes
│   ├── rag_engine.py        # LangChain RAG + booking state machine
│   ├── email_service.py     # Gmail SMTP confirmation emails
│   ├── spaces_data.py       # 18 workspace listings (5 Bangalore locations)
│   ├── chroma_db/           # ChromaDB vector store (auto-generated)
│   ├── venv/                # Python virtual environment
│   └── .env                 # GMAIL_USER, GMAIL_APP_PASSWORD
└── frontend/
    └── src/
        ├── components/
        │   ├── ChatWidget.jsx    # All 10 AI features in one component
        │   └── SpaceExplorer.jsx # Space grid + AI semantic search
        ├── App.jsx
        └── index.css            # Tailwind + fadeChip + slideDown animations
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | Ollama llama3 (local — no API key needed) |
| **RAG** | LangChain 1.x + ChromaDB + OllamaEmbeddings |
| **Backend** | FastAPI 0.138 + Uvicorn |
| **Frontend** | React 18.2 + Vite 5.4 + Tailwind CSS |
| **Streaming** | Server-Sent Events (SSE) |
| **Voice** | Web Speech API (Chrome) |
| **Email** | Gmail SMTP (port 465) |

---

## ⚙️ Environment Setup

Create `backend/.env`:
```
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
```

Install backend dependencies:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn langchain langchain-ollama langchain-community chromadb
```

---

## 📦 GitHub

Repository: [https://github.com/Surya342001/Aurbis](https://github.com/Surya342001/Aurbis)

```bash
git clone https://github.com/Surya342001/Aurbis.git
```

# lumina
