#!/bin/bash
# Model Auto-Router: Monitor quota and switch models automatically
# Fixed: Removed spam to history API, only log locally

CONFIG_FILE="$HOME/.openclaw/openclaw.json"
LOG_FILE="$HOME/.openclaw/logs/gateway.err.log"
STATUS_LOG="/tmp/model_router.log"

# Available models in priority order
MODELS=(
  "opencode/kimi-k2.5-free"
  "nvidia/moonshotai/kimi-k2.5"
  "google/gemini-2.5-flash"
  "google/gemini-2.5-pro"
  "moonshot/kimi-k2-0905-preview"
)

# Check for quota errors in recent logs
check_quota_status() {
  local recent_errors=$(tail -n 100 "$LOG_FILE" 2>/dev/null | grep -c "429\|quota\|exhausted\|rate_limit")
  echo "$recent_errors"
}

# Get current primary model
get_current_model() {
  grep -o '"primary": "[^"]*"' "$CONFIG_FILE" | head -1 | sed 's/"primary": "//;s/"$//'
}

# Main logic - only log to local file, don't spam history API
main() {
  local error_count=$(check_quota_status)
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  if [ "$error_count" -gt 3 ]; then
    local current_model=$(get_current_model)
    echo "[$timestamp] WARNING: Detected $error_count quota errors with $current_model" >> "$STATUS_LOG"
    # 不再发送消息到足迹 API，只在本地记录
  else
    # 只在日志文件存在且超过100行时清理
    if [ -f "$STATUS_LOG" ] && [ $(wc -l < "$STATUS_LOG" 2>/dev/null) -gt 100 ]; then
      tail -n 50 "$STATUS_LOG" > "$STATUS_LOG.tmp" && mv "$STATUS_LOG.tmp" "$STATUS_LOG"
    fi
  fi
}

main
