/**
 * Message Router - 消息路由
 * 负责消息解析、验证、路由分发和错误处理
 */

import type {
  ClientMessage,
  ServerMessage,
  MessageType,
  ClientAction,
  SubscribePayload,
  UnsubscribePayload,
  GetHistoryPayload,
  ErrorCode,
  WebSocketConfig
} from './types';
import type { ConnectionManager } from './connection-manager';
import { generateUUID } from './connection-manager';

/**
 * 有效的消息类型集合
 */
const VALID_MESSAGE_TYPES: Set<MessageType> = new Set([
  'status', 'stats', 'health', 'config', 'system', 'error', 'all'
]);

/**
 * 有效的客户端动作集合
 */
const VALID_CLIENT_ACTIONS: Set<ClientAction> = new Set([
  'subscribe', 'unsubscribe', 'ping', 'get_history', 'ack'
]);

/**
 * 验证结果
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 消息处理器函数类型
 */
type MessageHandler = (connectionId: string, payload: unknown) => Promise<void> | void;

/**
 * 消息路由器
 * 负责解析、验证客户端消息，并路由到相应的处理器
 */
export class MessageRouter {
  /** 自定义处理器映射: action -> handler */
  private handlers: Map<string, MessageHandler> = new Map();

  /** WebSocket 配置 */
  private config: WebSocketConfig;

  /** 历史数据获取回调 */
  private historyProvider?: (type: string, limit: number) => Promise<unknown[]>;

  /**
   * 创建消息路由器实例
   * @param connectionManager 连接管理器实例
   * @param config WebSocket 配置选项
   */
  constructor(
    private connectionManager: ConnectionManager,
    config: Partial<WebSocketConfig> = {}
  ) {
    this.config = {
      supportedTypes: ['status', 'stats', 'health', 'config', 'system'],
      defaultHistoryLimit: 50,
      ...config
    } as WebSocketConfig;
  }

  /**
   * 注册自定义消息处理器
   * @param action 客户端动作名称
   * @param handler 处理函数
   */
  registerHandler(action: string, handler: MessageHandler): void {
    this.handlers.set(action, handler);
  }

  /**
   * 设置历史数据提供者
   * @param provider 历史数据获取函数
   */
  setHistoryProvider(
    provider: (type: string, limit: number) => Promise<unknown[]>
  ): void {
    this.historyProvider = provider;
  }

