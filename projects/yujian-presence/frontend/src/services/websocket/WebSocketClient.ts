/**
 * WebSocket 客户端核心类
 * 管理连接生命周期、重连逻辑、心跳机制
 * @author Frontend Engineer
 * @version 1.0.0
 */

import type {
  ConnectionState,
  ClientMessage,
  ServerMessage,
  WebSocketClientOptions,
  WebSocketClientState,
} from '../../types/websocket';

/**
 * 生成 UUID v4
 * @returns UUID 字符串
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * WebSocket 客户端类
 * 
 * 特性：
 * 1. 自动重连 (指数退避策略)
 * 2. 心跳保活机制
 * 3. 消息队列 (离线时缓存消息)
 * 4. 订阅管理
 * 5. 完整的状态管理
 */
export class WebSocketClient {
  /** WebSocket 实例 */
  private ws: WebSocket | null = null;
  
  /** 当前连接状态 */
  private state: ConnectionState = 'disconnected';
  
  /** 当前重连次数 */
  private reconnectAttempts = 0;
  
  /** 重连定时器 */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  /** 心跳定时器 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  
  /** 上次心跳响应时间 */
  private lastPongTime = Date.now();
  
  /** 离线消息队列 */
  private messageQueue: ClientMessage[] = [];
  
  /** 当前订阅的消息类型 */
  private subscriptions: Set<string> = new Set();
  
  /** 连接 ID */
  private connectionId: string | null = null;
  
  /** 默认配置 */
  private static readonly DEFAULT_OPTIONS: Required<Omit<WebSocketClientOptions, 'url' | 'onOpen' | 'onClose' | 'onMessage' | 'onError' | 'onReconnecting'>> = {
    autoConnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    heartbeatTimeout: 60000,
  };

  /** 合并后的配置选项 */
  private options: Required<WebSocketClientOptions>;

