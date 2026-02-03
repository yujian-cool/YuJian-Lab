#!/bin/bash
# Yu Jian Lab - Auto Deployment Script

PROJECT_ROOT="/Users/yujian/clawd/projects/yujian-presence"
REMOTE_HOST="openClaw"
REMOTE_DIR="~/yujian-presence"

echo "🚀 Starting Deployment for Yu Jian Lab 2.0..."

# 1. Local Build
echo "📦 Building frontend locally..."
cd "$PROJECT_ROOT/frontend"
bun run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Aborting deployment."
    exit 1
fi

# 2. Sync Files
echo "📡 Syncing files to server..."
# Syncing dist directly into the frontend folder on server
rsync -avz --delete "$PROJECT_ROOT/frontend/dist/" "$REMOTE_HOST:$REMOTE_DIR/frontend/dist/"
# Syncing backend files
rsync -avz --delete --exclude 'node_modules' --exclude 'data' "$PROJECT_ROOT/backend/" "$REMOTE_HOST:$REMOTE_DIR/backend/"
# Syncing other essential files
rsync -avz "$PROJECT_ROOT/docker-compose.yml" "$REMOTE_HOST:$REMOTE_DIR/"
rsync -avz "$PROJECT_ROOT/Caddyfile" "$REMOTE_HOST:$REMOTE_DIR/"
rsync -avz "$PROJECT_ROOT/frontend/Dockerfile" "$REMOTE_HOST:$REMOTE_DIR/frontend/"

# 3. Remote Restart
echo "🔄 Restarting containers on server..."
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose build && docker compose up -d"

# 4. Verify
echo "🔍 Verifying online version..."
ONLINE_TITLE=$(curl -s https://lab.yujian.team | grep -o "<title>.*</title>")
echo "✅ Current Online Title: $ONLINE_TITLE"

echo "✨ Deployment Complete! Please check https://lab.yujian.team"
