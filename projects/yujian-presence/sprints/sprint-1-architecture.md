# WebSocket 实时仪表盘 - 技术架构设计文档

**项目名称**: Yu Jian Presence - WebSocket 实时数据推送系统  
**版本**: 1.0  
**日期**: 2026-02-03  
**作者**: 系统架构师  
**状态**: 架构设计阶段  

---

## 1. 架构概述

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                客户端层 (Client Layer)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   React App     │  │   React App     │  │   React App     │              │
│  │   (用户A)        │  │   (用户B)        │  │   (用户C)        │              │
│  │                 │  │                 │  │                 │              │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │              │
│  │ │WebSocket    │ │  │ │WebSocket    │ │  │ │WebSocket    │ │              │
│  │ │Client Hook  │ │  │ │Client Hook  │ │  │ │Client Hook  │ │              │
│  │ │• 连接管理    │ │  │ │• 连接管理    │ │  │ │• 连接管理    │ │              │
│  │ │• 状态同步    │ │  │ │• 状态同步    │ │  │ │• 状态同步    │ │              │
│  │ │• 重连逻辑    │ │  │ │• 重连逻辑    │ │  │ │• 重连逻辑    │ │              │
│  │ └──────┬──────┘ │  │ └──────┬──────┘ │  │ └──────┬──────┘ │              │
│  └────────┼─────────┘  └────────┼─────────┘  └────────┼─────────┘              │
│           │                   │                   │                          │
│           └───────────────────┴───────────────────┘                          │
│                               │                                              │
│                          WSS/WS                                            │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────────────────┐
│                           Nginx 代理层                                       │
│                   ┌───────────┴───────────┐                                  │
│                   │ • WebSocket Upgrade    │                                  │
│                   │ • 负载均衡 (未来)       │                                  │
│                   │ • SSL/TLS 终端         │                                  │
│                   └───────────┬───────────┘                                  │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────────────────┐
│                            服务端层 (Server Layer)                            │
├───────────────────────────────┼──────────────────────────────────────────────┤
│                               │                                              │
│                   ┌───────────▼───────────┐                                  │
│                   │    Elysia + Bun       │                                  │
│                   │   ┌─────────────────┐   │                                  │
│                   │   │  HTTP Routes    │   │                                  │
│                   │   │  /status        │   │                                  │
│                   │   │  /history       │   │                                  │
│                   │   │  /stats         │   │                                  │
│                   │   │  /system/health │   │                                  │
│                   │   └────────┬────────┘   │                                  │
│                   │            │            │                                  │
│                   │   ┌────────▼────────┐   │                                  │
│                   │   │  WebSocket      │   │                                  │
│                   │   │  模块           │   │                                  │
│                   │   │                 │   │                                  │
│                   │   │ ┌─────────────┐ │   │                                  │
│                   │   │ │Connection   │ │   │    ┌─────────────┐               │
│                   │   │ │Manager      │◄┼───┼────┤ 订阅管理器   │               │
│                   │   │ │• 连接注册    │ │   │    │ Subscription │               │
│                   │   │ │• 连接统计    │ │   │    │ Manager      │               │
│                   │   │ │• 心跳检测    │ │   │    └──────┬──────┘               │
│                   │   │ └──────┬──────┘ │   │           │                        │
│                   │   │        │        │   │           ▼                        │
│                   │   │ ┌──────▼──────┐ │   │    ┌─────────────┐                 │
│                   │   │ │Message      │ │   │    │ 广播调度器   │                 │
│                   │   │ │Router       │ │   │    │ Broadcast   │                 │
│                   │   │ │             │ │   │    │ Scheduler   │                 │
│                   │   │ │• 消息解析   │ │   │    │             │                 │
│                   │   │ │• 路由分发   │◄┼───┼────┤• 消息队列   │                 │
│                   │   │ │• 权限验证   │ │   │    │• 批量广播   │                 │
│                   │   │ └──────┬──────┘ │   │    │• 过滤逻辑   │                 │
│                   │   │        │        │   │    └──────┬──────┘                 │
│                   │   │ ┌──────▼──────┐ │   │           │                          │
│                   │   │ │Event        │ │   │           ▼                        │
│                   │   │ │Handlers     │ │   │    ┌─────────────┐                 │
│                   │   │ │             │ │   │    │ 数据变更检测  │                 │
│                   │   │ │• handleStatus│ │   │    │ Change      │                 │
│                   │   │ │• handleStats │ │   │    │ Detector    │                 │
│                   │   │ │• handleHealth│ │   │    │             │                 │
│                   │   │ │• handleConfig│ │   │    │• 轮询检测    │                 │
│                   │   │ └─────────────┘ │   │    │• 事件触发    │                 │
│                   │   └─────────────────┘   │    └──────┬──────┘                 │
│                   └─────────────────────────┘           │                        │
│                                                         │                        │
│   ┌─────────────────────────────────────────────────────┼────────────────────┐   │
│   │                    数据层 (Data Layer)               │                    │   │
│   ├─────────────────────────────────────────────────────┼────────────────────┤   │
│   │                                                     ▼                    │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐                 │   │
│   │  │  SQLite     │  │  SQLite     │  │  内存缓存 (可选)       │                 │   │
│   │  │ status.db   │  │ stats.db    │  │  Redis/Memory       │                 │   │
│   │  │             │  │             │  │                     │                 │   │
│   │  │• 状态快照    │  │• 统计数据    │  │• 热点数据缓存         │                 │   │
│   │  │• 历史记录    │  │• 时间序列    │  │• 连接状态缓存         │                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘                 │   │
│   └────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 架构核心原则

| 原则 | 说明 |
|------|------|
| **模块化设计** | WebSocket 模块独立于 HTTP 路由，便于维护和扩展 |
| **事件驱动** | 基于事件的消息系统，支持灵活的消息类型扩展 |
| **订阅模式** | 客户端按需订阅，避免不必要的消息推送 |
| **容错设计** | 完整的连接生命周期管理，自动重连和恢复 |
| **渐进增强** | 支持从 REST API 平滑迁移到 WebSocket |

---

## 2. 后端 WebSocket 模块设计

### 2.1 模块结构

