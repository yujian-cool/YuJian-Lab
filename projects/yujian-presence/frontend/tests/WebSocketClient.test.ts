/**
 * WebSocketClient 单元测试
 * @author Frontend Engineer
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from '../src/services/websocket/WebSocketClient';
import type { WebSocketClientOptions, ServerMessage } from '../src/types/websocket';

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation((url: string) => ({
  url,
  readyState: WebSocket.CONNECTING,
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null,
})) as unknown as typeof WebSocket;

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  const mockOptions: WebSocketClientOptions = {
    url: 'ws://localhost:3000/ws',
    autoConnect: false,
    reconnectInterval: 100,
    maxReconnectAttempts: 3,
    heartbeatInterval: 500,
    heartbeatTimeout: 1000,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onMessage: vi.fn(),
    onError: vi.fn(),
    onReconnecting: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new WebSocketClient(mockOptions);
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
  });

  describe('连接管理', () => {
    it('应该正确初始化', () => {
      const state = client.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.isConnected).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
    });

    it('应该建立 WebSocket 连接', () => {
      client.connect();
      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:3000/ws');
    });

    it('应该避免重复连接', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      // 再次连接应该无效
      client.connect();
      expect(WebSocket).toHaveBeenCalledTimes(1);
    });

    it('应该正确断开连接', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      client.disconnect();
      expect(ws.close).toHaveBeenCalledWith(1000, 'Client disconnect');
    });
  });

  describe('状态管理', () => {
    it('连接成功后应更新状态', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      const state = client.getState();
      expect(state.connectionState).toBe('connected');
      expect(state.isConnected).toBe(true);
      expect(mockOptions.onOpen).toHaveBeenCalled();
    });

    it('连接关闭后应更新状态', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();
      ws.onclose?.();

      expect(mockOptions.onClose).toHaveBeenCalled();
    });
  });

  describe('消息发送', () => {
    it('已连接时应该能发送消息', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      const message = {
        id: 'test-id',
        type: 'config' as const,
        timestamp: Date.now(),
        action: 'subscribe' as const,
        payload: { types: ['status'] },
      };

      const result = client.send(message);
      expect(result).toBe(true);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('未连接时应该缓存消息', () => {
      const message = {
        id: 'test-id',
        type: 'config' as const,
        timestamp: Date.now(),
        action: 'subscribe' as const,
        payload: { types: ['status'] },
      };

      const result = client.send(message);
      expect(result).toBe(false);
    });

    it('重连后应该刷新消息队列', () => {
      const message = {
        id: 'test-id',
        type: 'config' as const,
        timestamp: Date.now(),
        action: 'subscribe' as const,
        payload: { types: ['status'] },
      };

      // 离线时发送消息
      client.send(message);

      // 连接后应自动发送缓存的消息
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('订阅管理', () => {
    it('应该订阅消息类型', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      client.subscribe(['status', 'stats']);
      
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"subscribe"')
      );
    });

    it('应该取消订阅消息类型', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      client.unsubscribe(['status']);
      
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"unsubscribe"')
      );
    });
  });

  describe('心跳机制', () => {
    it('应该发送心跳 ping', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      client.ping();
      
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"ping"')
      );
    });
  });

  describe('消息处理', () => {
    it('应该正确处理服务端消息', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      const serverMessage: ServerMessage = {
        id: 'server-id',
        type: 'status',
        timestamp: Date.now(),
        event: 'status_update',
        data: { status: { systemOnline: true } },
      };

      ws.onmessage?.({ data: JSON.stringify(serverMessage) } as MessageEvent);
      
      expect(mockOptions.onMessage).toHaveBeenCalledWith(serverMessage);
    });

    it('应该处理心跳响应', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      const pongMessage: ServerMessage = {
        id: 'pong-id',
        type: 'system',
        timestamp: Date.now(),
        event: 'pong',
        data: {},
      };

      ws.onmessage?.({ data: JSON.stringify(pongMessage) } as MessageEvent);
      
      // pong 消息不应该触发 onMessage 回调
      expect(mockOptions.onMessage).not.toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该处理连接错误', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.onerror?.();
      
      expect(mockOptions.onError).toHaveBeenCalled();
    });

    it('应该处理无效的消息格式', () => {
      client.connect();
      const ws = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();

      ws.onmessage?.({ data: 'invalid json' } as MessageEvent);
      
      expect(mockOptions.onError).toHaveBeenCalled();
    });
  });
});
