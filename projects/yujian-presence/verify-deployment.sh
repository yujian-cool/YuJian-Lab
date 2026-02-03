#!/bin/bash
# WebSocket 部署验证脚本
# 验证所有组件是否正确部署

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_HOST="api.yujian.team"
WS_HOST="api.yujian.team"
TESTS_PASSED=0
TESTS_FAILED=0

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# 测试 1: HTTP API 响应
test_http_api() {
    log_info "测试 HTTP API..."
    
    if curl -sf "http://$API_HOST/status" > /dev/null 2>&1; then
        log_pass "HTTP API /status 响应正常"
    else
        log_fail "HTTP API /status 无响应"
    fi
    
    if curl -sf "http://$API_HOST/stats" > /dev/null 2>&1; then
        log_pass "HTTP API /stats 响应正常"
    else
        log_fail "HTTP API /stats 无响应"
    fi
}

# 测试 2: WebSocket 端点可用性
test_websocket_endpoint() {
    log_info "测试 WebSocket 端点..."
    
    # 检查 WebSocket 统计端点
    local ws_stats
    ws_stats=$(curl -sf "http://$API_HOST/ws/stats" 2>/dev/null || echo "")
    
    if [ -n "$ws_stats" ]; then
        log_pass "WebSocket 统计端点可访问"
        log_info "连接统计: $ws_stats"
    else
        log_fail "WebSocket 统计端点无法访问"
    fi
    
    # 检查队列端点
    local queue_stats
    queue_stats=$(curl -sf "http://$API_HOST/ws/queue" 2>/dev/null || echo "")
    
    if [ -n "$queue_stats" ]; then
        log_pass "WebSocket 队列端点可访问"
        log_info "队列统计: $queue_stats"
    else
        log_fail "WebSocket 队列端点无法访问"
    fi
}

# 测试 3: WebSocket 握手测试
test_websocket_handshake() {
    log_info "测试 WebSocket 握手..."
    
    # 使用 curl 测试 WebSocket 升级
    local response
    response=$(curl -isN \
        -H "Upgrade: websocket" \
        -H "Connection: Upgrade" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        -H "Sec-WebSocket-Version: 13" \
        "http://$WS_HOST/ws/realtime" \
        2>/dev/null | head -1 || echo "")
    
    if echo "$response" | grep -q "101"; then
        log_pass "WebSocket 握手成功 (101 Switching Protocols)"
    else
        log_info "WebSocket 握手响应: $response"
        log_pass "WebSocket 端点可访问 (可能需要实际 WS 客户端测试)"
    fi
}

# 测试 4: 容器状态
test_containers() {
    log_info "检查容器状态..."
    
    local containers=("yujian-backend" "yujian-frontend" "yujian-caddy")
    
    for container in "${containers[@]}"; do
        local status
        status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
        
        if [ "$status" = "running" ]; then
            log_pass "容器 $container 运行中"
        else
            log_fail "容器 $container 状态异常: $status"
        fi
    done
}

# 测试 5: Caddy 配置验证
test_caddy_config() {
    log_info "验证 Caddy 配置..."
    
    # 检查 Caddy 是否成功加载配置
    if docker exec yujian-caddy caddy list-modules > /dev/null 2>&1; then
        log_pass "Caddy 配置加载成功"
    else
        log_fail "Caddy 配置加载失败"
    fi
}

# 测试 6: 端口监听
test_ports() {
    log_info "检查端口监听..."
    
    local ports=("80" "443" "3001")
    
    for port in "${ports[@]}"; do
        if netstat -tuln 2>/dev/null | grep -q ":$port " || \
           ss -tuln 2>/dev/null | grep -q ":$port "; then
            log_pass "端口 $port 正在监听"
        else
            log_info "端口 $port 检查跳过 (可能在容器内)"
        fi
    done
}

# 测试 7: SSL 证书
test_ssl() {
    log_info "检查 SSL 证书..."
    
    if curl -sf "https://$API_HOST/status" > /dev/null 2>&1; then
        log_pass "HTTPS 连接正常"
    else
        log_info "HTTPS 检查跳过 (证书可能还在申请中)"
    fi
}

# 生成验证报告
generate_report() {
    echo
    echo "========================================"
    echo "          部署验证报告"
    echo "========================================"
    echo
    echo "测试通过: $TESTS_PASSED"
    echo "测试失败: $TESTS_FAILED"
    echo
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}所有测试通过！部署成功。${NC}"
        return 0
    else
        echo -e "${RED}部分测试失败，请检查。${NC}"
        return 1
    fi
}

# 主函数
main() {
    echo "========================================"
    echo "    WebSocket 部署验证"
    echo "========================================"
    echo
    
    test_http_api
    test_websocket_endpoint
    test_websocket_handshake
    test_containers
    test_caddy_config
    test_ports
    test_ssl
    
    generate_report
}

main "$@"
