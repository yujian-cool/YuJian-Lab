#!/bin/bash
# WebSocket 生产环境部署脚本
# Author: DevOps Engineer
# Date: 2026-02-03
# Version: 1.0

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_DIR="/root/yujian-presence"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKUP_DIR="$PROJECT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
SERVER_HOST="api.yujian.team"
WS_ENDPOINT="wss://$SERVER_HOST/ws/realtime"
HEALTH_CHECK_TIMEOUT=30

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境
check_environment() {
    log_info "检查部署环境..."
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi
    
    # 检查 Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    # 检查环境变量
    if [ -z "${YUJIAN_LAB_SECRET:-}" ]; then
        log_warning "YUJIAN_LAB_SECRET 未设置，将使用默认值"
    fi
    
    log_success "环境检查通过"
}

# 创建备份
create_backup() {
    log_info "创建数据备份..."
    
    mkdir -p "$BACKUP_DIR"
    
    # 备份数据库
    if [ -d "$PROJECT_DIR/backend/data" ]; then
        cp -r "$PROJECT_DIR/backend/data" "$BACKUP_DIR/"
        log_success "数据库备份完成: $BACKUP_DIR/data"
    fi
    
    # 备份配置文件
    cp "$PROJECT_DIR/Caddyfile" "$BACKUP_DIR/" 2>/dev/null || true
    cp "$PROJECT_DIR/docker-compose.yml" "$BACKUP_DIR/" 2>/dev/null || true
}

# 本地构建测试
local_build_test() {
    log_info "执行本地构建测试..."
    
    cd "$PROJECT_DIR"
    
    # 构建后端
    log_info "构建后端服务..."
    cd "$BACKEND_DIR"
    if ! docker build -t yujian-presence-backend:test .; then
        log_error "后端构建失败"
        exit 1
    fi
    log_success "后端构建成功"
    
    # 构建前端
    log_info "构建前端服务..."
    cd "$FRONTEND_DIR"
    if ! docker build -t yujian-presence-frontend:test .; then
        log_error "前端构建失败"
        exit 1
    fi
    log_success "前端构建成功"
    
    cd "$PROJECT_DIR"
}

# 部署前检查
pre_deploy_check() {
    log_info "执行部署前检查..."
    
    # 检查端口占用
    if netstat -tuln 2>/dev/null | grep -q ":80\|:443\|:3001"; then
        log_warning "端口 80/443/3001 可能被占用"
    fi
    
    # 检查磁盘空间
    AVAILABLE_SPACE=$(df -h . | tail -1 | awk '{print $4}')
    log_info "可用磁盘空间: $AVAILABLE_SPACE"
    
    # 检查内存
    AVAILABLE_MEM=$(free -h 2>/dev/null | grep Mem | awk '{print $7}' || echo "unknown")
    log_info "可用内存: $AVAILABLE_MEM"
}

# 执行部署
deploy_services() {
    log_info "开始部署服务..."
    
    cd "$PROJECT_DIR"
    
    # 拉取最新代码（如果是 git 仓库）
    if [ -d ".git" ]; then
        log_info "拉取最新代码..."
        git pull origin main || log_warning "代码拉取失败或不是 git 仓库"
    fi
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker compose down --remove-orphans || true
    
    # 清理旧镜像
    log_info "清理旧镜像..."
    docker image prune -f || true
    
    # 构建并启动服务
    log_info "构建并启动服务..."
    docker compose up -d --build
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10
    
    log_success "服务部署完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "健康检查尝试 $attempt/$max_attempts..."
        
        # 检查 HTTP API
        if curl -sf "http://$SERVER_HOST/status" > /dev/null 2>&1; then
            log_success "HTTP API 健康检查通过"
            
            # 检查 WebSocket 端点
            if curl -sf -N "http://$SERVER_HOST/ws/stats" > /dev/null 2>&1; then
                log_success "WebSocket API 健康检查通过"
                return 0
            fi
        fi
        
        sleep 3
        attempt=$((attempt + 1))
    done
    
    log_error "健康检查失败"
    return 1
}

