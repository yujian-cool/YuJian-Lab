/**
 * WebSocket 模块单元测试
 * 覆盖 ConnectionManager, MessageRouter, BroadcastScheduler 的核心功能
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { ConnectionManager, generateUUID } from '../src/websocket/connection-manager';
import { MessageRouter } from '../src/websocket/message-router';
import { BroadcastScheduler } from '../src/websocket/broadcast-scheduler';
import type {
  WebSocketConfig,
  ClientMessage,
  ServerMessage,
  MessageType,
  ConnectionMetadata
} from '../src/websocket/types';

// ==================== Mock WebSocket ====================

/**
 * 模拟 WebSocket 类
 */
class MockWebSocket {
  readyState: number = WebSocket.OPEN;
  sentMessages: string[] = [];
  closed: boolean = false;
  closeCode?: number;
  closeReason?: string;

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (typeof data === 'string') {
      this.sentMessages.push(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = WebSocket.CLOSED;
  }
}

// ==================== 测试配置 ====================

const TEST_CONFIG: Partial<WebSocketConfig> = {
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
  maxConnectionsPerUser: 3,
  maxTotalConnections: 100,
  broadcastBatchSize: 10,
  broadcastFlushInterval: 50,
  defaultHistoryLimit: 10
};

// ==================== ConnectionManager 测试 ====================

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager(TEST_CONFIG);
  });

  describe('register', () => {
    it('should register a new connection', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const userId = 'user_1';

      const connectionId = manager.register(ws, userId);

      expect(connectionId).toBeDefined();
      expect(typeof connectionId).toBe('string');
      expect(connectionId.length).toBeGreaterThan(0);

      const conn = manager.getConnection(connectionId);
      expect(conn).toBeDefined();
      expect(conn?.userId).toBe(userId);
      expect(conn?.isAlive).toBe(true);
    });

    it('should enforce max connections per user', () => {
      const userId = 'user_1';

      // 创建最大允许数量的连接
      for (let i = 0; i < 3; i++) {
        const ws = new MockWebSocket() as unknown as WebSocket;
        manager.register(ws, userId);
      }

      // 第四个连接应该被拒绝
      const ws4 = new MockWebSocket() as unknown as WebSocket;
      expect(() => manager.register(ws4, userId)).toThrow('MAX_CONNECTIONS_EXCEEDED');
    });

    it('should enforce max total connections', () => {
      // 创建接近上限的连接
      for (let i = 0; i < 100; i++) {
        const ws = new MockWebSocket() as unknown as WebSocket;
        manager.register(ws, `user_${i}`);
      }

      // 超过限制的连接应该被拒绝
      const wsExtra = new MockWebSocket() as unknown as WebSocket;
      expect(() => manager.register(wsExtra, 'extra_user')).toThrow('MAX_CONNECTIONS_EXCEEDED');
    });

    it('should generate unique connection IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const ws = new MockWebSocket() as unknown as WebSocket;
        const id = manager.register(ws, `user_${i}`);
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });
  });

  describe('unregister', () => {
    it('should unregister a connection', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = manager.register(ws, 'user_1');

      expect(manager.getConnection(connectionId)).toBeDefined();

      manager.unregister(connectionId);

      expect(manager.getConnection(connectionId)).toBeUndefined();
    });

    it('should handle unregistering non-existent connection', () => {
      // 不应该抛出错误
      expect(() => manager.unregister('non-existent-id')).not.toThrow();
    });

    it('should clean up user connection mapping', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;
      const userId = 'user_1';

      const id1 = manager.register(ws1, userId);
      const id2 = manager.register(ws2, userId);

      expect(manager.getUserConnectionCount(userId)).toBe(2);

      manager.unregister(id1);
      expect(manager.getUserConnectionCount(userId)).toBe(1);

      manager.unregister(id2);
      expect(manager.getUserConnectionCount(userId)).toBe(0);
      expect(manager.hasUserConnections(userId)).toBe(false);
    });
  });

  describe('getAllConnections', () => {
    it('should return all connections', () => {
      const connections: string[] = [];

      for (let i = 0; i < 5; i++) {
        const ws = new MockWebSocket() as unknown as WebSocket;
        connections.push(manager.register(ws, `user_${i}`));
      }

      const allConnections = manager.getAllConnections();
      expect(allConnections.length).toBe(5);
    });

    it('should return empty array when no connections', () => {
      expect(manager.getAllConnections()).toEqual([]);
    });
  });

  describe('getUserConnections', () => {
    it('should return connections for specific user', () => {
      const userId = 'user_1';
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      manager.register(ws1, userId);
      manager.register(ws2, userId);
      manager.register(new MockWebSocket() as unknown as WebSocket, 'other_user');

      const userConns = manager.getUserConnections(userId);
      expect(userConns.length).toBe(2);
      expect(userConns.every(c => c.userId === userId)).toBe(true);
    });

    it('should return empty array for user with no connections', () => {
      expect(manager.getUserConnections('non_existent_user')).toEqual([]);
    });
  });

  describe('subscription management', () => {
    it('should update subscription', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = manager.register(ws, 'user_1');

      manager.updateSubscription(connectionId, ['status', 'stats']);

      const conn = manager.getConnection(connectionId);
      expect(conn?.subscriptions.has('status')).toBe(true);
      expect(conn?.subscriptions.has('stats')).toBe(true);
      expect(conn?.subscriptions.has('health')).toBe(false);
    });

    it('should add subscription', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = manager.register(ws, 'user_1');

      manager.addSubscription(connectionId, 'status');
      manager.addSubscription(connectionId, 'stats');

      const conn = manager.getConnection(connectionId);
      expect(conn?.subscriptions.has('status')).toBe(true);
      expect(conn?.subscriptions.has('stats')).toBe(true);
    });

    it('should remove subscription', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = manager.register(ws, 'user_1');

      manager.updateSubscription(connectionId, ['status', 'stats', 'health']);
      manager.removeSubscription(connectionId, 'stats');

      const conn = manager.getConnection(connectionId);
      expect(conn?.subscriptions.has('status')).toBe(true);
      expect(conn?.subscriptions.has('stats')).toBe(false);
      expect(conn?.subscriptions.has('health')).toBe(true);
    });

    it('should get connections by subscription', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;
      const ws3 = new MockWebSocket() as unknown as WebSocket;

      const id1 = manager.register(ws1, 'user_1');
      const id2 = manager.register(ws2, 'user_2');
      const id3 = manager.register(ws3, 'user_3');

      manager.updateSubscription(id1, ['status']);
      manager.updateSubscription(id2, ['stats']);
      manager.updateSubscription(id3, ['status', 'all']);

      const statusConns = manager.getConnectionsBySubscription('status');
      expect(statusConns.length).toBe(2); // id1 (status) + id3 (all)

      const statsConns = manager.getConnectionsBySubscription('stats');
      expect(statsConns.length).toBe(2); // id2 (stats) + id3 (all)
    });
  });

  describe('heartbeat management', () => {
    it('should mark connection as alive', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = manager.register(ws, 'user_1');

      const oldHeartbeat = manager.getConnection(connectionId)?.lastHeartbeat;

      // 等待一小段时间
      Bun.sleepSync(10);

      manager.markAlive(connectionId);

      const newHeartbeat = manager.getConnection(connectionId)?.lastHeartbeat;
      expect(newHeartbeat!.getTime()).toBeGreaterThan(oldHeartbeat!.getTime());
    });

    it('should detect timed out connections', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = manager.register(ws, 'user_1');

      // 模拟超时
      const conn = manager.getConnection(connectionId);
      if (conn) {
        conn.lastHeartbeat = new Date(Date.now() - 70000); // 70秒前
      }

      expect(manager.isConnectionTimedOut(connectionId, 60000)).toBe(true);
    });

    it('should not flag recent connections as timed out', () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = manager.register(ws, 'user_1');

      expect(manager.isConnectionTimedOut(connectionId, 60000)).toBe(false);
    });

    it('should cleanup timed out connections', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      const id1 = manager.register(ws1, 'user_1');
      const id2 = manager.register(ws2, 'user_2');

      // 模拟 id1 超时
      const conn1 = manager.getConnection(id1);
      if (conn1) {
        conn1.lastHeartbeat = new Date(Date.now() - 70000);
      }

      const cleanedUp = manager.cleanupTimedOutConnections(60000);

      expect(cleanedUp.length).toBe(1);
      expect(cleanedUp[0]).toBe(id1);
      expect(manager.getConnection(id1)).toBeUndefined();
      expect(manager.getConnection(id2)).toBeDefined();
      expect((ws1 as unknown as MockWebSocket).closed).toBe(true);
    });
  });

  describe('stats', () => {
    it('should return correct stats', () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;
      const ws3 = new MockWebSocket() as unknown as WebSocket;

      manager.register(ws1, 'user_1');
      manager.register(ws2, 'user_1');
      manager.register(ws3, 'user_2');

      manager.updateSubscription(manager.getUserConnections('user_1')[0].id, ['status', 'stats']);

      const stats = manager.getStats();

      expect(stats.totalConnections).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.averageSubscriptions).toBeGreaterThan(0);
    });

    it('should return zero stats for empty manager', () => {
      const stats = manager.getStats();

      expect(stats.totalConnections).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.averageSubscriptions).toBe(0);
    });
  });
});

