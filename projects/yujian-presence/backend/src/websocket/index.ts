/**
 * WebSocket 模块入口
 * 集成 ConnectionManager、MessageRouter、BroadcastScheduler 和 ChangeDetector
 */

import { Elysia } from 'elysia';
import type { Database } from 'bun:sqlite';

import { ConnectionManager, generateUUID } from './connection-manager';
import { MessageRouter } from './message-router';
import { BroadcastScheduler } from './broadcast-scheduler';
import { ChangeDetector } from './change-detector';

import type {
  WebSocketConfig,
  ServerMessage,
  WebSocketContext,
  MessageType
} from './types';

// 重新导出类型和类
export {
  ConnectionManager,
  MessageRouter,
  BroadcastScheduler,
  ChangeDetector,
  generateUUID
};

export type {
  WebSocketConfig,
  ServerMessage,
  ClientMessage,
  ConnectionMetadata,
  ConnectionStats,
  BroadcastTask,
  SystemStatus,
  SystemStats,
  HealthAlert,
  Change,
  MessageType,
  MessagePriority,
  ClientAction,
  ServerEvent,
  ErrorCode
} from './types';

/**
 * 从 WebSocket 连接中提取用户 ID
 * 当前使用简单策略，实际项目中应从 token 或 session 提取
 * @param ws WebSocket 连接
 * @returns 用户 ID
 */
function extractUserId(ws: any): string {
  // 从查询参数或 headers 中获取用户标识
  // 简单实现：使用 IP 地址或随机 ID
  const headers = ws.data?.request?.headers;
  const forwardedFor = headers?.get('x-forwarded-for');

  if (forwardedFor) {
    return `user_${Bun.hash(forwardedFor).toString(16).slice(0, 8)}`;
  }

  // 使用连接的唯一标识作为用户 ID
  return `anonymous_${generateUUID().slice(0, 8)}`;
}

/**
 * 创建 WebSocket 插件
 * @param db 数据库实例
 * @param config WebSocket 配置选项
 * @returns Elysia 插件
 */
