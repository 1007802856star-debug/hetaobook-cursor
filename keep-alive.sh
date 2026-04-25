#!/bin/bash
# Keep-alive script: automatically restart Next.js dev server if it crashes

LOG="/tmp/next-live.log"
PID_FILE="/tmp/next-server.pid"

while true; do
    # Check if server is responding
    if ! curl -s -m 10 http://localhost:3000/ -o /dev/null 2>&1; then
        echo "[$(date)] Server not responding, restarting..." >> "$LOG"
        
        # Kill any existing processes
        pkill -f "next dev" 2>/dev/null
        sleep 2
        
        # Start fresh
        cd /home/z/my-project
        npx next dev -p 3000 -H 0.0.0.0 --webpack >> "$LOG" 2>&1 &
        NEW_PID=$!
        echo $NEW_PID > "$PID_FILE"
        echo "[$(date)] Server restarted with PID $NEW_PID" >> "$LOG"
        
        # Wait for startup
        sleep 15
        
        # Verify
        if curl -s -m 10 http://localhost:3000/ -o /dev/null 2>&1; then
            echo "[$(date)] Server verified OK" >> "$LOG"
        else
            echo "[$(date)] Server still not responding after restart" >> "$LOG"
        fi
    fi
    
    sleep 30
done