  /**
   * 构造函数
   * @param options WebSocket 配置选项
   */
  constructor(options: WebSocketClientOptions) {
    this.options = {
      ...WebSocketClient.DEFAULT_OPTIONS,
      onOpen: () => {},
      onClose: () => {},
      onMessage: () => {},
      onError: () => {},
      onReconnecting: () => {},
      ...options,
    };

    // 如果配置了自动连接，则立即连接
    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * 获取当前客户端状态
   * @returns 完整的客户端状态对象
   */
  getState(): WebSocketClientState {
    return {
      connectionState: this.state,
      isConnected: this.state === 'connected',
      isReconnecting: this.state === 'reconnecting',
      reconnectAttempts: this.reconnectAttempts,
      lastMessage: null, // 由 Hook 管理
      lastError: null,   // 由 Hook 管理
      connectionId: this.connectionId,
    };
  }

  /**
   * 建立 WebSocket 连接
   * 
   * 流程：
   * 1. 检查当前状态，避免重复连接
   * 2. 创建 WebSocket 实例
   * 3. 绑定事件处理器
   */
  connect(): void {
    // 避免重复连接
    if (this.state === 'connected' || this.state === 'connecting') {
      console.warn('[WebSocket] Already connected or connecting');
      return;
    }

    this.state = 'connecting';
    console.log('[WebSocket] Connecting to', this.options.url);

    try {
      // 创建 WebSocket 实例
      this.ws = new WebSocket(this.options.url);

      // 绑定事件处理器
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.options.onError(error as Error);
      this.attemptReconnect();
    }
  }

  /**
   * 断开 WebSocket 连接
   * 
   * 清理所有资源并关闭连接
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting...');
    
    // 清理定时器
    this.cleanup();
    
    // 关闭连接
    if (this.ws) {
      // 1000 = 正常关闭
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.state = 'disconnected';
    this.connectionId = null;
  }

  /**
   * 订阅消息类型
   * @param types 要订阅的消息类型列表
   */
  subscribe(types: string[]): void {
    // 添加到本地订阅集合
    types.forEach((type) => this.subscriptions.add(type));

    // 如果已连接，发送订阅请求
    if (this.state === 'connected') {
      this.send({
        id: generateUUID(),
        type: 'config',
        timestamp: Date.now(),
        action: 'subscribe',
        payload: { types },
      });
    }
  }

  /**
   * 取消订阅消息类型
   * @param types 要取消订阅的消息类型列表
   */
  unsubscribe(types: string[]): void {
    // 从本地订阅集合移除
    types.forEach((type) => this.subscriptions.delete(type));

    // 如果已连接，发送取消订阅请求
    if (this.state === 'connected') {
      this.send({
        id: generateUUID(),
        type: 'config',
        timestamp: Date.now(),
        action: 'unsubscribe',
        payload: { types },
      });
    }
  }

  /**
   * 发送消息
   * @param message 客户端消息
   * @returns 是否成功发送
   */
  send(message: ClientMessage): boolean {
    // 如果已连接，直接发送
    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('[WebSocket] Send error:', error);
        return false;
      }
    } else {
      // 离线时加入队列，等待重连后发送
      console.log('[WebSocket] Queueing message (offline)');
      this.messageQueue.push(message);
      return false;
    }
  }

  /**
   * 发送心跳 ping
   */
  ping(): void {
    this.send({
      id: generateUUID(),
      type: 'system',
      timestamp: Date.now(),
      action: 'ping',
    });
  }

  /**
   * 处理连接建立事件
   */
  private handleOpen(): void {
    console.log('[WebSocket] Connected');
    
    this.state = 'connected';
    this.reconnectAttempts = 0;
    this.lastPongTime = Date.now();
    
    // 启动心跳
    this.startHeartbeat();
    
    // 刷新消息队列
    this.flushMessageQueue();
    
    // 触发回调
    this.options.onOpen();
  }

  /**
   * 处理连接关闭事件
   */
  private handleClose(): void {
    console.log('[WebSocket] Connection closed');
    
    this.cleanup();
    this.connectionId = null;
    
    // 触发回调
    this.options.onClose();
    
    // 尝试重连 (如果不是主动断开)
    if (this.state !== 'disconnected') {
      this.attemptReconnect();
    }
  }

  /**
   * 处理错误事件
   */
  private handleError(): void {
    console.error('[WebSocket] Connection error');
    this.options.onError(new Error('WebSocket connection error'));
  }

  /**
   * 处理消息接收
   * @param event WebSocket 消息事件
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ServerMessage;
      
      // 处理心跳响应
      if (message.event === 'pong') {
        this.lastPongTime = Date.now();
        return;
      }

      // 处理连接成功响应，保存连接 ID
      if (message.event === 'connected') {
        const data = message.data as { connectionId?: string };
        if (data.connectionId) {
          this.connectionId = data.connectionId;
        }
      }

      // 转发消息到回调
      this.options.onMessage(message);
    } catch (error) {
      console.error('[WebSocket] Message parse error:', error);
      this.options.onError(new Error('Failed to parse message'));
    }
  }

  /**
   * 尝试重连
   * 
   * 使用指数退避策略计算重连间隔
   */
  private attemptReconnect(): void {
    // 检查是否超过最大重连次数
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.state = 'disconnected';
      this.options.onError(new Error('Max reconnection attempts reached'));
      return;
    }

    this.state = 'reconnecting';
    this.reconnectAttempts++;
    
    console.log(`[WebSocket] Reconnecting... (attempt ${this.reconnectAttempts})`);
    
    // 触发重连回调
    this.options.onReconnecting(this.reconnectAttempts);

    // 指数退避策略计算延迟
    // 公式: baseInterval * 1.5^(attempt-1)，最大 30 秒
    const baseInterval = this.options.reconnectInterval;
    const delay = Math.min(
      baseInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000 // 最大 30 秒
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 启动心跳机制
   * 
   * 定期发送 ping 并检查响应
   */
  private startHeartbeat(): void {
    const interval = this.options.heartbeatInterval;
    const timeout = this.options.heartbeatTimeout;

    this.heartbeatTimer = setInterval(() => {
      // 检查上次 pong 时间，如果超时则认为连接已断开
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      if (timeSinceLastPong > timeout) {
        console.warn('[WebSocket] Heartbeat timeout, closing connection');
        this.ws?.close();
        return;
      }

      // 发送 ping
      this.ping();
    }, interval);
  }

  /**
   * 刷新消息队列
   * 
   * 连接恢复后发送所有缓存的消息
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[WebSocket] Flushing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }

    // 重新订阅
    if (this.subscriptions.size > 0) {
      this.send({
        id: generateUUID(),
        type: 'config',
        timestamp: Date.now(),
        action: 'subscribe',
        payload: { types: Array.from(this.subscriptions) },
      });
    }
  }

  /**
   * 清理所有定时器
   */
  private cleanup(): void {
    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 清除心跳定时器
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export default WebSocketClient;
