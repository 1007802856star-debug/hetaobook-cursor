#!/bin/bash

set -euo pipefail

# 获取脚本所在目录（.zscripts）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "[INIT] Installing dependencies..."
    bun install
fi

# Setup database
echo "[INIT] Setting up database..."
bun run db:push 2>/dev/null || true

# Build if needed
if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
    echo "[INIT] Building Next.js application..."
    npx next build
fi

# Start Next.js in production mode (much less memory than dev mode)
echo "[INIT] Starting Next.js production server on 0.0.0.0:3000..."
export DATABASE_URL="file:$PROJECT_DIR/db/custom.db"
export HOSTNAME=0.0.0.0
export PORT=3000

# Use exec to make Next.js the main process - won't be killed when shell exits
exec npx next start -H 0.0.0.0 -p 3000