```
src/
├── websocket/
│   ├── index.ts              # WebSocket 模块入口
│   ├── connection/
│   │   ├── manager.ts        # 连接管理器
│   │   ├── store.ts          # 连接存储
│   │   └── heartbeat.ts      # 心跳管理
│   ├── message/
│   │   ├── router.ts         # 消息路由
│   │   ├── validator.ts      # 消息验证
│   │   └── handler.ts        # 消息处理器
│   ├── broadcast/
│   │   ├── scheduler.ts      # 广播调度器
│   │   └── filter.ts         # 消息过滤
│   ├── events/
│   │   ├── status.handler.ts # 状态事件处理器
│   │   ├── stats.handler.ts  # 统计事件处理器
│   │   ├── health.handler.ts # 健康事件处理器
│   │   └── index.ts          # 事件导出
│   └── types.ts              # TypeScript 类型定义
```

### 2.2 连接管理器 (Connection Manager)

```typescript
// websocket/connection/manager.ts

interface ConnectionMetadata {
  id: string;
  userId: string;
  socket: WebSocket;
  subscriptions: Set<MessageType>;
  connectedAt: Date;
  lastHeartbeat: Date;
  isAlive: boolean;
}

class ConnectionManager {
  private connections: Map<string, ConnectionMetadata> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  
  // 最大并发连接数限制
  private readonly MAX_CONNECTIONS_PER_USER = 3;
  
  register(socket: WebSocket, userId: string): string {
    const connectionId = generateUUID();
    
    // 检查用户连接数限制
    const userConns = this.userConnections.get(userId) || new Set();
    if (userConns.size >= this.MAX_CONNECTIONS_PER_USER) {
      throw new Error('MAX_CONNECTIONS_EXCEEDED');
    }
    
    const metadata: ConnectionMetadata = {
      id: connectionId,
      userId,
      socket,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isAlive: true
    };
    
    this.connections.set(connectionId, metadata);
    userConns.add(connectionId);
    this.userConnections.set(userId, userConns);
    
    return connectionId;
  }
  
  unregister(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      const userConns = this.userConnections.get(conn.userId);
      userConns?.delete(connectionId);
      this.connections.delete(connectionId);
    }
  }
  
  getConnection(id: string): ConnectionMetadata | undefined {
    return this.connections.get(id);
  }
  
  getAllConnections(): ConnectionMetadata[] {
    return Array.from(this.connections.values());
  }
  
  getUserConnections(userId: string): ConnectionMetadata[] {
    const ids = this.userConnections.get(userId) || new Set();
    return Array.from(ids)
      .map(id => this.connections.get(id))
      .filter((conn): conn is ConnectionMetadata => conn !== undefined);
  }
  
  getConnectionsBySubscription(type: MessageType): ConnectionMetadata[] {
    return this.getAllConnections().filter(conn => 
      conn.subscriptions.has(type) || conn.subscriptions.has('all')
    );
  }
  
  updateSubscription(connectionId: string, types: MessageType[]): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.subscriptions = new Set(types);
    }
  }
  
  markAlive(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.lastHeartbeat = new Date();
      conn.isAlive = true;
    }
  }
  
  getStats(): ConnectionStats {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      averageSubscriptions: this.calculateAverageSubscriptions()
    };
  }
}
```

### 2.3 消息路由 (Message Router)

```typescript
// websocket/message/router.ts

type MessageType = 'status' | 'stats' | 'health' | 'config' | 'all';
type MessageDirection = 'client-to-server' | 'server-to-client';

interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  direction: MessageDirection;
}

interface ClientMessage extends BaseMessage {
  direction: 'client-to-server';
  action: 'subscribe' | 'unsubscribe' | 'ping' | 'get_history';
  payload?: unknown;
}

interface ServerMessage extends BaseMessage {
  direction: 'server-to-client';
  event: string;
  data: unknown;
}

class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  private validator: MessageValidator;
  
  constructor(private connectionManager: ConnectionManager) {
    this.validator = new MessageValidator();
  }
  
  registerHandler(event: string, handler: MessageHandler): void {
    this.handlers.set(event, handler);
  }
  
  async route(connectionId: string, rawMessage: string): Promise<void> {
    try {
      // 1. 解析消息
      const message = JSON.parse(rawMessage) as ClientMessage;
      
      // 2. 验证消息格式
      const validation = this.validator.validate(message);
      if (!validation.valid) {
        await this.sendError(connectionId, 'INVALID_MESSAGE', validation.errors);
        return;
      }
      
      // 3. 路由到对应处理器
      const conn = this.connectionManager.getConnection(connectionId);
      if (!conn) return;
      
      switch (message.action) {
        case 'subscribe':
          await this.handleSubscribe(connectionId, message.payload as { types: MessageType[] });
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(connectionId, message.payload as { types: MessageType[] });
          break;
        case 'ping':
          await this.handlePing(connectionId);
          break;
        case 'get_history':
          await this.handleGetHistory(connectionId, message.payload as { type: MessageType; limit: number });
          break;
        default:
          await this.sendError(connectionId, 'UNKNOWN_ACTION', `Unknown action: ${message.action}`);
      }
    } catch (error) {
      await this.sendError(connectionId, 'PARSE_ERROR', 'Failed to parse message');
    }
  }
  
  private async handleSubscribe(connectionId: string, payload: { types: MessageType[] }): Promise<void> {
    const validTypes = payload.types.filter(t => isValidMessageType(t));
    this.connectionManager.updateSubscription(connectionId, validTypes);
    
    await this.sendAck(connectionId, 'subscribe', { 
      subscribed: validTypes,
      timestamp: Date.now()
    });
  }
  
  private async handlePing(connectionId: string): Promise<void> {
    this.connectionManager.markAlive(connectionId);
    await this.sendPong(connectionId);
  }
  
  private async sendError(connectionId: string, code: string, message: string): Promise<void> {
    const conn = this.connectionManager.getConnection(connectionId);
    if (conn) {
      const errorMessage: ServerMessage = {
        id: generateUUID(),
        type: 'error',
        timestamp: Date.now(),
        direction: 'server-to-client',
        event: 'error',
        data: { code, message }
      };
      conn.socket.send(JSON.stringify(errorMessage));
    }
  }
}
```

### 2.4 广播调度器 (Broadcast Scheduler)

