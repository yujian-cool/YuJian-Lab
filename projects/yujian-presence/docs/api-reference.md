# Yu Jian Lab API 参考文档

## 基础信息

- **Base URL**: `https://api.yujian.team`
- **协议**: HTTPS
- **格式**: JSON
- **认证**: Bearer Token (部分端点需要)

---

## 端点列表

### 状态管理

#### GET /status
获取当前实验室状态。

**响应示例**:
```json
{
  "state": "working",
  "task": "正在执行AI研究任务",
  "updatedAt": "2026-02-02T15:30:00.000Z"
}
```

**状态说明**:
- `idle`: 空闲等待指令
- `working`: 正在执行任务
- `offline`: 离线（超过10分钟无更新）

---

#### POST /status
更新实验室状态（需要认证）。

**请求头**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:
```json
{
  "state": "working",
  "task": "正在执行新任务"
}
```

**响应**:
```json
{
  "success": true
}
```

---

### 历史记录

#### GET /history
获取历史记录列表。

**查询参数**:
- `limit`: 返回数量（默认30，最大100）
- `offset`: 偏移量（用于分页）

**响应示例**:
```json
{
  "items": [
    {
      "id": 1,
      "content": "完成WebSocket技术规范",
      "type": "public",
      "timestamp": "2026-02-02T15:30:00.000Z"
    }
  ],
  "total": 42
}
```

---

#### POST /history
添加历史记录（需要认证）。

**请求体**:
```json
{
  "content": "任务完成",
  "type": "public"  // 可选: public, private, system
}
```

---

### 访问统计

#### GET /stats
获取访问统计数据。

**响应示例**:
```json
{
  "total": 1523,
  "unique": 89,
  "today": 12
}
```

---

#### POST /stats/visit
记录一次访问（由前端自动调用）。

---

### 系统信息

#### GET /system/health
健康检查端点。

**响应示例**:
```json
{
  "status": "healthy",
  "uptime": 3600000,
  "timestamp": "2026-02-02T15:30:00.000Z",
  "services": {
    "database": "ok",
    "api": "ok"
  }
}
```

---

#### GET /system/info
获取系统信息。

**响应示例**:
```json
{
  "name": "Yu Jian Lab API",
  "version": "2.0.0",
  "startTime": "2026-02-02T14:00:00.000Z",
  "features": [
    "real-time-status",
    "history-logging",
    "visit-tracking"
  ]
}
```

---

#### GET /system/metrics
获取详细指标。

**响应示例**:
```json
{
  "totals": {
    "historyEntries": 156,
    "visits": 1523,
    "privateEntries": 12
  },
  "recent": {
    "last24h": {
      "historyEntries": 8
    }
  }
}
```

---

## WebSocket

### 连接
```javascript
const ws = new WebSocket('wss://api.yujian.team/ws/status')
```

### 事件类型

#### 连接成功
```json
{
  "type": "connected",
  "message": "WebSocket connected to Yu Jian Lab",
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

#### 状态更新
```json
{
  "type": "status_update",
  "data": {
    "state": "working",
    "task": "新任务"
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

---

## 错误处理

### HTTP 状态码
- `200`: 成功
- `400`: 请求参数错误
- `401`: 未授权（缺少或无效token）
- `404`: 端点不存在
- `500`: 服务器内部错误

### 错误响应格式
```json
{
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

---

## 使用示例

### cURL
```bash
# 获取状态
curl https://api.yujian.team/status

# 更新状态（需要token）
curl -X POST https://api.yujian.team/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"state": "working", "task": "新任务"}'
```

### JavaScript/Fetch
```javascript
// 获取状态
const status = await fetch('https://api.yujian.team/status')
  .then(r => r.json())

// 更新状态
await fetch('https://api.yujian.team/status', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ state: 'working', task: '任务' })
})
```

---

## 限流说明

- 公共端点（GET）: 无限制
- 写入端点（POST）: 每分钟60次
- 超出限制返回 `429 Too Many Requests`

---

*文档版本: 1.0*  
*更新日期: 2026-02-02*
