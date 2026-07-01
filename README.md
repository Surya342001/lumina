# Aurbis Nova — AI Workspace Booking Demo

> A full-stack LLM + RAG demo built for **Aurbis** — showing how AI can revolutionize workspace discovery and booking.

![Tech Stack](https://img.shields.io/badge/LangChain-RAG-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-Python-green) ![React](https://img.shields.io/badge/React-18-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-teal)

---

## What is This?

**Nova** is an AI workspace concierge that uses **Retrieval-Augmented Generation (RAG)** to help users find and book Aurbis workspaces using plain English.

### Demo Flow
```
User: "I need a conference room for 15 people in Koramangala on Friday"
         ↓
Nova retrieves → Aurbis knowledge base (ChromaDB)
         ↓
LangChain generates → Contextual recommendations with prices
         ↓
User → Books instantly through the UI
```

---

## Features

- 🤖 **AI Chat Assistant** — Natural language workspace search and booking  
- 📚 **RAG Pipeline** — LangChain + ChromaDB + OpenAI (or demo mode without API key)
- 🏢 **18 Real Spaces** — Across 5 Bangalore locations with full data
- 🎯 **AI Recommendations** — Chat highlights relevant spaces in the explorer
- 📅 **Booking Flow** — Complete booking with confirmation and booking ID
- 🌗 **Demo Mode** — Works without any API key for instant presentations

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | OpenAI GPT-4o-mini (configurable) |
| RAG | LangChain `ConversationalRetrievalChain` |
| Vector Store | ChromaDB (persistent local) |
| Embeddings | `text-embedding-3-small` |
| Backend | FastAPI (Python) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Demo Mode | Intelligent keyword-based fallback |

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Optional: add your OpenAI key (app works without it in demo mode)
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-...

uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
API docs: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Demo Tips (for the Pitch)

### Must-try queries for the demo:
| Query | What it shows |
|-------|-------------|
| "Conference room for 15 people in Koramangala" | RAG space retrieval |
| "Cheapest event space for 100 people" | Price filtering via AI |
| "Book Sprint Room Whitefield for Friday 3pm" | End-to-end booking |
| "What amenities are included?" | Policy Q&A from knowledge base |
| "Show me spaces for confidential meetings" | Semantic understanding |

### Key pitch talking points:
1. **"This replaces 80% of support queries"** — show the AI answering policy questions
2. **"RAG means no hallucinations"** — show the Sources section in chat responses
3. **"Can connect to live data"** — this uses a static dataset; production would use your actual booking system
4. **"Deployable in 2 weeks"** — the architecture is production-ready

---

## Architecture

```
┌─────────────────────────────────┐
│         React Frontend          │
│  Chat Widget + Space Explorer   │
└──────────────┬──────────────────┘
               │ REST API
┌──────────────▼──────────────────┐
│         FastAPI Backend         │
│  /api/chat  /api/spaces  /book  │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│       LangChain RAG Engine      │
│  ConversationalRetrievalChain   │
└──────┬───────────────┬──────────┘
       │               │
┌──────▼──────┐ ┌──────▼──────────┐
│  ChromaDB   │ │  OpenAI GPT-4   │
│ Vector Store│ │  LLM + Embeds   │
└─────────────┘ └─────────────────┘
       │
┌──────▼──────────────────────────┐
│    Aurbis Knowledge Base        │
│  knowledge_base.md + spaces.json│
└─────────────────────────────────┘
```

---

## Adding Real Data

To extend with real Aurbis data:
1. Update `backend/data/knowledge_base.md` with actual space details
2. Update `backend/data/spaces.json` with live inventory
3. Delete `backend/chroma_db/` to rebuild the vector index
4. In production: replace the `/api/book` endpoint with your actual booking system API

---

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI server
│   ├── rag_engine.py        # LangChain RAG pipeline
│   ├── requirements.txt
│   └── data/
│       ├── knowledge_base.md  # Aurbis knowledge base
│       └── spaces.json        # Space inventory
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js             # API client + demo fallback
    │   └── components/
    │       ├── ChatWidget.jsx   # AI chat interface
    │       ├── SpaceExplorer.jsx # Filterable space grid
    │       ├── SpaceCard.jsx
    │       ├── BookingModal.jsx
    │       ├── HowItWorks.jsx   # RAG pipeline explainer
    │       └── StatsSection.jsx
    └── package.json
```