```typescript
// websocket/broadcast/scheduler.ts

interface BroadcastTask {
  type: MessageType;
  event: string;
  data: unknown;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
}

class BroadcastScheduler {
  private messageQueue: BroadcastTask[] = [];
  private isProcessing = false;
  private batchSize = 100;
  private flushInterval = 50; // ms
  
  constructor(
    private connectionManager: ConnectionManager,
    private filter: MessageFilter
  ) {
    this.startFlushLoop();
  }
  
  enqueue(task: BroadcastTask): void {
    this.messageQueue.push(task);
    this.processQueue();
  }
  
  private startFlushLoop(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      // 按优先级和时间排序
      this.messageQueue.sort((a, b) => {
        const priorityWeight = { high: 0, normal: 1, low: 2 };
        if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
          return priorityWeight[a.priority] - priorityWeight[b.priority];
        }
        return a.timestamp - b.timestamp;
      });
      
      // 批量处理
      const batch = this.messageQueue.splice(0, this.batchSize);
      await this.broadcastBatch(batch);
    } finally {
      this.isProcessing = false;
      
      // 如果队列还有消息，继续处理
      if (this.messageQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }
  
  private async broadcastBatch(tasks: BroadcastTask[]): Promise<void> {
    // 按类型分组，减少遍历次数
    const tasksByType = this.groupByType(tasks);
    
    for (const [type, typeTasks] of tasksByType) {
      const connections = this.connectionManager.getConnectionsBySubscription(type);
      
      // 批量发送
      const message = JSON.stringify({
        id: generateUUID(),
        type,
        timestamp: Date.now(),
        direction: 'server-to-client',
        events: typeTasks.map(t => ({ event: t.event, data: t.data }))
      });
      
      // 使用 Promise.allSettled 确保部分失败不影响其他
      await Promise.allSettled(
        connections.map(conn => {
          if (conn.isAlive && conn.socket.readyState === WebSocket.OPEN) {
            return new Promise<void>((resolve) => {
              try {
                conn.socket.send(message);
                resolve();
              } catch (error) {
                resolve(); // 静默处理单个连接失败
              }
            });
          }
          return Promise.resolve();
        })
      );
    }
  }
  
  private groupByType(tasks: BroadcastTask[]): Map<MessageType, BroadcastTask[]> {
    const groups = new Map<MessageType, BroadcastTask[]>();
    for (const task of tasks) {
      if (!groups.has(task.type)) {
        groups.set(task.type, []);
      }
      groups.get(task.type)!.push(task);
    }
    return groups;
  }
  
  private flush(): void {
    if (this.messageQueue.length > 0 && !this.isProcessing) {
      this.processQueue();
    }
  }
  
  // 紧急广播（不走队列，立即发送）
  async broadcastUrgent(type: MessageType, event: string, data: unknown): Promise<void> {
    const connections = this.connectionManager.getConnectionsBySubscription(type);
    const message = JSON.stringify({
      id: generateUUID(),
      type,
      timestamp: Date.now(),
      direction: 'server-to-client',
      event,
      data
    });
    
    await Promise.allSettled(
      connections.map(conn => {
        if (conn.isAlive && conn.socket.readyState === WebSocket.OPEN) {
          conn.socket.send(message);
        }
      })
    );
  }
}
```

### 2.5 Elysia WebSocket 集成

```typescript
// websocket/index.ts

import { Elysia } from 'elysia';
import { websocket } from '@elysiajs/websocket';

export const websocketPlugin = new Elysia()
  .use(websocket())
  .ws('/ws', {
    // 连接建立
    open(ws) {
      const userId = extractUserId(ws); // 从 token 或 session 获取
      
      try {
        const connectionId = connectionManager.register(ws, userId);
        
        // 存储 connectionId 到 WebSocket 上下文
        (ws as any).connectionId = connectionId;
        
        // 发送连接成功消息
        ws.send(JSON.stringify({
          id: generateUUID(),
          type: 'system',
          timestamp: Date.now(),
          direction: 'server-to-client',
          event: 'connected',
          data: {
            connectionId,
            serverTime: Date.now(),
            supportedTypes: ['status', 'stats', 'health', 'config']
          }
        }));
        
        // 推送历史数据（最近50条）
        pushHistoryData(ws, connectionId);
        
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          event: 'connection_rejected',
          data: { reason: (error as Error).message }
        }));
        ws.close();
      }
    },
    
    // 收到消息
    message(ws, message) {
      const connectionId = (ws as any).connectionId;
      messageRouter.route(connectionId, message.toString());
    },
    
    // 连接关闭
    close(ws) {
      const connectionId = (ws as any).connectionId;
      if (connectionId) {
        connectionManager.unregister(connectionId);
      }
    },
    
    // 心跳配置
    heartbeat: {
      interval: 30, // 30秒
      timeout: 60   // 60秒超时
    }
  });

// 在主应用中使用
const app = new Elysia()
  .use(websocketPlugin)
  .get('/ws/stats', () => connectionManager.getStats());
```

### 2.6 数据变更检测与推送

```typescript
// events/status.handler.ts

class StatusChangeDetector {
  private lastStatus: SystemStatus | null = null;
  private checkInterval = 1000; // 每秒检查一次
  
  constructor(
    private db: Database,
    private broadcaster: BroadcastScheduler
  ) {
    this.startDetection();
  }
  
  private startDetection(): void {
    setInterval(async () => {
      await this.checkAndBroadcast();
    }, this.checkInterval);
  }
  
  private async checkAndBroadcast(): Promise<void> {
    const currentStatus = await this.db.query(
      'SELECT * FROM system_status ORDER BY timestamp DESC LIMIT 1'
    )[0];
    
    if (!currentStatus) return;
    
    // 检测变化
    const changes = this.detectChanges(this.lastStatus, currentStatus);
    
    if (changes.length > 0) {
      this.broadcaster.enqueue({
        type: 'status',
        event: 'status_update',
        data: {
          status: currentStatus,
          changes,
          timestamp: Date.now()
        },
        priority: this.calculatePriority(changes),
        timestamp: Date.now()
      });
    }
    
    this.lastStatus = currentStatus;
  }
  
  private detectChanges(old: SystemStatus | null, current: SystemStatus): Change[] {
    if (!old) return [{ field: 'all', oldValue: null, newValue: current }];
    
    const changes: Change[] = [];
    const fieldsToMonitor = ['cpuUsage', 'memoryUsage', 'diskUsage', 'activeConnections'];
    
    for (const field of fieldsToMonitor) {
      if (old[field] !== current[field]) {
        changes.push({
          field,
          oldValue: old[field],
          newValue: current[field],
          delta: current[field] - old[field]
        });
      }
    }
    
    return changes;
  }
  
  private calculatePriority(changes: Change[]): 'high' | 'normal' | 'low' {
    // 关键指标超过阈值则标记为高优先级
    const criticalFields = ['cpuUsage', 'memoryUsage'];
    const hasCritical = changes.some(c => 
      criticalFields.includes(c.field) && c.newValue > 80
    );
    
    if (hasCritical) return 'high';
    if (changes.length > 3) return 'normal';
    return 'low';
  }
}
```

