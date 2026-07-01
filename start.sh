#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Aurbis Nova — Auto-restart startup script
# Keeps backend + frontend running. Restarts on crash.
# Usage: bash start.sh
# ─────────────────────────────────────────────────────────────

PROJECT="/Users/surya.prakash1/Desktop/llm projecct"
BACKEND="$PROJECT/backend"
FRONTEND="$PROJECT/frontend"
LOG="/tmp/aurbis_backend.log"
FRONTEND_LOG="/tmp/aurbis_frontend.log"

echo "🚀 Starting Aurbis Nova..."

# 1. Make sure Ollama is running
if ! curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
  echo "🦙 Starting Ollama..."
  ollama serve &
  sleep 4
fi
echo "✅ Ollama is running"

# 2. Start frontend (once, in background)
pkill -f "vite" 2>/dev/null
sleep 1
cd "$FRONTEND" && npm run dev > "$FRONTEND_LOG" 2>&1 &
echo "⚛️  Frontend started → http://localhost:5173"

# 3. Keep backend alive with auto-restart loop
echo "⚡ Backend auto-restart loop started (logs: $LOG)"
echo "   Press Ctrl+C to stop everything"
echo ""

cleanup() {
  echo ""
  echo "🛑 Stopping Aurbis Nova..."
  pkill -f "uvicorn main:app" 2>/dev/null
  pkill -f "vite" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

cd "$BACKEND" && source venv/bin/activate

while true; do
  echo "[$(date '+%H:%M:%S')] 🟢 Backend starting..."
  python3 -m uvicorn main:app --port 8000 --host 0.0.0.0 >> "$LOG" 2>&1
  EXIT=$?
  echo "[$(date '+%H:%M:%S')] ⚠️  Backend stopped (exit $EXIT) — restarting in 3s..."
  sleep 3
done