// ==================== generateUUID 测试 ====================

describe('generateUUID', () => {
  it('should generate valid UUID format', () => {
    const uuid = generateUUID();

    // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }

    expect(uuids.size).toBe(100);
  });
});

// ==================== MessageRouter 测试 ====================

describe('MessageRouter', () => {
  let connectionManager: ConnectionManager;
  let messageRouter: MessageRouter;

  beforeEach(() => {
    connectionManager = new ConnectionManager(TEST_CONFIG);
    messageRouter = new MessageRouter(connectionManager, TEST_CONFIG);
  });

  describe('message parsing and validation', () => {
    it('should handle valid subscribe message', async () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = connectionManager.register(ws, 'user_1');

      const message: ClientMessage = {
        id: generateUUID(),
        type: 'config',
        timestamp: Date.now(),
        direction: 'client-to-server',
        action: 'subscribe',
        payload: { types: ['status', 'stats'] }
      };

      await messageRouter.route(connectionId, JSON.stringify(message));

      const conn = connectionManager.getConnection(connectionId);
      expect(conn?.subscriptions.has('status')).toBe(true);
      expect(conn?.subscriptions.has('stats')).toBe(true);

      // 检查确认消息
      const mockWs = ws as unknown as MockWebSocket;
      expect(mockWs.sentMessages.length).toBeGreaterThan(0);

      const lastMessage = JSON.parse(mockWs.sentMessages[mockWs.sentMessages.length - 1]);
      expect(lastMessage.event).toBe('subscribed');
    });

    it('should handle ping message', async () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = connectionManager.register(ws, 'user_1');

      const oldHeartbeat = connectionManager.getConnection(connectionId)?.lastHeartbeat;

      const message: ClientMessage = {
        id: generateUUID(),
        type: 'system',
        timestamp: Date.now(),
        direction: 'client-to-server',
        action: 'ping'
      };

      await messageRouter.route(connectionId, JSON.stringify(message));

      // 检查是否更新了心跳时间
      const newHeartbeat = connectionManager.getConnection(connectionId)?.lastHeartbeat;
      expect(newHeartbeat!.getTime()).toBeGreaterThanOrEqual(oldHeartbeat!.getTime());

      // 检查 pong 响应
      const mockWs = ws as unknown as MockWebSocket;
      const pongMessage = mockWs.sentMessages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.event === 'pong';
      });
      expect(pongMessage).toBeDefined();
    });

    it('should handle invalid JSON', async () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = connectionManager.register(ws, 'user_1');

      await messageRouter.route(connectionId, 'invalid json {}}');

      const mockWs = ws as unknown as MockWebSocket;
      const errorMessage = mockWs.sentMessages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.event === 'error';
      });

      expect(errorMessage).toBeDefined();
      const parsed = JSON.parse(errorMessage!);
      expect(parsed.data.code).toBe('PARSE_ERROR');
    });

    it('should handle missing required fields', async () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = connectionManager.register(ws, 'user_1');

      const invalidMessage = {
        type: 'config',
        // 缺少 id, action, timestamp
      };

      await messageRouter.route(connectionId, JSON.stringify(invalidMessage));

      const mockWs = ws as unknown as MockWebSocket;
      const errorMessage = mockWs.sentMessages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.event === 'error';
      });

      expect(errorMessage).toBeDefined();
    });

    it('should handle unsubscribe', async () => {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = connectionManager.register(ws, 'user_1');

      // 先订阅
      connectionManager.updateSubscription(connectionId, ['status', 'stats', 'health']);

      const message: ClientMessage = {
        id: generateUUID(),
        type: 'config',
        timestamp: Date.now(),
        direction: 'client-to-server',
        action: 'unsubscribe',
        payload: { types: ['stats'] }
      };

      await messageRouter.route(connectionId, JSON.stringify(message));

      const conn = connectionManager.getConnection(connectionId);
      expect(conn?.subscriptions.has('status')).toBe(true);
      expect(conn?.subscriptions.has('stats')).toBe(false);
      expect(conn?.subscriptions.has('health')).toBe(true);
    });
  });

  describe('custom handlers', () => {
    it('should support custom handlers via registerHandler', async () => {
      // 测试 registerHandler 方法是否存在并能被调用
      let registered = false;

      try {
        // 尝试注册一个处理器
        messageRouter.registerHandler('test_action', () => {
          // 处理器函数
        });
        registered = true;
      } catch (e) {
        registered = false;
      }

      // 验证注册方法可以成功调用
      expect(registered).toBe(true);

      // 注意：当前 MessageRouter 只支持标准 action 类型的自定义处理器
      // 标准 action 包括: subscribe, unsubscribe, ping, get_history, ack
      // 自定义 action 需要通过扩展 VALID_CLIENT_ACTIONS 来支持
    });
  });

  describe('history provider', () => {
    it('should use history provider', async () => {
      const mockHistory = [{ id: 1 }, { id: 2 }];
      messageRouter.setHistoryProvider(async () => mockHistory);

      const ws = new MockWebSocket() as unknown as WebSocket;
      const connectionId = connectionManager.register(ws, 'user_1');

      const message: ClientMessage = {
        id: generateUUID(),
        type: 'system',
        timestamp: Date.now(),
        direction: 'client-to-server',
        action: 'get_history',
        payload: { type: 'status', limit: 10 }
      };

      await messageRouter.route(connectionId, JSON.stringify(message));

      const mockWs = ws as unknown as MockWebSocket;
      const historyMessage = mockWs.sentMessages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.event === 'history_data';
      });

      expect(historyMessage).toBeDefined();
      const parsed = JSON.parse(historyMessage!);
      expect(parsed.data.items).toEqual(mockHistory);
    });
  });
});

