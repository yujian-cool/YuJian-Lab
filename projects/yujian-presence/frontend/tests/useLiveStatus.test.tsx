/**
 * useLiveStatus Hook 单元测试
 * @author Frontend Engineer
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveStatus } from '../src/hooks/useLiveStatus';
import type { ServerMessage, SystemStatus, StatusUpdateData } from '../src/types/websocket';

describe('useLiveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  describe('初始状态', () => {
    it('应该返回默认状态', () => {
      const { result } = renderHook(() => 
        useLiveStatus(null, false, false, 'disconnected')
      );

      // 使用 expect.objectContaining 忽略 timestamp 差异
      expect(result.current.status).toMatchObject({
        systemOnline: false,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        activeConnections: 0,
        uptime: 0,
      });
      expect(result.current.changes).toEqual([]);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
    });
  });

  describe('状态更新', () => {
    it('应该处理状态更新消息', async () => {
      const statusUpdate: ServerMessage = {
        id: 'test-id',
        type: 'status',
        timestamp: Date.now(),
        event: 'status_update',
        data: {
          status: {
            systemOnline: true,
            cpuUsage: 45.5,
            memoryUsage: 67.8,
            diskUsage: 80.0,
            activeConnections: 128,
            uptime: 86400,
            timestamp: Date.now(),
          },
          changes: [
            { field: 'cpuUsage', oldValue: 40.0, newValue: 45.5, delta: 5.5 },
          ],
        } as StatusUpdateData,
      };

      const { result } = renderHook(() => 
        useLiveStatus(statusUpdate, true, false, 'connected')
      );

      // 由于 useEffect 是异步的，需要等待
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(result.current.status.systemOnline).toBe(true);
      expect(result.current.cpuUsage).toBe(45.5);
      expect(result.current.memoryUsage).toBe(67.8);
      expect(result.current.changes).toHaveLength(1);
      expect(result.current.changes[0].field).toBe('cpuUsage');
    });

    it('应该忽略非状态类型的消息', async () => {
      const nonStatusMessage: ServerMessage = {
        id: 'test-id',
        type: 'stats',
        timestamp: Date.now(),
        event: 'stats_update',
        data: { stats: {} },
      };

      const { result } = renderHook(() => 
        useLiveStatus(nonStatusMessage, true, false, 'connected')
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      // 状态应该保持默认
      expect(result.current.status).toMatchObject({
        systemOnline: false,
        cpuUsage: 0,
      });
    });

    it('应该处理空消息', async () => {
      const { result } = renderHook(() => 
        useLiveStatus(null, true, false, 'connected')
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      // 状态应该保持默认
      expect(result.current.status).toMatchObject({
        systemOnline: false,
        cpuUsage: 0,
      });
    });
  });

  describe('连接状态', () => {
    it('应该正确反映连接状态', async () => {
      const statusUpdate: ServerMessage = {
        id: 'test-id',
        type: 'status',
        timestamp: Date.now(),
        event: 'status_update',
        data: {
          status: {
            systemOnline: true,
            cpuUsage: 50,
            memoryUsage: 60,
            diskUsage: 70,
            activeConnections: 100,
            uptime: 3600,
            timestamp: Date.now(),
          },
        } as StatusUpdateData,
      };

      const { result } = renderHook(() => 
        useLiveStatus(statusUpdate, true, false, 'connected')
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isReconnecting).toBe(false);
      expect(result.current.connectionState).toBe('connected');
    });

    it('应该正确反映重连状态', () => {
      const { result } = renderHook(() => 
        useLiveStatus(null, false, true, 'reconnecting')
      );

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isReconnecting).toBe(true);
      expect(result.current.connectionState).toBe('reconnecting');
    });
  });

  describe('派生数据', () => {
    it('应该正确计算派生数据', async () => {
      const statusUpdate: ServerMessage = {
        id: 'test-id',
        type: 'status',
        timestamp: Date.now(),
        event: 'status_update',
        data: {
          status: {
            systemOnline: true,
            cpuUsage: 75.5,
            memoryUsage: 82.3,
            diskUsage: 90.1,
            activeConnections: 256,
            uptime: 172800,
            timestamp: Date.now(),
          },
        } as StatusUpdateData,
      };

      const { result } = renderHook(() => 
        useLiveStatus(statusUpdate, true, false, 'connected')
      );

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(result.current.cpuUsage).toBe(75.5);
      expect(result.current.memoryUsage).toBe(82.3);
      expect(result.current.diskUsage).toBe(90.1);
      expect(result.current.activeConnections).toBe(256);
      expect(result.current.systemOnline).toBe(true);
      expect(result.current.uptime).toBe(172800);
    });

    it('当状态为 null 时应该使用默认值', () => {
      const { result } = renderHook(() => 
        useLiveStatus(null, false, false, 'disconnected')
      );

      expect(result.current.cpuUsage).toBe(0);
      expect(result.current.memoryUsage).toBe(0);
      expect(result.current.diskUsage).toBe(0);
      expect(result.current.activeConnections).toBe(0);
      expect(result.current.systemOnline).toBe(false);
      expect(result.current.uptime).toBe(0);
    });
  });
});
