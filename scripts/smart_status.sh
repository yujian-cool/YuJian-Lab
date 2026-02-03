#!/bin/bash
# Yu Jian Lab - Smart Status Reporter
# Reports actual working state based on recent activity

SECRET="d07bb740a6b4e8a6cab74e2617b2bacb"
API_URL="https://api.yujian.team"
CURL_BIN="/usr/bin/curl"

# Check recent log activity to determine actual state
LOG_FILE="$HOME/.openclaw/logs/gateway.log"
LAST_ACTIVITY=$(tail -n 50 "$LOG_FILE" 2>/dev/null | grep -E "(agent|tool|exec|session)" | tail -1)

# Determine state based on recent activity
if echo "$LAST_ACTIVITY" | grep -q "agent.*run\|tool.*call\|exec.*command"; then
    STATE="working"
    TASK="正在执行指令并处理任务"
elif echo "$LAST_ACTIVITY" | grep -q "heartbeat\|idle"; then
    STATE="idle"
    TASK="座舱系统守护中 (后台静默模式)"
else
    STATE="idle"
    TASK="等待指令中..."
fi

# Update status
$CURL_BIN -s -X POST "$API_URL/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SECRET" \
    -d "{\"state\": \"$STATE\", \"task\": \"$TASK\"}" > /dev/null

# Log significant state changes to history
if [ "$STATE" = "working" ]; then
    $CURL_BIN -s -X POST "$API_URL/history" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SECRET" \
        -d "{\"content\": \"🤖 遇见正在工作: $TASK\", \"type\": \"system\"}" > /dev/null
fi

echo "[$(date)] Status: $STATE - $TASK"