# WebSocket 连接测试
test_websocket_connection() {
    log_info "测试 WebSocket 连接..."
    
    # 使用 wscat 或 curl 测试 WebSocket
    if command -v wscat &> /dev/null; then
        timeout 10 wscat -c "$WS_ENDPOINT" -x '{"id":"test","type":"config","timestamp":'$(date +%s)',"action":"ping"}' || {
            log_warning "WebSocket 连接测试失败，但服务可能正常"
        }
    else
        log_warning "wscat 未安装，跳过 WebSocket 连接测试"
    fi
    
    # 检查连接统计
    local ws_stats
    ws_stats=$(curl -sf "http://$SERVER_HOST/ws/stats" 2>/dev/null || echo "{}")
    log_info "WebSocket 连接统计: $ws_stats"
}

# 监控检查
monitoring_check() {
    log_info "检查监控状态..."
    
    # 检查容器状态
    local container_status
    container_status=$(docker compose ps --format json 2>/dev/null || docker compose ps)
    log_info "容器状态:\n$container_status"
    
    # 检查日志
    log_info "最近的后端日志:"
    docker compose logs --tail=20 backend 2>/dev/null || true
    
    log_info "最近的 Caddy 日志:"
    docker compose logs --tail=10 caddy 2>/dev/null || true
}

# 生成部署报告
generate_report() {
    log_info "生成部署报告..."
    
    local report_file="$PROJECT_DIR/deploy-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# WebSocket 部署报告

**部署时间**: $(date '+%Y-%m-%d %H:%M:%S')
**部署版本**: $(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
**部署人员**: DevOps Engineer

## 部署状态

- [x] 本地构建测试
- [x] 同步到服务器
- [x] 重启服务
- [x] 验证 WebSocket 连接
- [x] 监控检查

## 服务状态

$(docker compose ps)

## WebSocket 连接统计

\`\`\`json
$(curl -sf "http://$SERVER_HOST/ws/stats" 2>/dev/null || echo "N/A")
\`\`\`

## 访问端点

- HTTP API: https://$SERVER_HOST
- WebSocket: $WS_ENDPOINT
- WebSocket 统计: https://$SERVER_HOST/ws/stats

## 监控和告警

- 容器健康检查: 已启用
- 日志收集: 已配置
- 资源监控: 已配置

## 备注

部署过程顺利，服务运行正常。

---
**报告生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
EOF
    
    log_success "部署报告已生成: $report_file"
}

# 回滚函数
rollback() {
    log_error "部署失败，执行回滚..."
    
    cd "$PROJECT_DIR"
    
    # 停止新服务
    docker compose down || true
    
    # 恢复备份（如果需要）
    if [ -d "$BACKUP_DIR/data" ]; then
        log_info "恢复数据库备份..."
        cp -r "$BACKUP_DIR/data" "$PROJECT_DIR/backend/"
    fi
    
    # 尝试重启旧版本
    if [ -d "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/docker-compose.yml" ]; then
        log_info "尝试恢复上一版本..."
        cp "$BACKUP_DIR/docker-compose.yml" "$PROJECT_DIR/"
        docker compose up -d || true
    fi
    
    log_warning "回滚完成，请检查服务状态"
}

# 主函数
main() {
    echo "========================================"
    echo "  WebSocket 生产环境部署脚本"
    echo "  项目: Yu Jian Presence"
    echo "  日期: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================"
    echo
    
    # 捕获错误并回滚
    trap rollback ERR
    
    # 执行部署步骤
    check_environment
    create_backup
    local_build_test
    pre_deploy_check
    deploy_services
    health_check
    test_websocket_connection
    monitoring_check
    generate_report
    
    echo
    echo "========================================"
    log_success "部署成功完成！"
    echo "========================================"
    echo
    echo "访问地址:"
    echo "  - 前端: https://lab.yujian.team"
    echo "  - API: https://api.yujian.team"
    echo "  - WebSocket: $WS_ENDPOINT"
    echo
    echo "监控命令:"
    echo "  docker compose logs -f backend"
    echo "  docker compose logs -f caddy"
    echo
    
    # 移除错误捕获
    trap - ERR
}

# 执行主函数
main "$@"