---

## 3. 前端 WebSocket 客户端设计

### 3.1 模块结构

```
src/
├── hooks/
│   ├── useWebSocket.ts       # 主 WebSocket Hook
│   ├── useStatus.ts          # 状态数据 Hook
│   ├── useStats.ts           # 统计数据 Hook
│   └── useHealth.ts          # 健康数据 Hook
├── services/
│   └── websocket/
│       ├── client.ts         # WebSocket 客户端
│       ├── connection.ts     # 连接管理
│       ├── reconnector.ts    # 重连策略
│       ├── messageHandler.ts # 消息处理
│       └── subscription.ts   # 订阅管理
├── store/
│   └── websocket/
│       ├── connectionSlice.ts
│       ├── dataSlice.ts
│       └── index.ts
└── types/
    └── websocket.ts          # 类型定义
```

### 3.2 WebSocket Hook 设计

```typescript
// hooks/useWebSocket.ts

import { useEffect, useRef, useCallback, useState } from 'react';
import { WebSocketClient } from '@/services/websocket/client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setConnected,
  setDisconnected,
  setReconnecting,
  addMessage,
  setError
} from '@/store/websocket/connectionSlice';

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  subscriptions?: MessageType[];
  onMessage?: (message: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  lastMessage: ServerMessage | null;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (types: MessageType[]) => void;
  unsubscribe: (types: MessageType[]) => void;
  send: (message: ClientMessage) => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    subscriptions = ['status', 'stats', 'health'],
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;
  
  const dispatch = useAppDispatch();
  const clientRef = useRef<WebSocketClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [error, setLocalError] = useState<Error | null>(null);
  
  // 初始化客户端
  useEffect(() => {
    const client = new WebSocketClient({
      url,
      reconnectInterval,
      maxReconnectAttempts,
      onOpen: () => {
        setConnectionState('connected');
        dispatch(setConnected());
        onConnect?.();
        
        // 自动订阅
        client.subscribe(subscriptions);
      },
      onClose: () => {
        setConnectionState('disconnected');
        dispatch(setDisconnected());
        onDisconnect?.();
      },
      onReconnecting: (attempt) => {
        setConnectionState('reconnecting');
        dispatch(setReconnecting(attempt));
      },
      onMessage: (message) => {
        setLastMessage(message);
        dispatch(addMessage(message));
        onMessage?.(message);
      },
      onError: (err) => {
        setLocalError(err);
        dispatch(setError(err.message));
        onError?.(err);
      }
    });
    
    clientRef.current = client;
    
    if (autoConnect) {
      client.connect();
    }
    
    return () => {
      client.disconnect();
    };
  }, [url]);
  
  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);
  
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);
  
  const subscribe = useCallback((types: MessageType[]) => {
    clientRef.current?.subscribe(types);
  }, []);
  
  const unsubscribe = useCallback((types: MessageType[]) => {
    clientRef.current?.unsubscribe(types);
  }, []);
  
  const send = useCallback((message: ClientMessage) => {
    clientRef.current?.send(message);
  }, []);
  
  return {
    isConnected: connectionState === 'connected',
    isReconnecting: connectionState === 'reconnecting',
    connectionState,
    lastMessage,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send
  };
}
```

### 3.3 WebSocket 客户端类

```typescript
// services/websocket/client.ts

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface WebSocketClientOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: ServerMessage) => void;
  onError?: (error: Error) => void;
  onReconnecting?: (attempt: number) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPongTime = Date.now();
  private messageQueue: ClientMessage[] = [];
  private subscriptions: Set<MessageType> = new Set();
  
  constructor(private options: WebSocketClientOptions) {}
  
  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }
    
    this.state = 'connecting';
    
    try {
      this.ws = new WebSocket(this.options.url);
      
      this.ws.onopen = () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.flushMessageQueue();
        this.options.onOpen?.();
      };
      
      this.ws.onclose = () => {
        this.cleanup();
        this.options.onClose?.();
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        this.options.onError?.(new Error('WebSocket error'));
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          
          // 处理心跳响应
          if (message.event === 'pong') {
            this.lastPongTime = Date.now();
            return;
          }
          
          this.options.onMessage?.(message);
        } catch (error) {
          this.options.onError?.(new Error('Failed to parse message'));
        }
      };
      
    } catch (error) {
      this.options.onError?.(error as Error);
      this.attemptReconnect();
    }
  }
  
  disconnect(): void {
    this.cleanup();
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
  }
  
  subscribe(types: MessageType[]): void {
    types.forEach(t => this.subscriptions.add(t));
    
    if (this.state === 'connected') {
      this.send({
        id: generateUUID(),
        type: 'config',
        timestamp: Date.now(),
        direction: 'client-to-server',
        action: 'subscribe',
        payload: { types }
      });
    }
  }
  
  unsubscribe(types: MessageType[]): void {
    types.forEach(t => this.subscriptions.delete(t));
    
    if (this.state === 'connected') {
      this.send({
        id: generateUUID(),
        type: 'config',
        timestamp: Date.now(),
        direction: 'client-to-server',
        action: 'unsubscribe',
        payload: { types }
      });
    }
  }
  
  send(message: ClientMessage): void {
    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // 离线时加入队列
      this.messageQueue.push(message);
    }
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= (this.options.maxReconnectAttempts || 5)) {
      this.state = 'disconnected';
      this.options.onError?.(new Error('Max reconnection attempts reached'));
      return;
    }
    
    this.state = 'reconnecting';
    this.reconnectAttempts++;
    this.options.onReconnecting?.(this.reconnectAttempts);
    
    // 指数退避
    const delay = Math.min(
      (this.options.reconnectInterval || 3000) * Math.pow(1.5, this.reconnectAttempts - 1),
      30000 // 最大 30 秒
    );
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  private startHeartbeat(): void {
    const interval = this.options.heartbeatInterval || 30000;
    const timeout = this.options.heartbeatTimeout || 60000;
    
    this.heartbeatTimer = setInterval(() => {
      // 检查上次 pong 时间
      if (Date.now() - this.lastPongTime > timeout) {
        this.ws?.close();
        return;
      }
      
      // 发送 ping
      this.send({
        id: generateUUID(),
        type: 'system',
        timestamp: Date.now(),
        direction: 'client-to-server',
        action: 'ping'
      });
    }, interval);
  }
  
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }
  
  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
```

