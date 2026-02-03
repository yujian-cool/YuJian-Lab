# WebSocket 生产环境部署报告

**项目名称**: Yu Jian Presence - WebSocket 实时数据推送系统  
**部署日期**: 2026-02-03  
**部署工程师**: DevOps Engineer  
**部署版本**: Sprint 1 (WebSocket 功能)

---

## 1. 部署概述

本次部署将 WebSocket 实时通信功能上线到生产环境，包括：
- 后端 WebSocket 服务 (Elysia + Bun)
- 前端 WebSocket 客户端集成
- Caddy 反向代理 WebSocket 配置
- 监控和告警系统

## 2. 交付物清单

### 2.1 配置文件

| 文件 | 路径 | 说明 |
|------|------|------|
| docker-compose.yml | `/root/yujian-presence/docker-compose.yml` | 容器编排配置，含健康检查 |
| Caddyfile | `/root/yujian-presence/Caddyfile` | WebSocket 代理配置 |

### 2.2 部署脚本

| 脚本 | 路径 | 功能 |
|------|------|------|
| deploy-websocket.sh | `/root/yujian-presence/deploy-websocket.sh` | 完整部署流程 |
| verify-deployment.sh | `/root/yujian-presence/verify-deployment.sh` | 部署验证测试 |

### 2.3 监控配置

| 文件 | 路径 | 说明 |
|------|------|------|
| prometheus.yml | `/root/yujian-presence/monitoring/prometheus.yml` | Prometheus 监控配置 |
| alerts.yml | `/root/yujian-presence/monitoring/alerts.yml` | 告警规则 |
| health-check.sh | `/root/yujian-presence/monitoring/health-check.sh` | 健康检查脚本 |

## 3. 架构配置

### 3.1 WebSocket 服务端点

```
WebSocket URL: wss://api.yujian.team/ws/realtime
HTTP API:      https://api.yujian.team
前端页面:      https://lab.yujian.team
```

### 3.2 Caddy WebSocket 代理配置

```caddyfile
api.yujian.team {
    # 标准 HTTP 代理
    reverse_proxy backend:3001
    
    # WebSocket 特定路由
    handle /ws/* {
        reverse_proxy backend:3001 {
            transport http {
                compression off      # 禁用压缩
                dial_timeout 10s     # 连接超时
                keepalive 5m         # 保持长连接
            }
            header_up Connection Upgrade
            header_up Upgrade websocket
        }
    }
}
```

### 3.3 Docker Compose 服务配置

```yaml
backend:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/status"]
    interval: 30s
    timeout: 10s
    retries: 3
  deploy:
    resources:
      limits:
        memory: 512M
```

## 4. 部署步骤

### 4.1 本地构建测试

```bash
cd /root/yujian-presence/backend
docker build -t yujian-presence-backend:test .

cd /root/yujian-presence/frontend
docker build -t yujian-presence-frontend:test .
```

### 4.2 生产环境部署

```bash
cd /root/yujian-presence
./deploy-websocket.sh
```

部署脚本执行流程：
1. 环境检查 (Docker, 环境变量)
2. 数据备份
3. 本地构建测试
4. 部署前检查 (端口、磁盘空间)
5. 服务部署 (docker compose up)
6. 健康检查
7. WebSocket 连接测试
8. 生成部署报告

### 4.3 部署验证

```bash
cd /root/yujian-presence
./verify-deployment.sh
```

验证项目：
- HTTP API 响应测试
- WebSocket 端点可用性
- WebSocket 握手测试
- 容器状态检查
- Caddy 配置验证
- 端口监听检查
- SSL 证书检查

## 5. WebSocket 功能验证

### 5.1 连接测试

```javascript
// 浏览器控制台测试
const ws = new WebSocket('wss://api.yujian.team/ws/realtime');

ws.onopen = () => {
  console.log('连接成功');
  ws.send(JSON.stringify({
    id: crypto.randomUUID(),
    type: 'config',
    timestamp: Date.now(),
    action: 'subscribe',
    payload: { types: ['status', 'stats', 'health'] }
  }));
};

ws.onmessage = (event) => {
  console.log('收到消息:', JSON.parse(event.data));
};
```

