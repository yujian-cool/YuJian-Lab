/**
 * useLiveHistory Hook 单元测试
 * @author Frontend Engineer
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveHistory } from '../src/hooks/useLiveHistory';
import type { ServerMessage, HistoryItem, HistoryUpdateData } from '../src/types/websocket';

describe('useLiveHistory', () => {
  const mockHistoryItems: HistoryItem[] = [
    { id: 1, content: 'Item 1', type: 'public', timestamp: '2024-01-01T00:00:00Z' },
    { id: 2, content: 'Item 2', type: 'public', timestamp: '2024-01-01T01:00:00Z' },
    { id: 3, content: 'Item 3', type: 'private', timestamp: '2024-01-01T02:00:00Z' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('初始状态', () => {
    it('应该返回空列表', () => {
      const { result } = renderHook(() => 
        useLiveHistory(null, false, false)
      );

      expect(result.current.items).toEqual([]);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.total).toBe(0);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
    });
  });

  describe('history_update 事件', () => {
    it('应该添加新记录到列表顶部', () => {
      const historyUpdate: ServerMessage = {
        id: 'test-id',
        type: 'history',
        timestamp: Date.now(),
        event: 'history_update',
        data: {
          items: mockHistoryItems,
          hasMore: true,
          total: 100,
        } as HistoryUpdateData,
      };

      const { result } = renderHook(() => 
        useLiveHistory(historyUpdate, true, false)
      );

      expect(result.current.items).toHaveLength(3);
      // 新记录应该添加到顶部
      expect(result.current.items[0].id).toBe(1);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.total).toBe(100);
    });

    it('应该过滤重复的记录', () => {
      // 第一次更新 - id=1
      const firstUpdate: ServerMessage = {
        id: 'test-1',
        type: 'history',
        timestamp: Date.now(),
        event: 'history_update',
        data: {
          items: [mockHistoryItems[0]], // id=1
          hasMore: true,
          total: 100,
        } as HistoryUpdateData,
      };

      const { result, rerender } = renderHook(
        ({ msg }) => useLiveHistory(msg, true, false),
        { initialProps: { msg: firstUpdate as ServerMessage | null } }
      );

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe(1);

      // 第二次更新 - 包含 id=1（重复）和 id=2（新）
      const secondUpdate: ServerMessage = {
        id: 'test-2',
        type: 'history',
        timestamp: Date.now(),
        event: 'history_update',
        data: {
          items: [
            { id: 2, content: 'New Item 2', type: 'public', timestamp: '2024-01-01T03:00:00Z' },
            { id: 1, content: 'Item 1', type: 'public', timestamp: '2024-01-01T00:00:00Z' }, // 重复
          ],
          hasMore: true,
          total: 100,
        } as HistoryUpdateData,
      };

      rerender({ msg: secondUpdate });

      // 应该只有 2 条记录（id=1 和 id=2）
      expect(result.current.items).toHaveLength(2);
      // id=2 是新记录，应该在最前面（因为是新推送的数据）
      expect(result.current.items.map(i => i.id)).toContain(1);
      expect(result.current.items.map(i => i.id)).toContain(2);
    });

    it('应该限制最大记录数为 200', () => {
      const manyItems: HistoryItem[] = Array.from({ length: 250 }, (_, i) => ({
        id: i + 1,
        content: `Item ${i + 1}`,
        type: 'public',
        timestamp: '2024-01-01T00:00:00Z',
      }));

      const historyUpdate: ServerMessage = {
        id: 'test-id',
        type: 'history',
        timestamp: Date.now(),
        event: 'history_update',
        data: {
          items: manyItems,
          hasMore: true,
          total: 300,
        } as HistoryUpdateData,
      };

      const { result } = renderHook(() => 
        useLiveHistory(historyUpdate, true, false)
      );

      // 应该被限制到 200 条
      expect(result.current.items).toHaveLength(200);
    });
  });

  describe('history_data 事件', () => {
    it('应该替换整个历史列表', () => {
      const historyData: ServerMessage = {
        id: 'test-id',
        type: 'history',
        timestamp: Date.now(),
        event: 'history_data',
        data: {
          items: mockHistoryItems,
          hasMore: false,
          total: 3,
        } as HistoryUpdateData,
      };

      const { result } = renderHook(() => 
        useLiveHistory(historyData, true, false)
      );

      expect(result.current.items).toHaveLength(3);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.total).toBe(3);
    });
  });

  describe('手动操作', () => {
    it('prependItems 应该添加记录到顶部', () => {
      const { result } = renderHook(() => 
        useLiveHistory(null, true, false)
      );

      act(() => {
        result.current.prependItems(mockHistoryItems);
      });

      expect(result.current.items).toHaveLength(3);
      expect(result.current.items[0].id).toBe(1);
    });

    it('prependItems 应该过滤重复', () => {
      const { result } = renderHook(() => 
        useLiveHistory(null, true, false)
      );

      act(() => {
        result.current.prependItems([mockHistoryItems[0]]);
      });

      act(() => {
        result.current.prependItems([mockHistoryItems[0], mockHistoryItems[1]]);
      });

      // 应该只有 2 条记录
      expect(result.current.items).toHaveLength(2);
    });

    it('appendItems 应该添加记录到底部', () => {
      const { result } = renderHook(() => 
        useLiveHistory(null, true, false)
      );

      act(() => {
        result.current.appendItems([mockHistoryItems[0]]);
      });

      act(() => {
        result.current.appendItems([mockHistoryItems[1], mockHistoryItems[2]]);
      });

      expect(result.current.items).toHaveLength(3);
      // 追加的记录应该在底部
      expect(result.current.items[result.current.items.length - 1].id).toBe(3);
    });

    it('setHistory 应该替换整个列表', () => {
      const { result } = renderHook(() => 
        useLiveHistory(null, true, false)
      );

      act(() => {
        result.current.setHistory(mockHistoryItems, 10);
      });

      expect(result.current.items).toHaveLength(3);
      expect(result.current.total).toBe(10);
    });
  });

  describe('连接状态', () => {
    it('应该正确反映连接状态', () => {
      const historyUpdate: ServerMessage = {
        id: 'test-id',
        type: 'history',
        timestamp: Date.now(),
        event: 'history_update',
        data: {
          items: mockHistoryItems,
          hasMore: true,
          total: 100,
        } as HistoryUpdateData,
      };

      const { result } = renderHook(() => 
        useLiveHistory(historyUpdate, true, false)
      );

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isReconnecting).toBe(false);
    });

    it('应该正确反映重连状态', () => {
      const { result } = renderHook(() => 
        useLiveHistory(null, false, true)
      );

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isReconnecting).toBe(true);
    });
  });

  describe('非 history 类型消息', () => {
    it('应该忽略非 history 类型的消息', () => {
      const nonHistoryMessage: ServerMessage = {
        id: 'test-id',
        type: 'status',
        timestamp: Date.now(),
        event: 'status_update',
        data: { status: {} },
      };

      const { result } = renderHook(() => 
        useLiveHistory(nonHistoryMessage, true, false)
      );

      expect(result.current.items).toEqual([]);
    });

    it('应该忽略非预期 event 的 history 消息', () => {
      const otherEventMessage: ServerMessage = {
        id: 'test-id',
        type: 'history',
        timestamp: Date.now(),
        event: 'unknown_event' as any,
        data: { items: mockHistoryItems },
      };

      const { result } = renderHook(() => 
        useLiveHistory(otherEventMessage, true, false)
      );

      expect(result.current.items).toEqual([]);
    });
  });
});
