import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { initDb, db } from './src/db'
import { statusRoutes, historyRoutes, statsRoutes } from './src/routes'
import { systemRoutes } from './src/routes/system'
import { createWebSocketPlugin } from './src/websocket'

initDb()

// 创建 WebSocket 插件
const websocketPlugin = createWebSocketPlugin(db, {
  heartbeatInterval: 30000,      // 30秒心跳间隔
  heartbeatTimeout: 60000,     // 60秒超时
  maxConnectionsPerUser: 3,    // 每用户最大3个连接
  maxTotalConnections: 10000,  // 全局最大10000连接
  broadcastBatchSize: 100,     // 批量广播100条
  broadcastFlushInterval: 50,  // 50ms刷新间隔
  defaultHistoryLimit: 50,     // 默认历史数据50条
})

const app = new Elysia()
  .use(cors())
  // HTTP REST API 路由
  .use(statusRoutes)
  .use(historyRoutes)
  .use(statsRoutes)
  .use(systemRoutes)
  // WebSocket 实时通信
  .use(websocketPlugin)
  .listen(3001)

console.log(`🦊 Elysia 2.0 is running at ${app.server?.hostname}:${app.server?.port}`)
console.log(`📡 WebSocket endpoint: ws://${app.server?.hostname}:${app.server?.port}/ws/realtime`)

// 导出 app 用于测试
export { app, websocketPlugin }
