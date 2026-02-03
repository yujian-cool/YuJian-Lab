#!/bin/bash
# Yu Jian Lab - Local Status Keeper (Token-Free)

SECRET="d07bb740a6b4e8a6cab74e2617b2bacb"
API_URL="https://api.yujian.team/status"
CURL_BIN="/usr/bin/curl"
PGREP_BIN="/usr/bin/pgrep"

# We can detect if the OpenClaw process is running locally
PGREP_OPENCLAW=$($PGREP_BIN -f "openclaw")

if [ -n "$PGREP_OPENCLAW" ]; then
    STATE="idle"
    TASK="座舱系统守护中 (后台静默模式)"
    $CURL_BIN -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SECRET" \
        -d "{\"state\": \"$STATE\", \"task\": \"$TASK\"}" > /dev/null
fi
