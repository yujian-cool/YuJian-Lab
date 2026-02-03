/**
 * useWebSocket Hook
 * React Hook for WebSocket connection management
 * @author Frontend Engineer
 * @version 1.0.0
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type {
  MessageType,
  ClientMessage,
  ServerMessage,
  ConnectionState,
  UseWebSocketReturn,
  WebSocketClientOptions,
} from '../types/websocket';
import { WebSocketClient } from '../services/websocket/WebSocketClient';

/**
 * 获取 WebSocket URL
 * 根据当前环境自动选择 ws:// 或 wss://
 * @returns WebSocket URL 字符串
 */
export function getWebSocketUrl(): string {
  // 开发环境使用本地 WebSocket 服务器
  if (import.meta.env.DEV) {
    return 'ws://localhost:3000/ws';
  }

  // 生产环境使用同域 WebSocket 连接（避免跨域）
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/realtime`;
}

/**
 * useWebSocket Hook 选项
 */
export interface UseWebSocketOptions {
  /** WebSocket URL (默认自动推断) */
  url?: string;
  /** 自动连接 (默认 true) */
  autoConnect?: boolean;
  /** 初始订阅的消息类型 */
  initialSubscriptions?: MessageType[];
  /** 重连间隔 (ms, 默认 3000) */
  reconnectInterval?: number;
  /** 最大重连次数 (默认 5) */
  maxReconnectAttempts?: number;
  /** 连接建立回调 */
  onConnect?: () => void;
  /** 连接断开回调 */
  onDisconnect?: () => void;
  /** 消息接收回调 */
  onMessage?: (message: ServerMessage) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 重连中回调 */
  onReconnecting?: (attempt: number) => void;
}

/**
 * useWebSocket Hook
 * 
 * 功能：
 * 1. 管理 WebSocket 连接生命周期
 * 2. 提供连接状态、重连状态
 * 3. 支持订阅/取消订阅
 * 4. 支持发送消息
 * 5. 自动清理资源
 * 
 * @example
 * ```tsx
 * const { isConnected, subscribe, send } = useWebSocket({
 *   initialSubscriptions: ['status', 'stats'],
 *   onMessage: (msg) => console.log(msg),
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = getWebSocketUrl(),
    autoConnect = true,
    initialSubscriptions = [],
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onConnect,
    onDisconnect,
    onMessage,
    onError,
    onReconnecting,
  } = options;

  // 使用 ref 存储 WebSocketClient 实例
  const clientRef = useRef<WebSocketClient | null>(null);
  
  // 状态管理
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // 回调函数引用 (避免不必要的重渲染)
  const callbacksRef = useRef({
    onConnect,
    onDisconnect,
    onMessage,
    onError,
    onReconnecting,
  });

  // 更新回调引用
  useEffect(() => {
    callbacksRef.current = {
      onConnect,
      onDisconnect,
      onMessage,
      onError,
      onReconnecting,
    };
  }, [onConnect, onDisconnect, onMessage, onError, onReconnecting]);

  // 初始化 WebSocketClient
  useEffect(() => {
    const client = new WebSocketClient({
      url,
      autoConnect: false, // 我们手动控制连接时机
      reconnectInterval,
      maxReconnectAttempts,
      onOpen: () => {
        setConnectionState('connected');
        setReconnectAttempts(0);
        
        // 自动订阅初始订阅类型
        if (initialSubscriptions.length > 0) {
          client.subscribe(initialSubscriptions);
        }
        
        callbacksRef.current.onConnect?.();
      },
      onClose: () => {
        setConnectionState('disconnected');
        setConnectionId(null);
        callbacksRef.current.onDisconnect?.();
      },
      onMessage: (message: ServerMessage) => {
        setLastMessage(message);
        
        // 保存连接 ID
        if (message.event === 'connected' && typeof message.data === 'object') {
          const data = message.data as { connectionId?: string };
          if (data.connectionId) {
            setConnectionId(data.connectionId);
          }
        }
        
        callbacksRef.current.onMessage?.(message);
      },
      onError: (error: Error) => {
        setLastError(error);
        callbacksRef.current.onError?.(error);
      },
      onReconnecting: (attempt: number) => {
        setConnectionState('reconnecting');
        setReconnectAttempts(attempt);
        callbacksRef.current.onReconnecting?.(attempt);
      },
    });

    clientRef.current = client;

    // 自动连接
    if (autoConnect) {
      client.connect();
    }

    // 清理函数
    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [url, autoConnect, reconnectInterval, maxReconnectAttempts]); // 不依赖 initialSubscriptions

  // 公开方法
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
    return clientRef.current?.send(message) ?? false;
  }, []);

  const ping = useCallback(() => {
    clientRef.current?.ping();
  }, []);

  // 计算派生状态
  const isConnected = connectionState === 'connected';
  const isReconnecting = connectionState === 'reconnecting';

  // 使用 useMemo 缓存返回值，避免不必要的重渲染
  return useMemo(
    () => ({
      connectionState,
      isConnected,
      isReconnecting,
      reconnectAttempts,
      lastMessage,
      lastError,
      connectionId,
      connect,
      disconnect,
      subscribe,
      unsubscribe,
      send,
      ping,
    }),
    [
      connectionState,
      isConnected,
      isReconnecting,
      reconnectAttempts,
      lastMessage,
      lastError,
      connectionId,
      connect,
      disconnect,
      subscribe,
      unsubscribe,
      send,
      ping,
    ]
  );
}

export default useWebSocket;