### 3.4 专用数据 Hooks

```typescript
// hooks/useStatus.ts

import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useWebSocket } from './useWebSocket';
import { updateStatus, setStatusHistory } from '@/store/websocket/dataSlice';

export function useStatus() {
  const dispatch = useAppDispatch();
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    url: getWebSocketUrl(),
    subscriptions: ['status']
  });
  
  const status = useAppSelector(state => state.websocket.data.status);
  const history = useAppSelector(state => state.websocket.data.statusHistory);
  
  useEffect(() => {
    if (isConnected) {
      subscribe(['status']);
    }
    
    return () => {
      unsubscribe(['status']);
    };
  }, [isConnected]);
  
  return {
    status,
    history,
    isConnected,
    // 派生数据
    cpuUsage: status?.cpuUsage ?? 0,
    memoryUsage: status?.memoryUsage ?? 0,
    activeConnections: status?.activeConnections ?? 0
  };
}
```

### 3.5 连接状态可视化组件

```typescript
// components/ConnectionStatus.tsx

import React from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

const stateConfig = {
  connected: {
    color: 'bg-green-500',
    text: '已连接',
    icon: '●'
  },
  reconnecting: {
    color: 'bg-yellow-500',
    text: '重连中',
    icon: '◐'
  },
  disconnected: {
    color: 'bg-red-500',
    text: '已断开',
    icon: '○'
  },
  connecting: {
    color: 'bg-blue-500',
    text: '连接中',
    icon: '◐'
  }
};

export function ConnectionStatus() {
  const { connectionState } = useWebSocket({
    url: getWebSocketUrl(),
    autoConnect: true
  });
  
  const config = stateConfig[connectionState];
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100">
      <span className={cn('w-2 h-2 rounded-full animate-pulse', config.color)} />
      <span className="text-sm text-gray-600">{config.icon}</span>
      <span className="text-sm font-medium text-gray-700">{config.text}</span>
    </div>
  );
}
```

---

## 4. 消息协议规范

### 4.1 消息格式定义

#### 4.1.1 基础消息结构

```typescript
// types/websocket.ts

// 消息类型
export type MessageType = 
  | 'status'      // 系统状态
  | 'stats'       // 统计数据
  | 'health'      // 健康监控
  | 'config'      // 配置/订阅
  | 'system'      // 系统消息
  | 'error';      // 错误

// 客户端动作
export type ClientAction = 
  | 'subscribe'      // 订阅消息类型
  | 'unsubscribe'    // 取消订阅
  | 'ping'           // 心跳请求
  | 'get_history'    // 获取历史数据
  | 'ack';           // 确认收到

// 服务端事件
export type ServerEvent = 
  | 'connected'        // 连接成功
  | 'disconnected'     // 断开连接
  | 'status_update'    // 状态更新
  | 'stats_update'     // 统计更新
  | 'health_alert'     // 健康告警
  | 'pong'             // 心跳响应
  | 'history_data'     // 历史数据
  | 'error'            // 错误
  | 'subscribed'       // 订阅确认
  | 'unsubscribed';    // 取消订阅确认
```

### 4.2 JSON Schema 定义

#### 4.2.1 客户端消息 Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WebSocket Client Message",
  "type": "object",
  "required": ["id", "type", "timestamp", "action"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "消息唯一标识"
    },
    "type": {
      "type": "string",
      "enum": ["status", "stats", "health", "config", "system"],
      "description": "消息类型"
    },
    "timestamp": {
      "type": "number",
      "description": "消息发送时间戳 (Unix ms)"
    },
    "action": {
      "type": "string",
      "enum": ["subscribe", "unsubscribe", "ping", "get_history"],
      "description": "客户端动作"
    },
    "payload": {
      "type": "object",
      "description": "动作相关数据"
    }
  },
  "allOf": [
    {
      "if": {
        "properties": { "action": { "const": "subscribe" } }
      },
      "then": {
        "properties": {
          "payload": {
            "type": "object",
            "required": ["types"],
            "properties": {
              "types": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": ["status", "stats", "health", "all"]
                },
                "minItems": 1
              }
            }
          }
        }
      }
    },
    {
      "if": {
        "properties": { "action": { "const": "get_history" } }
      },
      "then": {
        "properties": {
          "payload": {
            "type": "object",
            "required": ["type", "limit"],
            "properties": {
              "type": {
                "type": "string",
                "enum": ["status", "stats", "health"]
              },
              "limit": {
                "type": "number",
                "minimum": 1,
                "maximum": 100
              }
            }
          }
        }
      }
    }
  ]
}
```

#### 4.2.2 服务端消息 Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WebSocket Server Message",
  "type": "object",
  "required": ["id", "type", "timestamp", "event", "data"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "type": {
      "type": "string",
      "enum": ["status", "stats", "health", "config", "system", "error"]
    },
    "timestamp": {
      "type": "number"
    },
    "event": {
      "type": "string",
      "enum": [
        "connected",
        "disconnected",
        "status_update",
        "stats_update",
        "health_alert",
        "pong",
        "history_data",
        "error",
        "subscribed",
        "unsubscribed"
      ]
    },
    "data": {
      "type": "object"
    }
  }
}
```

### 4.3 消息示例

#### 4.3.1 连接流程

```javascript
// 1. 客户端发起订阅
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "config",
  "timestamp": 1706941200000,
  "action": "subscribe",
  "payload": {
    "types": ["status", "stats"]
  }
}

// 2. 服务端确认订阅
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "type": "config",
  "timestamp": 1706941200100,
  "event": "subscribed",
  "data": {
    "subscribed": ["status", "stats"],
    "timestamp": 1706941200100
  }
}
```

