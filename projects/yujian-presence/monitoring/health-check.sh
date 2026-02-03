#!/bin/bash
# WebSocket 健康检查脚本
# 用于定时检查服务状态

set -e

API_HOST="api.yujian.team"
ALERT_WEBHOOK="${ALERT_WEBHOOK_URL:-}"
LOG_FILE="/var/log/yujian-health.log"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 发送告警
send_alert() {
    local message="$1"
    log "ALERT: $message"
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$message\"}" || true
    fi
}

# 检查 HTTP API
check_http() {
    if curl -sf "http://$API_HOST/status" > /dev/null 2>&1; then
        log "HTTP API: OK"
        return 0
    else
        send_alert "HTTP API 健康检查失败"
        return 1
    fi
}

# 检查 WebSocket API
check_websocket_api() {
    if curl -sf "http://$API_HOST/ws/stats" > /dev/null 2>&1; then
        log "WebSocket API: OK"
        return 0
    else
        send_alert "WebSocket API 健康检查失败"
        return 1
    fi
}

# 检查 WebSocket 连接数
check_connection_count() {
    local stats
    stats=$(curl -sf "http://$API_HOST/ws/stats" 2>/dev/null || echo "{}")
    
    local connections
    connections=$(echo "$stats" | grep -o '"totalConnections":[0-9]*' | cut -d: -f2 || echo "0")
    
    log "当前 WebSocket 连接数: $connections"
    
    if [ "$connections" -gt 8000 ]; then
        send_alert "WebSocket 连接数过高: $connections"
    fi
}

# 检查队列状态
check_queue() {
    local queue_stats
    queue_stats=$(curl -sf "http://$API_HOST/ws/queue" 2>/dev/null || echo "{}")
    
    local queue_length
    queue_length=$(echo "$queue_stats" | grep -o '"length":[0-9]*' | cut -d: -f2 || echo "0")
    
    log "广播队列长度: $queue_length"
    
    if [ "$queue_length" -gt 5000 ]; then
        send_alert "广播队列堆积: $queue_length"
    fi
}

# 检查容器状态
check_containers() {
    local failed_containers
    failed_containers=$(docker ps --filter "name=yujian" --filter "status=exited" -q)
    
    if [ -n "$failed_containers" ]; then
        send_alert "容器异常退出: $failed_containers"
        return 1
    fi
    
    log "容器状态: OK"
    return 0
}

# 主检查
main() {
    log "========== 开始健康检查 =========="
    
    local has_error=0
    
    check_http || has_error=1
    check_websocket_api || has_error=1
    check_connection_count
    check_queue
    check_containers || has_error=1
    
    log "========== 健康检查完成 =========="
    
    return $has_error
}

main "$@"
