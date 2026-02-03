/**
 * useWebSocket Hook 单元测试
 * @author Frontend Engineer
 * @version 1.0.0
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, waitFor } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket, getWebSocketUrl } from '../src/hooks/useWebSocket';
import type { ServerMessage } from '../src/types/websocket';

// Mock WebSocket
const mockWebSocket = {
  url: '',
  readyState: WebSocket.CONNECTING,
  send: vi.fn(),
  close: vi.fn(),
  onopen: null as ((ev: Event) => void) | null,
  onclose: null as ((ev: CloseEvent) => void) | null,
  onmessage: null as ((ev: MessageEvent) => void) | null,
  onerror: null as ((ev: Event) => void) | null,
};

(global as unknown as { WebSocket: typeof WebSocket }).WebSocket = vi.fn().mockImplementation((url: string) => {
  mockWebSocket.url = url;
  mockWebSocket.readyState = WebSocket.CONNECTING;
  return mockWebSocket;
}) as unknown as typeof WebSocket;

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 重置 mockWebSocket 状态
    Object.assign(mockWebSocket, {
      url: '',
      readyState: WebSocket.CONNECTING,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getWebSocketUrl', () => {
    it('应该返回正确的 WebSocket URL', () => {
      // 在测试环境中，应该返回开发服务器地址
      const url = getWebSocketUrl();
      expect(url).toBe('ws://localhost:3000/ws');
    });
  });

  describe('Hook 初始化', () => {
    it('应该正确初始化 Hook', () => {
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: false,
      }));

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
      expect(result.current.reconnectAttempts).toBe(0);
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.lastError).toBeNull();
    });

    it('autoConnect 为 true 时应自动连接', () => {
      renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
      }));

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3000/ws');
    });
  });

  describe('连接管理', () => {
    it('connect 应该建立连接', () => {
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: false,
      }));

      act(() => {
        result.current.connect();
      });

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3000/ws');
    });

    it('disconnect 应该断开连接', () => {
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
      }));

      // 模拟连接成功
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      expect(result.current.isConnected).toBe(true);

      // 断开连接
      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('消息处理', () => {
    it('应该接收并存储消息', () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
        onMessage,
      }));

      // 模拟连接成功
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      // 发送消息
      const serverMessage: ServerMessage = {
        id: 'test-id',
        type: 'status',
        timestamp: Date.now(),
        event: 'status_update',
        data: { status: { systemOnline: true } },
      };

      act(() => {
        mockWebSocket.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify(serverMessage),
        }));
      });

      expect(onMessage).toHaveBeenCalledWith(serverMessage);
      expect(result.current.lastMessage).toEqual(serverMessage);
    });

    it('send 应该发送消息', () => {
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
      }));

      // 模拟连接成功
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      const message = {
        id: 'test-id',
        type: 'config' as const,
        timestamp: Date.now(),
        action: 'subscribe' as const,
        payload: { types: ['status'] },
      };

      act(() => {
        result.current.send(message);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('订阅管理', () => {
    it('subscribe 应该发送订阅请求', () => {
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
      }));

      // 模拟连接成功
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      act(() => {
        result.current.subscribe(['status', 'stats']);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"subscribe"')
      );
    });

    it('unsubscribe 应该发送取消订阅请求', () => {
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
      }));

      // 模拟连接成功
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      act(() => {
        result.current.unsubscribe(['status']);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"unsubscribe"')
      );
    });
  });

  describe('回调函数', () => {
    it('应该调用 onConnect 回调', () => {
      const onConnect = vi.fn();
      renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
        onConnect,
      }));

      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      expect(onConnect).toHaveBeenCalled();
    });

    it('应该调用 onDisconnect 回调', () => {
      const onDisconnect = vi.fn();
      renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
        onDisconnect,
      }));

      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close'));
      });

      expect(onDisconnect).toHaveBeenCalled();
    });

    it('应该调用 onError 回调', () => {
      const onError = vi.fn();
      renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
        onError,
      }));

      act(() => {
        mockWebSocket.onerror?.(new Event('error'));
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('重连逻辑', () => {
    it('应该处理重连状态', () => {
      const onReconnecting = vi.fn();
      const { result } = renderHook(() => useWebSocket({
        url: 'ws://localhost:3000/ws',
        autoConnect: true,
        reconnectInterval: 100,
        onReconnecting,
      }));

      // 模拟连接成功
      act(() => {
        mockWebSocket.readyState = WebSocket.OPEN;
        mockWebSocket.onopen?.(new Event('open'));
      });

      // 模拟连接关闭
      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close'));
      });

      // 快进时间触发重连
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onReconnecting).toHaveBeenCalledWith(1);
      expect(result.current.isReconnecting).toBe(true);
    });
  });
});