#### 4.3.2 状态推送

```javascript
// 服务端推送状态更新
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "type": "status",
  "timestamp": 1706941260000,
  "event": "status_update",
  "data": {
    "status": {
      "systemOnline": true,
      "cpuUsage": 45.2,
      "memoryUsage": 67.5,
      "diskUsage": 78.0,
      "activeConnections": 128,
      "uptime": 86400
    },
    "changes": [
      {
        "field": "cpuUsage",
        "oldValue": 42.1,
        "newValue": 45.2,
        "delta": 3.1
      }
    ]
  }
}
```

#### 4.3.3 健康告警

```javascript
// 服务端推送健康告警（高优先级）
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "type": "health",
  "timestamp": 1706941300000,
  "event": "health_alert",
  "data": {
    "alert": {
      "level": "warning",
      "component": "database",
      "message": "数据库连接池使用率超过 80%",
      "threshold": 80,
      "currentValue": 85,
      "timestamp": 1706941300000
    }
  }
}
```

---

## 5. 数据流时序图

### 5.1 连接建立流程

```
客户端                                    服务端
  │                                         │
  │────────── 1. WebSocket 握手 ───────────▶│
  │                                         │
  │◀───────── 2. HTTP 101 Switching ───────│
  │              Protocols                    │
  │                                         │
  │◀───────── 3. connected 事件 ───────────│
  │            {connectionId, serverTime,     │
  │             supportedTypes}              │
  │                                         │
  │────────── 4. subscribe 消息 ───────────▶│
  │            {types: ["status", "stats"]}   │
  │                                         │
  │◀───────── 5. subscribed 确认 ──────────│
  │                                         │
  │◀───────── 6. history_data 推送 ────────│
  │            {type: "status", data: [...]}  │
  │                                         │
  │◀───────── 7. 定时 status_update ───────│
  │            {status, changes}            │
  │                                         │
```

### 5.2 心跳保活机制

```
客户端                                    服务端
  │                                         │
  │────────── 30s 间隔 ──────────────────▶│
  │                                         │
  │────────── 1. ping ───────────────────▶│
  │                                         │
  │◀───────── 2. pong ────────────────────│
  │                                         │
  │────────── 3. 记录 lastPongTime ───────▶│
  │                                         │
  │    ... 重复 ...                         │
  │                                         │
  │────────── 4. ping (超时未响应) ──────▶│
  │            (假设服务端无响应)              │
  │                                         │
  │◀───────── 5. 60s 后检测到超时 ─────────│
  │            触发重连流程                  │
  │                                         │
```

### 5.3 断线重连流程

```
客户端                                    服务端
  │                                         │
  │◀───────── 1. 检测到连接断开 ───────────│
  │            (网络异常/服务端关闭)          │
  │                                         │
  │────────── 2. 延迟 3s 后尝试重连 ───────▶│
  │            (指数退避: 3s → 4.5s → ...)   │
  │                                         │
  │◀───────── 3. 连接失败 ─────────────────│
  │                                         │
  │────────── 4. 延迟 4.5s 后重试 ─────────▶│
  │                                         │
  │◀───────── 5. 连接成功 ─────────────────│
  │                                         │
  │────────── 6. 重新订阅历史数据 ─────────▶│
  │                                         │
  │◀───────── 7. 恢复数据推送 ─────────────│
  │                                         │
```

### 5.4 批量数据更新流程

```
数据检测器                                广播调度器              客户端
    │                                       │                      │
    │──────── 1. 检测到数据变更 ───────────▶│                      │
    │                                       │                      │
    │                                       │──────── 2. 加入队列 ─│
    │                                       │                      │
    │──────── 3. 更多数据变更 ─────────────▶│                      │
    │                                       │                      │
    │                                       │──────── 4. 批量处理 ─│
    │                                       │   (50ms 后)          │
    │                                       │                      │
    │                                       │──────── 5. 消息合并 ─│
    │                                       │   相同类型合并         │
    │                                       │                      │
    │                                       │──────── 6. 批量发送 ─│
    │                                       │   按订阅过滤          │
    │                                       │                      │
    │                                       │─────────────────────▶│
    │                                       │   {events: [...]}     │
```

---

## 6. API 契约

### 6.1 事件列表

| 方向 | 事件名称 | 类型 | 优先级 | 描述 | 触发条件 |
|------|---------|------|-------|------|---------|
| 服务端→客户端 | `connected` | system | high | 连接建立成功 | WebSocket 握手完成 |
| 服务端→客户端 | `disconnected` | system | high | 连接断开 | 连接关闭或超时 |
| 服务端→客户端 | `subscribed` | config | normal | 订阅确认 | 客户端订阅请求后 |
| 服务端→客户端 | `unsubscribed` | config | normal | 取消订阅确认 | 客户端取消订阅后 |
| 服务端→客户端 | `status_update` | status | normal | 状态数据更新 | 状态数据变化 |
| 服务端→客户端 | `stats_update` | stats | normal | 统计数据更新 | 统计数据变化或定时推送 |
| 服务端→客户端 | `health_alert` | health | high | 健康告警 | 健康指标超过阈值 |
| 服务端→客户端 | `health_recovery` | health | normal | 健康恢复 | 异常指标恢复正常 |
| 服务端→客户端 | `history_data` | system | low | 历史数据 | 客户端请求历史或首次连接 |
| 服务端→客户端 | `pong` | system | high | 心跳响应 | 收到 ping 后响应 |
| 服务端→客户端 | `error` | error | high | 错误信息 | 处理异常时 |
| 客户端→服务端 | `subscribe` | config | - | 订阅请求 | 客户端主动订阅 |
| 客户端→服务端 | `unsubscribe` | config | - | 取消订阅 | 客户端取消订阅 |
| 客户端→服务端 | `ping` | system | - | 心跳请求 | 定时保活 |
| 客户端→服务端 | `get_history` | system | - | 获取历史 | 需要历史数据时 |

### 6.2 数据结构定义

#### 6.2.1 SystemStatus

```typescript
interface SystemStatus {
  systemOnline: boolean;      // 系统在线状态
  cpuUsage: number;           // CPU 使用率 (0-100)
  memoryUsage: number;        // 内存使用率 (0-100)
  diskUsage: number;          // 磁盘使用率 (0-100)
  activeConnections: number;  // 当前活跃连接数
  uptime: number;             // 系统运行时间 (秒)
  timestamp: number;          // 时间戳
  version: string;            // 系统版本
}
```

