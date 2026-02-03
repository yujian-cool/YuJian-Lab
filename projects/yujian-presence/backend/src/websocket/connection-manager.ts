/**
 * Connection Manager - 连接管理器
 * 负责 WebSocket 连接的生命周期管理、用户连接限制和连接统计
 */

import type {
  ConnectionMetadata,
  ConnectionStats,
  MessageType,
  WebSocketConfig,
  ErrorCode
} from './types';

/**
 * 生成 UUID v4
 * @returns 随机生成的 UUID 字符串
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 连接管理器
 * 管理所有 WebSocket 连接，包括连接注册、注销、订阅管理和心跳检测
 */
export class ConnectionManager {
  /** 连接存储: connectionId -> ConnectionMetadata */
  private connections: Map<string, ConnectionMetadata> = new Map();

  /** 用户连接映射: userId -> Set<connectionId> */
  private userConnections: Map<string, Set<string>> = new Map();

  /** WebSocket 配置 */
  private config: WebSocketConfig;

  /**
   * 创建连接管理器实例
   * @param config WebSocket 配置选项
   */
  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      maxConnectionsPerUser: 3,
      maxTotalConnections: 10000,
      ...config
    } as WebSocketConfig;

    // 启动定期清理任务
    this.startCleanupTask();
  }

  /**
   * 注册新的 WebSocket 连接
   * @param socket WebSocket 实例
   * @param userId 用户标识符
   * @returns 新创建的连接 ID
   * @throws 当用户连接数超过限制时抛出错误
   */
  register(socket: WebSocket, userId: string): string {
    // 检查全局连接数限制
    if (this.connections.size >= this.config.maxTotalConnections) {
      const error = new Error('MAX_CONNECTIONS_EXCEEDED: Server connection limit reached');
      (error as Error & { code: ErrorCode }).code = 'MAX_CONNECTIONS_EXCEEDED';
      throw error;
    }

    // 检查用户连接数限制
    const userConns = this.userConnections.get(userId) || new Set();
    if (userConns.size >= this.config.maxConnectionsPerUser) {
      const error = new Error(`MAX_CONNECTIONS_EXCEEDED: User ${userId} has reached max connections (${this.config.maxConnectionsPerUser})`);
      (error as Error & { code: ErrorCode }).code = 'MAX_CONNECTIONS_EXCEEDED';
      throw error;
    }

    const connectionId = generateUUID();
    const now = new Date();

    const metadata: ConnectionMetadata = {
      id: connectionId,
      userId,
      socket,
      subscriptions: new Set(),
      connectedAt: now,
      lastHeartbeat: now,
      isAlive: true
    };

    this.connections.set(connectionId, metadata);
    userConns.add(connectionId);
    this.userConnections.set(userId, userConns);

    console.log(`[WebSocket] Connection registered: ${connectionId} for user ${userId}. Total: ${this.connections.size}`);

    return connectionId;
  }

  /**
   * 注销 WebSocket 连接
   * @param connectionId 连接标识符
   */
  unregister(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) {
      return;
    }

    // 从用户连接映射中移除
    const userConns = this.userConnections.get(conn.userId);
    if (userConns) {
      userConns.delete(connectionId);
      // 如果用户没有更多连接，清理用户映射
      if (userConns.size === 0) {
        this.userConnections.delete(conn.userId);
      }
    }

    // 从连接存储中移除
    this.connections.delete(connectionId);

    console.log(`[WebSocket] Connection unregistered: ${connectionId}. Total: ${this.connections.size}`);
  }

  /**
   * 获取指定连接的信息
   * @param connectionId 连接标识符
   * @returns 连接元数据或 undefined
   */
  getConnection(connectionId: string): ConnectionMetadata | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 获取所有活跃连接
   * @returns 连接元数据数组
   */
  getAllConnections(): ConnectionMetadata[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取指定用户的所有连接
   * @param userId 用户标识符
   * @returns 连接元数据数组
   */
  getUserConnections(userId: string): ConnectionMetadata[] {
    const ids = this.userConnections.get(userId);
    if (!ids) return [];

    return Array.from(ids)
      .map(id => this.connections.get(id))
      .filter((conn): conn is ConnectionMetadata => conn !== undefined);
  }

  /**
   * 获取订阅了指定消息类型的所有连接
   * @param type 消息类型
   * @returns 连接元数据数组
   */
  getConnectionsBySubscription(type: MessageType): ConnectionMetadata[] {
    return this.getAllConnections().filter(conn =>
      conn.subscriptions.has(type) || conn.subscriptions.has('all')
    );
  }

  /**
   * 更新连接的订阅列表
   * @param connectionId 连接标识符
   * @param types 消息类型数组
   */
  updateSubscription(connectionId: string, types: MessageType[]): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.subscriptions = new Set(types);
    }
  }

  /**
   * 添加单个订阅
   * @param connectionId 连接标识符
   * @param type 消息类型
   */
  addSubscription(connectionId: string, type: MessageType): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.subscriptions.add(type);
    }
  }

  /**
   * 移除单个订阅
   * @param connectionId 连接标识符
   * @param type 消息类型
   */
  removeSubscription(connectionId: string, type: MessageType): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.subscriptions.delete(type);
    }
  }

  /**
   * 标记连接为存活状态 (更新心跳时间)
   * @param connectionId 连接标识符
   */
  markAlive(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.lastHeartbeat = new Date();
      conn.isAlive = true;
    }
  }

  /**
   * 检查连接是否超时
   * @param connectionId 连接标识符
   * @param timeoutMs 超时时间 (毫秒)
   * @returns 是否已超时
   */
  isConnectionTimedOut(connectionId: string, timeoutMs: number): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) return true;

    return Date.now() - conn.lastHeartbeat.getTime() > timeoutMs;
  }

  /**
   * 清理所有超时连接
   * @param timeoutMs 超时时间 (毫秒)
   * @returns 被清理的连接 ID 列表
   */
  cleanupTimedOutConnections(timeoutMs: number): string[] {
    const timedOutIds: string[] = [];

    for (const [connectionId, conn] of this.connections.entries()) {
      if (Date.now() - conn.lastHeartbeat.getTime() > timeoutMs) {
        conn.isAlive = false;
        timedOutIds.push(connectionId);

        // 尝试关闭 WebSocket 连接
        try {
          if (conn.socket.readyState === WebSocket.OPEN) {
            conn.socket.close(1001, 'Heartbeat timeout');
          }
        } catch (error) {
          console.error(`[WebSocket] Error closing timed out connection ${connectionId}:`, error);
        }

        // 注销连接
        this.unregister(connectionId);
      }
    }

    if (timedOutIds.length > 0) {
      console.log(`[WebSocket] Cleaned up ${timedOutIds.length} timed out connections`);
    }

    return timedOutIds;
  }

  /**
   * 获取连接统计信息
   * @returns 连接统计数据
   */
  getStats(): ConnectionStats {
    const connections = this.getAllConnections();

    const totalSubscriptions = connections.reduce(
      (sum, conn) => sum + conn.subscriptions.size,
      0
    );

    return {
      totalConnections: connections.length,
      uniqueUsers: this.userConnections.size,
      averageSubscriptions: connections.length > 0
        ? totalSubscriptions / connections.length
        : 0
    };
  }

  /**
   * 检查用户是否已存在连接
   * @param userId 用户标识符
   * @returns 是否存在连接
   */
  hasUserConnections(userId: string): boolean {
    const userConns = this.userConnections.get(userId);
    return userConns !== undefined && userConns.size > 0;
  }

  /**
   * 获取指定用户的连接数量
   * @param userId 用户标识符
   * @returns 连接数量
   */
  getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size || 0;
  }

  /**
   * 启动定期清理任务
   * 每分钟执行一次超时连接清理
   */
  private startCleanupTask(): void {
    const CLEANUP_INTERVAL = 60000; // 60 秒

    setInterval(() => {
      const timeoutMs = this.config.heartbeatTimeout || 60000;
      this.cleanupTimedOutConnections(timeoutMs);
    }, CLEANUP_INTERVAL);
  }
}

export default ConnectionManager;
