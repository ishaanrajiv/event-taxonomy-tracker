#!/bin/bash

echo "🚀 Starting Event Taxonomy Tool..."
echo ""

# Check if backend is already running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Backend already running on port 8000"
else
    echo "🐍 Starting backend on http://localhost:8000..."
    uv run uvicorn api:app --reload --port 8000 &
    BACKEND_PID=$!
fi

# Check if frontend is already running
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Frontend already running on port 5173"
else
    echo "⚛️  Starting frontend on http://localhost:5173..."
    npm run dev --prefix frontend &
    FRONTEND_PID=$!
fi

echo ""
echo "✅ Servers starting..."
echo ""
echo "📊 Frontend: http://localhost:5173"
echo "📚 Backend API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
