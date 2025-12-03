#!/bin/bash

echo "🛑 Stopping Event Taxonomy Tracker servers..."
echo ""

# Kill backend (port 8000)
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "🐍 Stopping backend (port 8000)..."
    kill $(lsof -t -i:8000) 2>/dev/null
    echo "   ✓ Backend stopped"
else
    echo "   ℹ️  Backend not running"
fi

# Kill frontend (port 5173)
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚛️  Stopping frontend (port 5173)..."
    kill $(lsof -t -i:5173) 2>/dev/null
    echo "   ✓ Frontend stopped"
else
    echo "   ℹ️  Frontend not running"
fi

# Kill frontend (port 5174, in case it's running there)
if lsof -Pi :5174 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚛️  Stopping frontend (port 5174)..."
    kill $(lsof -t -i:5174) 2>/dev/null
    echo "   ✓ Frontend stopped"
else
    echo "   ℹ️  Frontend not running on port 5174"
fi

echo ""
echo "✅ All servers stopped"