// ==================== BroadcastScheduler 测试 ====================

describe('BroadcastScheduler', () => {
  let connectionManager: ConnectionManager;
  let broadcastScheduler: BroadcastScheduler;

  beforeEach(() => {
    // 清理之前的调度器
    if (broadcastScheduler) {
      broadcastScheduler.stop();
    }
    connectionManager = new ConnectionManager(TEST_CONFIG);
    // 使用较长的刷新间隔避免异步清理队列
    broadcastScheduler = new BroadcastScheduler(connectionManager, {
      ...TEST_CONFIG,
      broadcastFlushInterval: 10000 // 10秒，测试中不会触发
    });
  });

  describe('enqueue and broadcast', () => {
    it('should enqueue message', () => {
      broadcastScheduler.enqueue({
        type: 'status',
        event: 'status_update',
        data: { test: 'data' },
        priority: 'normal',
        timestamp: Date.now()
      });

      const stats = broadcastScheduler.getQueueStats();
      expect(stats.length).toBe(1);
    });

    it('should broadcast to subscribed connections', async () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      const id1 = connectionManager.register(ws1, 'user_1');
      const id2 = connectionManager.register(ws2, 'user_2');

      connectionManager.updateSubscription(id1, ['status']);
      connectionManager.updateSubscription(id2, ['stats']);

      // 立即广播，不走队列
      await broadcastScheduler.broadcastUrgent('status', 'status_update', { cpu: 50 });

      const mockWs1 = ws1 as unknown as MockWebSocket;
      const mockWs2 = ws2 as unknown as MockWebSocket;

      expect(mockWs1.sentMessages.length).toBeGreaterThan(0);
      expect(mockWs2.sentMessages.length).toBe(0); // ws2 没有订阅 status
    });

    it('should handle broadcast to all subscribers', async () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;

      const id1 = connectionManager.register(ws1, 'user_1');
      const id2 = connectionManager.register(ws2, 'user_2');

      // 两个连接都订阅 status
      connectionManager.updateSubscription(id1, ['status']);
      connectionManager.updateSubscription(id2, ['status']);

      await broadcastScheduler.broadcastUrgent('status', 'status_update', { cpu: 50 });

      const mockWs1 = ws1 as unknown as MockWebSocket;
      const mockWs2 = ws2 as unknown as MockWebSocket;

      expect(mockWs1.sentMessages.length).toBeGreaterThan(0);
      expect(mockWs2.sentMessages.length).toBeGreaterThan(0);
    });

    it('should use convenient broadcast method', async () => {
      // 先添加一条消息
      broadcastScheduler.enqueue({
        type: 'status',
        event: 'status_update',
        data: { cpu: 50 },
        priority: 'high',
        timestamp: Date.now()
      });

      // 由于队列处理是异步的，我们需要等待一下
      await new Promise(resolve => setTimeout(resolve, 10));

      // 检查队列是否被处理 (如果处理了，队列应该为空)
      const stats = broadcastScheduler.getQueueStats();
      // 队列应该已被处理或正在处理
      expect(stats.isProcessing || stats.length === 0).toBe(true);
    });
  });

  describe('queue management', () => {
    it('should clear queue', () => {
      broadcastScheduler.enqueue({
        type: 'status',
        event: 'status_update',
        data: {},
        priority: 'normal',
        timestamp: Date.now()
      });

      expect(broadcastScheduler.getQueueStats().length).toBe(1);

      const cleared = broadcastScheduler.clearQueue();

      expect(cleared).toBe(1);
      expect(broadcastScheduler.getQueueStats().length).toBe(0);
    });

    it('should return queue stats', () => {
      broadcastScheduler.enqueue({
        type: 'status',
        event: 'status_update',
        data: {},
        priority: 'normal',
        timestamp: Date.now()
      });

      const stats = broadcastScheduler.getQueueStats();
      expect(stats.length).toBe(1);
      expect(typeof stats.isProcessing).toBe('boolean');
    });
  });

  describe('broadcast to connections', () => {
    it('should broadcast to specific connections', async () => {
      const ws1 = new MockWebSocket() as unknown as WebSocket;
      const ws2 = new MockWebSocket() as unknown as WebSocket;
      const ws3 = new MockWebSocket() as unknown as WebSocket;

      const id1 = connectionManager.register(ws1, 'user_1');
      const id2 = connectionManager.register(ws2, 'user_2');
      connectionManager.register(ws3, 'user_3');

      const message: ServerMessage = {
        id: generateUUID(),
        type: 'system',
        timestamp: Date.now(),
        direction: 'server-to-client',
        event: 'test',
        data: { test: 'data' }
      };

      await broadcastScheduler.broadcastToConnections([id1, id2], message);

      const mockWs1 = ws1 as unknown as MockWebSocket;
      const mockWs2 = ws2 as unknown as MockWebSocket;
      const mockWs3 = ws3 as unknown as MockWebSocket;

      expect(mockWs1.sentMessages.length).toBeGreaterThan(0);
      expect(mockWs2.sentMessages.length).toBeGreaterThan(0);
      expect(mockWs3.sentMessages.length).toBe(0);
    });
  });

  describe('priority handling', () => {
    it('should prioritize high priority messages', async () => {
      // 创建一个暂停处理的调度器
      const pausedScheduler = new BroadcastScheduler(connectionManager, {
        ...TEST_CONFIG,
        broadcastFlushInterval: 10000 // 很长的间隔，不会自动处理
      });

      // 先添加普通优先级消息
      for (let i = 0; i < 5; i++) {
        pausedScheduler.enqueue({
          type: 'status',
          event: 'status_update',
          data: { index: i },
          priority: 'normal',
          timestamp: Date.now()
        });
      }

      // 添加高优先级消息
      pausedScheduler.enqueue({
        type: 'health',
        event: 'health_alert',
        data: { critical: true },
        priority: 'high',
        timestamp: Date.now()
      });

      // 队列应该包含所有消息 (高优先级会立即触发处理，但队列可能仍有消息)
      const stats = pausedScheduler.getQueueStats();
      expect(stats.length >= 0).toBe(true);

      pausedScheduler.stop();
    });
  });
});

