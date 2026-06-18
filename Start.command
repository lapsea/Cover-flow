#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
  osascript -e 'display dialog "请先安装 Node.js\nhttps://nodejs.org" with title "Cover-flow" buttons {"OK"} default button "OK"'
  exit 1
fi

# Stop any previous instance on port 3000
lsof -ti:3000 | xargs kill 2>/dev/null
sleep 0.5

echo "Starting Cover-flow..."
npm start &
sleep 2
open http://localhost:3000