### 5.2 监控端点

```bash
# 查看 WebSocket 连接统计
curl https://api.yujian.team/ws/stats

# 查看广播队列状态
curl https://api.yujian.team/ws/queue
```

## 6. 监控和告警

### 6.1 健康检查

健康检查脚本位置：`/root/yujian-presence/monitoring/health-check.sh`

检查项：
- HTTP API 可用性
- WebSocket API 可用性
- 连接数监控 (>8000 告警)
- 队列堆积监控 (>5000 告警)
- 容器状态

### 6.2 告警规则

| 告警名称 | 条件 | 级别 |
|---------|------|------|
| WebSocketHighConnectionCount | 连接数 > 8000 | warning |
| WebSocketNoConnections | 连接数 = 0 | critical |
| BackendDown | 后端无响应 | critical |
| HighMemoryUsage | 内存 > 400MB | warning |
| HighCPUUsage | CPU > 80% | warning |

### 6.3 日志查看

```bash
# 实时查看后端日志
docker compose logs -f backend

# 查看 Caddy 访问日志
docker compose logs -f caddy

# 查看最近 100 条日志
docker compose logs --tail=100 backend
```

## 7. 性能指标

### 7.1 WebSocket 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| heartbeatInterval | 30000ms | 心跳间隔 |
| heartbeatTimeout | 60000ms | 心跳超时 |
| maxConnectionsPerUser | 3 | 每用户最大连接数 |
| maxTotalConnections | 10000 | 全局最大连接数 |
| broadcastBatchSize | 100 | 广播批处理大小 |
| broadcastFlushInterval | 50ms | 广播刷新间隔 |
| defaultHistoryLimit | 50 | 默认历史数据条数 |

### 7.2 资源限制

| 服务 | 内存限制 | 说明 |
|------|---------|------|
| backend | 512MB | 含 WebSocket 服务 |
| frontend | 128MB | 静态资源服务 |
| caddy | 无限制 | 反向代理 |

## 8. 已知问题和注意事项

### 8.1 已修复的 Bug

根据测试报告，以下 Bug 已在代码中修复：
1. ✅ 广播队列大小限制 (添加 MAX_QUEUE_SIZE = 10000)
2. ✅ 阻止订阅 'error' 类型消息
3. ✅ 消息大小限制 (1MB)

### 8.2 部署后待办

1. 替换 ChangeDetector 中的模拟数据为真实数据源
2. 配置告警通知 Webhook
3. 进行压力测试验证性能指标
4. 补充单元测试覆盖率达到 80%

### 8.3 回滚方案

如需回滚，执行以下命令：

```bash
cd /root/yujian-presence
docker compose down
# 从备份恢复数据
cp -r backups/YYYYMMDD_HHMMSS/data backend/
docker compose up -d
```

## 9. 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | https://lab.yujian.team | React 应用 |
| HTTP API | https://api.yujian.team | REST API |
| WebSocket | wss://api.yujian.team/ws/realtime | WebSocket 连接 |
| WS 统计 | https://api.yujian.team/ws/stats | 连接统计 |
| WS 队列 | https://api.yujian.team/ws/queue | 队列状态 |

## 10. 部署结论

✅ **部署状态**: 成功

所有组件已正确配置并部署到生产环境：
- WebSocket 服务端正常运行
- Caddy 代理配置完成，支持 WebSocket 协议升级
- 监控和告警系统就绪
- 健康检查机制已启用

**建议**: 
1. 部署后 24 小时内密切监控连接数和内存使用
2. 观察广播队列长度，确保消息及时处理
3. 定期检查容器日志，及时发现异常

---

**部署工程师**: DevOps Engineer  
**审核**: 技术总监  
**日期**: 2026-02-03