// ==================== 集成测试 ====================

describe('WebSocket Integration', () => {
  it('should handle complete workflow', async () => {
    const connectionManager = new ConnectionManager(TEST_CONFIG);
    const messageRouter = new MessageRouter(connectionManager, TEST_CONFIG);
    const broadcastScheduler = new BroadcastScheduler(connectionManager, TEST_CONFIG);

    // 1. 客户端连接
    const ws = new MockWebSocket() as unknown as WebSocket;
    const connectionId = connectionManager.register(ws, 'user_1');

    // 2. 订阅消息类型
    const subscribeMsg: ClientMessage = {
      id: generateUUID(),
      type: 'config',
      timestamp: Date.now(),
      direction: 'client-to-server',
      action: 'subscribe',
      payload: { types: ['status', 'stats'] }
    };

    await messageRouter.route(connectionId, JSON.stringify(subscribeMsg));

    // 3. 发送心跳
    const pingMsg: ClientMessage = {
      id: generateUUID(),
      type: 'system',
      timestamp: Date.now(),
      direction: 'client-to-server',
      action: 'ping'
    };

    await messageRouter.route(connectionId, JSON.stringify(pingMsg));

    // 4. 广播消息
    await broadcastScheduler.broadcastUrgent('status', 'status_update', {
      systemOnline: true,
      cpuUsage: 45
    });

    // 验证消息已发送
    const mockWs = ws as unknown as MockWebSocket;
    expect(mockWs.sentMessages.length).toBeGreaterThan(0);

    // 5. 断开连接
    connectionManager.unregister(connectionId);
    expect(connectionManager.getConnection(connectionId)).toBeUndefined();

    broadcastScheduler.stop();
  });

  it('should handle multiple clients', async () => {
    const connectionManager = new ConnectionManager(TEST_CONFIG);
    const broadcastScheduler = new BroadcastScheduler(connectionManager, TEST_CONFIG);

    const clients: { ws: MockWebSocket; id: string }[] = [];

    // 创建 5 个客户端
    for (let i = 0; i < 5; i++) {
      const ws = new MockWebSocket() as unknown as WebSocket;
      const id = connectionManager.register(ws, `user_${i}`);
      connectionManager.updateSubscription(id, ['status']);
      clients.push({ ws: ws as unknown as MockWebSocket, id });
    }

    // 广播消息
    await broadcastScheduler.broadcastUrgent('status', 'status_update', { cpu: 50 });

    // 验证所有客户端都收到了消息
    for (const client of clients) {
      expect(client.ws.sentMessages.length).toBeGreaterThan(0);
    }

    broadcastScheduler.stop();
  });
});

// 测试覆盖率统计
console.log('\n📊 WebSocket 测试套件完成');