#### 6.2.2 SystemStats

```typescript
interface SystemStats {
  period: '1m' | '5m' | '15m' | '1h' | '24h';
  requests: {
    total: number;
    success: number;
    error: number;
    perSecond: number;
  };
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  timestamp: number;
}
```

#### 6.2.3 HealthAlert

```typescript
interface HealthAlert {
  level: 'info' | 'warning' | 'critical';
  component: string;          // 组件名称
  message: string;            // 告警消息
  threshold: number;          // 阈值
  currentValue: number;       // 当前值
  timestamp: number;
  details?: Record<string, unknown>;
}
```

#### 6.2.4 ConnectionInfo

```typescript
interface ConnectionInfo {
  connectionId: string;
  serverTime: number;
  supportedTypes: MessageType[];
  heartbeatInterval: number;
  maxReconnectAttempts: number;
}
```

### 6.3 订阅配置

```typescript
// 订阅选项
interface SubscriptionOptions {
  // 消息类型订阅
  types: MessageType[];
  
  // 频率限制 (可选)
  throttleMs?: number;        // 消息节流间隔
  
  // 过滤条件 (可选)
  filter?: {
    minSeverity?: 'info' | 'warning' | 'critical';  // 最小告警级别
    components?: string[];     // 关注的组件列表
  };
}
```

---

## 7. 性能优化方案

### 7.1 性能瓶颈识别

| 瓶颈点 | 风险等级 | 影响 | 优化策略 |
|--------|---------|------|---------|
| **高并发连接** | 🔴 高 | 内存耗尽，响应变慢 | 连接池 + 流控 |
| **消息广播** | 🔴 高 | CPU 飙升，延迟增加 | 批量广播 + 分片 |
| **数据库查询** | 🟡 中 | 阻塞广播线程 | 缓存 + 批量读取 |
| **频繁序列化** | 🟡 中 | CPU 浪费 | 消息合并 + 批量序列化 |
| **UI 渲染卡顿** | 🟡 中 | 用户体验下降 | 虚拟滚动 + RAF |

### 7.2 服务端优化策略

#### 7.2.1 连接管理优化

```typescript
// 1. 连接池限制
const MAX_TOTAL_CONNECTIONS = 10000;
const MAX_CONNECTIONS_PER_USER = 3;
const CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5分钟无活动断开

// 2. 连接分级管理
class TieredConnectionManager {
  // VIP 用户（管理员）- 优先保障
  private vipConnections = new Set<string>();
  
  // 普通用户
  private normalConnections = new Set<string>();
  
  // 当接近上限时，优先断开普通连接
  evictIfNeeded(): void {
    if (this.getTotalCount() >= MAX_TOTAL_CONNECTIONS * 0.9) {
      // 断开最早的普通连接
      const oldestNormal = this.getOldestNormal();
      if (oldestNormal) {
        this.disconnect(oldestNormal);
      }
    }
  }
}
```

#### 7.2.2 广播优化

```typescript
// 1. 批量广播
class OptimizedBroadcaster {
  private messageBuffer: Map<MessageType, ServerMessage[]> = new Map();
  private flushInterval = 50; // 50ms 合并窗口
  
  scheduleBroadcast(message: ServerMessage): void {
    const buffer = this.messageBuffer.get(message.type) || [];
    buffer.push(message);
    this.messageBuffer.set(message.type, buffer);
    
    // 延迟批量发送
    setTimeout(() => this.flush(message.type), this.flushInterval);
  }
  
  private flush(type: MessageType): void {
    const messages = this.messageBuffer.get(type);
    if (!messages || messages.length === 0) return;
    
    // 清空缓冲区
    this.messageBuffer.set(type, []);
    
    // 合并相同类型消息
    const merged = this.mergeMessages(messages);
    
    // 批量序列化（只序列化一次）
    const serialized = JSON.stringify(merged);
    
    // 发送给所有订阅者
    this.sendToSubscribers(type, serialized);
  }
  
  private mergeMessages(messages: ServerMessage[]): ServerMessage {
    if (messages.length === 1) return messages[0];
    
    // 合并多个事件到一个消息
    return {
      id: generateUUID(),
      type: messages[0].type,
      timestamp: Date.now(),
      event: 'batch_update',
      data: {
        events: messages.map(m => ({ event: m.event, data: m.data }))
      }
    };
  }
}
```

#### 7.2.3 数据库优化

```typescript
// 1. 数据缓存层
class DataCache {
  private cache = new Map<string, { data: unknown; expiry: number }>();
  private TTL = 5000; // 5秒缓存
  
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return undefined;
  }
  
  set(key: string, data: unknown): void {
    this.cache.set(key, { data, expiry: Date.now() + this.TTL });
  }
}

// 2. WAL 模式优化 SQLite
// 在数据库初始化时设置
await db.exec('PRAGMA journal_mode = WAL;');
await db.exec('PRAGMA synchronous = NORMAL;');
```

### 7.3 前端优化策略

#### 7.3.1 消息节流与防抖

```typescript
// hooks/useThrottledWebSocket.ts
import { useRef, useCallback } from 'react';

export function useThrottledWebSocket(throttleMs = 100) {
  const pendingUpdate = useRef<ServerMessage | null>(null);
  const rafId = useRef<number | null>(null);
  
  const throttledUpdate = useCallback((message: ServerMessage, onUpdate: (msg: ServerMessage) => void) => {
    pendingUpdate.current = message;
    
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        if (pendingUpdate.current) {
          onUpdate(pendingUpdate.current);
        }
        rafId.current = null;
      });
    }
  }, []);
  
  return { throttledUpdate };
}
```

#### 7.3.2 虚拟滚动优化

```typescript
// 对于历史数据列表，使用虚拟滚动
import { useVirtualizer } from '@tanstack/react-virtual';

function HistoryList({ data }: { data: HistoryItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // 每行高度
    overscan: 5 // 预渲染行数
  });
  
  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <HistoryItemRow data={data[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 7.4 监控指标

| 指标 | 告警阈值 | 监控频率 |
|------|---------|---------|
| WebSocket 连接数 | > 8000 | 实时 |
| 消息广播延迟 (P95) | > 100ms | 每分钟 |
| 内存使用量 | > 2GB | 每分钟 |
| CPU 使用率 | > 70% | 每分钟 |
| 数据库查询时间 | > 100ms | 每分钟 |
| 客户端重连率 | > 10% | 每小时 |

### 7.5 压力测试建议

```bash
# 使用 Artillery 进行压力测试
npm install -g artillery