  /**
   * 路由消息到对应的处理器
   * @param connectionId 连接标识符
   * @param rawMessage 原始消息字符串
   */
  async route(connectionId: string, rawMessage: string | Buffer): Promise<void> {
    try {
      // 1. 解析消息
      const message = this.parseMessage(rawMessage);
      if (!message) {
        await this.sendError(connectionId, 'PARSE_ERROR', 'Failed to parse message as JSON');
        return;
      }

      // 2. 验证消息格式
      const validation = this.validateMessage(message);
      if (!validation.valid) {
        await this.sendError(connectionId, 'INVALID_TYPE', validation.errors.join('; '));
        return;
      }

      // 3. 检查连接是否存在
      const conn = this.connectionManager.getConnection(connectionId);
      if (!conn) {
        console.error(`[WebSocket] Connection not found: ${connectionId}`);
        return;
      }

      // 4. 路由到对应处理器
      await this.handleAction(connectionId, message);

    } catch (error) {
      console.error('[WebSocket] Error routing message:', error);
      await this.sendError(
        connectionId,
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * 解析原始消息
   * @param rawMessage 原始消息数据
   * @returns 解析后的客户端消息或 null
   */
  private parseMessage(rawMessage: string | Buffer): ClientMessage | null {
    try {
      const messageStr = Buffer.isBuffer(rawMessage)
        ? rawMessage.toString('utf-8')
        : rawMessage;

      const parsed = JSON.parse(messageStr);

      // 确保方向字段正确
      if (!parsed.direction) {
        parsed.direction = 'client-to-server';
      }

      return parsed as ClientMessage;
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
      return null;
    }
  }

  /**
   * 验证消息格式
   * @param message 客户端消息
   * @returns 验证结果
   */
  private validateMessage(message: ClientMessage): ValidationResult {
    const errors: string[] = [];

    // 验证必需字段
    if (!message.id) {
      errors.push('Missing required field: id');
    }

    if (!message.type) {
      errors.push('Missing required field: type');
    } else if (!VALID_MESSAGE_TYPES.has(message.type)) {
      errors.push(`Invalid message type: ${message.type}`);
    }

    if (!message.action) {
      errors.push('Missing required field: action');
    } else if (!VALID_CLIENT_ACTIONS.has(message.action)) {
      errors.push(`Invalid action: ${message.action}`);
    }

    if (!message.timestamp || typeof message.timestamp !== 'number') {
      errors.push('Missing or invalid field: timestamp');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 处理客户端动作
   * @param connectionId 连接标识符
   * @param message 客户端消息
   */
  private async handleAction(
    connectionId: string,
    message: ClientMessage
  ): Promise<void> {
    // 首先检查是否有自定义处理器
    const customHandler = this.handlers.get(message.action);
    if (customHandler) {
      await customHandler(connectionId, message.payload);
      return;
    }

    // 使用默认处理器
    switch (message.action) {
      case 'subscribe':
        await this.handleSubscribe(connectionId, message.payload as SubscribePayload);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(connectionId, message.payload as UnsubscribePayload);
        break;

      case 'ping':
        await this.handlePing(connectionId);
        break;

      case 'get_history':
        await this.handleGetHistory(connectionId, message.payload as GetHistoryPayload);
        break;

      case 'ack':
        // 确认消息，无需处理
        break;

      default:
        await this.sendError(
          connectionId,
          'INVALID_ACTION',
          `Unknown action: ${message.action}`
        );
    }
  }

  /**
   * 处理订阅请求
   * @param connectionId 连接标识符
   * @param payload 订阅载荷
   */
  private async handleSubscribe(
    connectionId: string,
    payload: SubscribePayload
  ): Promise<void> {
    if (!payload || !Array.isArray(payload.types)) {
      await this.sendError(connectionId, 'SUBSCRIPTION_INVALID', 'Invalid subscribe payload');
      return;
    }

    // 过滤有效的消息类型
    const validTypes = payload.types.filter(type =>
      VALID_MESSAGE_TYPES.has(type) && type !== 'error'
    );

    if (validTypes.length === 0) {
      await this.sendError(connectionId, 'SUBSCRIPTION_INVALID', 'No valid message types provided');
      return;
    }

    // 更新订阅
    this.connectionManager.updateSubscription(connectionId, validTypes);

    // 发送确认
    await this.sendAck(connectionId, 'subscribed', {
      subscribed: validTypes,
      timestamp: Date.now()
    });

    console.log(`[WebSocket] Connection ${connectionId} subscribed to: ${validTypes.join(', ')}`);
  }

  /**
   * 处理取消订阅请求
   * @param connectionId 连接标识符
   * @param payload 取消订阅载荷
   */
  private async handleUnsubscribe(
    connectionId: string,
    payload: UnsubscribePayload
  ): Promise<void> {
    if (!payload || !Array.isArray(payload.types)) {
      await this.sendError(connectionId, 'SUBSCRIPTION_INVALID', 'Invalid unsubscribe payload');
      return;
    }

    // 移除订阅
    for (const type of payload.types) {
      this.connectionManager.removeSubscription(connectionId, type);
    }

    // 发送确认
    await this.sendAck(connectionId, 'unsubscribed', {
      unsubscribed: payload.types,
      timestamp: Date.now()
    });

    console.log(`[WebSocket] Connection ${connectionId} unsubscribed from: ${payload.types.join(', ')}`);
  }

  /**
   * 处理心跳 ping
   * @param connectionId 连接标识符
   */
  private async handlePing(connectionId: string): Promise<void> {
    // 更新连接存活状态
    this.connectionManager.markAlive(connectionId);

    // 发送 pong 响应
    await this.sendPong(connectionId);
  }

  /**
   * 处理获取历史数据请求
   * @param connectionId 连接标识符
   * @param payload 历史数据请求载荷
   */
  private async handleGetHistory(
    connectionId: string,
    payload: GetHistoryPayload
  ): Promise<void> {
    if (!payload || !payload.type) {
      await this.sendError(connectionId, 'INVALID_TYPE', 'Missing type in get_history payload');
      return;
    }

    const limit = Math.min(
      payload.limit || this.config.defaultHistoryLimit || 50,
      100 // 最大限制
    );

    try {
      let historyData: unknown[] = [];

      if (this.historyProvider) {
        historyData = await this.historyProvider(payload.type, limit);
      }

      // 发送历史数据
      const message: ServerMessage = {
        id: generateUUID(),
        type: 'system',
        timestamp: Date.now(),
        direction: 'server-to-client',
        event: 'history_data',
        data: {
          type: payload.type,
          limit,
          items: historyData,
          total: historyData.length
        }
      };

      await this.sendMessage(connectionId, message);
    } catch (error) {
      console.error('[WebSocket] Error fetching history:', error);
      await this.sendError(connectionId, 'INTERNAL_ERROR', 'Failed to fetch history data');
    }
  }

  /**
   * 发送错误消息到客户端
   * @param connectionId 连接标识符
   * @param code 错误代码
   * @param message 错误消息
   */
  async sendError(
    connectionId: string,
    code: ErrorCode,
    message: string
  ): Promise<void> {
    const errorMessage: ServerMessage = {
      id: generateUUID(),
      type: 'error',
      timestamp: Date.now(),
      direction: 'server-to-client',
      event: 'error',
      data: { code, message }
    };

    await this.sendMessage(connectionId, errorMessage);
  }

  /**
   * 发送确认消息到客户端
   * @param connectionId 连接标识符
   * @param event 确认事件名称
   * @param data 确认数据
   */
  private async sendAck(
    connectionId: string,
    event: 'subscribed' | 'unsubscribed',
    data: unknown
  ): Promise<void> {
    const message: ServerMessage = {
      id: generateUUID(),
      type: 'config',
      timestamp: Date.now(),
      direction: 'server-to-client',
      event,
      data
    };

    await this.sendMessage(connectionId, message);
  }

  /**
   * 发送 pong 响应到客户端
   * @param connectionId 连接标识符
   */
  private async sendPong(connectionId: string): Promise<void> {
    const message: ServerMessage = {
      id: generateUUID(),
      type: 'system',
      timestamp: Date.now(),
      direction: 'server-to-client',
      event: 'pong',
      data: { serverTime: Date.now() }
    };

    await this.sendMessage(connectionId, message);
  }

  /**
   * 发送消息到指定连接
   * @param connectionId 连接标识符
   * @param message 服务器消息
   */
  async sendMessage(connectionId: string, message: ServerMessage): Promise<void> {
    const conn = this.connectionManager.getConnection(connectionId);
    if (!conn) return;

    try {
      if (conn.socket.readyState === WebSocket.OPEN) {
        conn.socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to send message to ${connectionId}:`, error);
    }
  }

  /**
   * 发送消息到多个连接
   * @param connectionIds 连接标识符数组
   * @param message 服务器消息
   */
  async sendMessageToMany(
    connectionIds: string[],
    message: ServerMessage
  ): Promise<void> {
    const serialized = JSON.stringify(message);

    await Promise.allSettled(
      connectionIds.map(id => {
        const conn = this.connectionManager.getConnection(id);
        if (conn && conn.socket.readyState === WebSocket.OPEN) {
          try {
            conn.socket.send(serialized);
          } catch (error) {
            console.error(`[WebSocket] Failed to send to ${id}:`, error);
          }
        }
      })
    );
  }
}

export default MessageRouter;