export function createWebSocketPlugin(
  db: Database,
  config: Partial<WebSocketConfig> = {}
): Elysia {
  // 合并默认配置
  const wsConfig: WebSocketConfig = {
    heartbeatInterval: 30000,
    heartbeatTimeout: 60000,
    maxConnectionsPerUser: 3,
    maxTotalConnections: 10000,
    broadcastBatchSize: 100,
    broadcastFlushInterval: 50,
    defaultHistoryLimit: 50,
    supportedTypes: ['status', 'stats', 'health', 'config', 'system'],
    ...config
  };

  // 初始化核心组件
  const connectionManager = new ConnectionManager(wsConfig);
  const broadcastScheduler = new BroadcastScheduler(connectionManager, wsConfig);
  const messageRouter = new MessageRouter(connectionManager, wsConfig);
  const changeDetector = new ChangeDetector(db, broadcastScheduler, {
    checkInterval: 1000,
    cpuThreshold: 80,
    memoryThreshold: 80,
    diskThreshold: 90
  });

  // 设置历史数据提供者
  messageRouter.setHistoryProvider(async (type: string, limit: number) => {
    try {
      switch (type) {
        case 'status':
          // 从数据库获取历史状态数据
          // 这里使用模拟数据，实际项目中应查询数据库
          return Array.from({ length: limit }, (_, i) => ({
            id: i + 1,
            systemOnline: true,
            cpuUsage: 30 + Math.random() * 40,
            memoryUsage: 40 + Math.random() * 30,
            timestamp: Date.now() - (limit - i) * 60000
          }));

        case 'stats':
          // 获取历史统计数据
          const visits = db.query(
            'SELECT * FROM visits ORDER BY timestamp DESC LIMIT ?'
          ).all(limit);
          return visits;

        case 'health':
          // 获取历史健康数据
          return [];

        default:
          return [];
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to fetch history for ${type}:`, error);
      return [];
    }
  });

  // 启动变更检测
  changeDetector.start();

  // 创建 Elysia 插件
  const websocketPlugin = new Elysia({ prefix: '/ws' })
    // WebSocket 连接端点
    .ws('/realtime', {
      /**
       * 连接建立时的处理
       */
      open(ws) {
        try {
          const userId = extractUserId(ws);

          // 注册连接
          const connectionId = connectionManager.register(ws as unknown as WebSocket, userId);

          // 存储连接上下文
          (ws as any).connectionId = connectionId;
          (ws as any).userId = userId;

          // 发送连接成功消息
          const connectedMessage: ServerMessage = {
            id: generateUUID(),
            type: 'system',
            timestamp: Date.now(),
            direction: 'server-to-client',
            event: 'connected',
            data: {
              connectionId,
              serverTime: Date.now(),
              supportedTypes: wsConfig.supportedTypes,
              heartbeatInterval: wsConfig.heartbeatInterval,
              maxReconnectAttempts: 5
            }
          };

          ws.send(JSON.stringify(connectedMessage));

          // 自动订阅所有类型 (可选，根据需求调整)
          connectionManager.updateSubscription(connectionId, ['status', 'stats', 'health']);

          console.log(`[WebSocket] Client connected: ${connectionId} (user: ${userId})`);

        } catch (error) {
          console.error('[WebSocket] Connection error:', error);

          // 发送错误并关闭连接
          const errorCode = (error as Error & { code?: string }).code || 'INTERNAL_ERROR';
          ws.send(JSON.stringify({
            type: 'error',
            event: 'connection_rejected',
            data: {
              reason: (error as Error).message,
              code: errorCode
            }
          }));

          ws.close(1008, (error as Error).message);
        }
      },

      /**
       * 收到消息时的处理
       */
      message(ws, message) {
        const connectionId = (ws as any).connectionId;

        if (!connectionId) {
          console.error('[WebSocket] Received message from unknown connection');
          return;
        }

        // 路由消息
        messageRouter.route(connectionId, message as string | Buffer).catch(error => {
          console.error('[WebSocket] Error routing message:', error);
        });
      },

      /**
       * 连接关闭时的处理
       */
      close(ws) {
        const connectionId = (ws as any).connectionId;

        if (connectionId) {
          connectionManager.unregister(connectionId);
          console.log(`[WebSocket] Client disconnected: ${connectionId}`);
        }
      },

      /**
       * 错误处理
       */
      error(ws: any, error: any) {
        const connectionId = ws.connectionId;
        console.error(`[WebSocket] Error on connection ${connectionId}:`, error);
      }
    })

    // HTTP API: 获取 WebSocket 连接统计
    .get('/stats', () => {
      return connectionManager.getStats();
    })

    // HTTP API: 获取广播队列状态
    .get('/queue', () => {
      return broadcastScheduler.getQueueStats();
    })

    // HTTP API: 手动触发广播 (管理员接口)
    .post('/broadcast', ({ body, headers, set }) => {
      // 简单的权限检查
      const API_SECRET = process.env.LAB_SECRET;
      if (API_SECRET && headers['authorization'] !== `Bearer ${API_SECRET}`) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const { type, event, data, priority = 'normal' } = body as any;

      if (!type || !event) {
        set.status = 400;
        return { error: 'Missing required fields: type, event' };
      }

      broadcastScheduler.broadcast(type as MessageType, event, data, priority);

      return { success: true, message: 'Broadcast scheduled' };
    });

  // 将核心组件附加到插件，便于外部访问
  (websocketPlugin as any).connectionManager = connectionManager;
  (websocketPlugin as any).broadcastScheduler = broadcastScheduler;
  (websocketPlugin as any).messageRouter = messageRouter;
  (websocketPlugin as any).changeDetector = changeDetector;

  return websocketPlugin;
}

/**
 * 获取 WebSocket 插件中的组件 (类型安全)
 * @param plugin WebSocket 插件实例
 */
export function getWebSocketComponents(plugin: Elysia) {
  return {
    connectionManager: (plugin as any).connectionManager as ConnectionManager,
    broadcastScheduler: (plugin as any).broadcastScheduler as BroadcastScheduler,
    messageRouter: (plugin as any).messageRouter as MessageRouter,
    changeDetector: (plugin as any).changeDetector as ChangeDetector
  };
}

export default createWebSocketPlugin;