# 测试配置
artillery quick --count 1000 --num 50 ws://localhost:3000/ws

# 自定义测试脚本
artillery run ws-load-test.yml
```

```yaml
# ws-load-test.yml
config:
  target: "ws://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      rampTo: 100
    - duration: 120
      arrivalRate: 100
  ws:
    # 子协议配置
scenarios:
  - name: "Subscribe and receive"
    weight: 100
    actions:
      - send:
          payload: |
            {"type":"config","action":"subscribe","payload":{"types":["status","stats"]}}
      - think: 5
      - send:
          payload: |
            {"type":"system","action":"ping"}
```

---

## 8. 错误处理与边界情况

### 8.1 服务端错误处理

| 错误场景 | 错误码 | 处理策略 | 客户端响应 |
|---------|-------|---------|-----------|
| 消息解析失败 | `PARSE_ERROR` | 记录日志，忽略消息 | 发送 error 事件 |
| 无效的消息类型 | `INVALID_TYPE` | 拒绝处理 | 发送 error 事件 |
| 连接数超限 | `MAX_CONNECTIONS_EXCEEDED` | 拒绝连接 | 关闭连接 (1008) |
| 未授权的订阅 | `UNAUTHORIZED` | 拒绝订阅 | 发送 error 事件 |
| 数据库错误 | `INTERNAL_ERROR` | 降级到缓存数据 | 发送 error 事件 |
| 心跳超时 | `HEARTBEAT_TIMEOUT` | 关闭连接 | 无 (已断开) |
| 广播队列溢出 | `QUEUE_OVERFLOW` | 丢弃旧消息 | 发送 warning 事件 |

### 8.2 客户端错误处理

```typescript
// 错误分类处理
function handleWebSocketError(error: WebSocketError) {
  switch (error.code) {
    case 'PARSE_ERROR':
      // 忽略，等待下一条消息
      break;
      
    case 'MAX_CONNECTIONS_EXCEEDED':
      // 显示警告，提示用户关闭其他标签页
      showWarning('已达到最大连接数限制，请关闭其他仪表盘窗口');
      break;
      
    case 'HEARTBEAT_TIMEOUT':
      // 自动触发重连
      reconnectWithBackoff();
      break;
      
    case 'QUEUE_OVERFLOW':
      // 提示数据可能有延迟
      showWarning('数据同步有延迟，正在恢复...');
      break;
      
    default:
      // 记录并显示通用错误
      console.error('WebSocket error:', error);
      showError('连接异常，正在尝试恢复...');
  }
}
```

### 8.3 边界情况处理

| 场景 | 服务端行为 | 客户端行为 |
|------|-----------|-----------|
| 客户端突然断网 | 60s 心跳超时后清理连接 | 检测断开，指数退避重连 |
| 服务端重启 | 所有连接断开 | 自动重连，重新订阅 |
| 浏览器休眠 | 心跳停止，服务端超时断开 | 页面激活后自动重连 |
| 大量消息涌入 | 队列限流，批量发送 | 虚拟滚动 + 节流渲染 |
| SQLite 锁竞争 | 队列化查询请求 | 显示加载状态 |
| Nginx 超时 | 配置长连接保持 | 自动重连 |

---

## 9. 部署与运维

### 9.1 Nginx 配置

```nginx
upstream websocket_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name lab.yujian.team;
    
    # WebSocket 端点
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        
        # WebSocket 升级头
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 其他头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
    
    # 普通 HTTP API
    location / {
        proxy_pass http://websocket_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 9.2 Docker 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - WS_HEARTBEAT_INTERVAL=30000
      - WS_MAX_CONNECTIONS=10000
    volumes:
      - ./data:/app/data
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/system/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## 10. 扩展性设计

### 10.1 未来扩展点

| 扩展功能 | 当前预留 | 实现复杂度 |
|---------|---------|-----------|
| 多房间/频道 | 订阅系统已支持 | 低 |
| 消息持久化 | 数据结构已预留 | 中 |
| 端到端加密 | 预留加密字段 | 中 |
| 横向扩展 | 需添加 Redis | 高 |
| 移动端推送 | 需添加 Push 服务 | 中 |
| 远程控制 | 消息协议已支持双向 | 低 |

### 10.2 版本兼容性

```typescript
// 版本协商
interface ConnectionInfo {
  // ...
  protocolVersion: '1.0';
  supportedVersions: ['1.0', '1.1'];
}

// 向后兼容的消息格式
interface BackwardCompatibleMessage {
  // 必选字段 (所有版本)
  id: string;
  type: string;
  timestamp: number;
  
  // v1.0 字段
  event?: string;
  data?: unknown;
  
  // v1.1 新增字段
  version?: string;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
}
```

---

## 11. 总结

### 11.1 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 消息格式 | JSON | 易于调试，前后端原生支持 |
| 订阅模式 | 客户端主动订阅 | 节省带宽，灵活可控 |
| 广播策略 | 批量 + 队列 | 平衡实时性和性能 |
| 心跳机制 | 30s 间隔 + 60s 超时 | 兼顾实时性和网络开销 |
| 重连策略 | 指数退避 (最大 30s) | 避免服务器雪崩 |
| 数据存储 | SQLite + 内存缓存 | 简单部署，满足当前需求 |

### 11.2 待决策事项

- [ ] 是否需要 Redis 缓存层？（当前评估不需要，后续根据并发量决定）
- [ ] 是否需要消息持久化？（P2 优先级，Sprint 2 评估）
- [ ] 是否需要限流策略？（建议实现令牌桶限流）

### 11.3 下一步行动

1. **技术总监评审** - 确认架构方案
2. **Task 3** - 后端 WebSocket 模块实现
3. **Task 4** - 前端 WebSocket 客户端实现
4. **Task 5** - 集成测试与性能调优

---

**文档状态**: 🟡 评审中  
**审批签名**:  
- [ ] 技术总监: _________________ 日期: _______  
- [ ] 架构师: _________________ 日期: _______  
