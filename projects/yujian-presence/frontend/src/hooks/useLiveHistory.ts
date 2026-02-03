/**
 * useLiveHistory Hook
 * 实时历史数据 Hook
 * @author Frontend Engineer
 * @version 1.0.0
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type {
  HistoryItem,
  HistoryUpdateData,
  ServerMessage,
} from '../types/websocket';

/**
 * 历史数据 Hook 返回值
 */
export interface UseLiveHistoryReturn {
  /** 历史记录列表 */
  items: HistoryItem[];
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 总数 */
  total: number;
  /** 最后更新时间 */
  lastUpdated: number;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在重连 */
  isReconnecting: boolean;
  /** 添加新记录到列表顶部 */
  prependItems: (newItems: HistoryItem[]) => void;
  /** 追加记录到列表底部 (用于分页加载) */
  appendItems: (newItems: HistoryItem[]) => void;
  /** 手动设置历史数据 (用于初始化或重置) */
  setHistory: (items: HistoryItem[], total?: number) => void;
}

/**
 * useLiveHistory Hook
 * 
 * 与 useWebSocket 配合使用，接收实时历史数据更新
 * 
 * @param lastMessage 来自 useWebSocket 的最后消息
 * @param isConnected 连接状态
 * @param isReconnecting 重连状态
 * @returns 实时历史数据
 * 
 * @example
 * ```tsx
 * const ws = useWebSocket({ initialSubscriptions: ['history'] });
 * const liveHistory = useLiveHistory(
 *   ws.lastMessage,
 *   ws.isConnected,
 *   ws.isReconnecting
 * );
 * 
 * // 渲染历史列表
 * {liveHistory.items.map(item => <HistoryRow key={item.id} item={item} />)}
 * ```
 */
export function useLiveHistory(
  lastMessage: ServerMessage | null,
  isConnected: boolean,
  isReconnecting: boolean
): UseLiveHistoryReturn {
  // 历史数据状态
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  
  // 用于去重的 Set (存储已有的 ID)
  const existingIdsRef = useRef<Set<number>>(new Set());

  /**
   * 处理历史更新消息
   */
  useEffect(() => {
    if (!lastMessage) return;

    // 处理 history_update 事件 (新增记录)
    if (lastMessage.type === 'history' && lastMessage.event === 'history_update') {
      const data = lastMessage.data as HistoryUpdateData;
      
      if (data?.items && data.items.length > 0) {
        setItems((prevItems) => {
          // 过滤已存在的记录
          const newItems = data.items.filter(
            (item) => !existingIdsRef.current.has(item.id)
          );
          
          if (newItems.length === 0) return prevItems;
          
          // 更新 ID 集合
          newItems.forEach((item) => existingIdsRef.current.add(item.id));
          
          // 新记录添加到顶部
          const updated = [...newItems, ...prevItems];
          
          // 限制最大数量，避免内存溢出 (保留最近 200 条)
          if (updated.length > 200) {
            const trimmed = updated.slice(0, 200);
            // 更新 ID 集合
            existingIdsRef.current = new Set(trimmed.map((i) => i.id));
            return trimmed;
          }
          
          return updated;
        });
        
        setHasMore(data.hasMore ?? true);
        setTotal(data.total ?? items.length + data.items.length);
        setLastUpdated(Date.now());
      }
    }

    // 处理 history_data 事件 (初始历史数据)
    if (lastMessage.event === 'history_data') {
      const data = lastMessage.data as HistoryUpdateData;
      
      if (data?.items) {
        setItems(data.items);
        setHasMore(data.hasMore ?? true);
        setTotal(data.total ?? data.items.length);
        
        // 更新 ID 集合
        existingIdsRef.current = new Set(data.items.map((i) => i.id));
        setLastUpdated(Date.now());
      }
    }
  }, [lastMessage, items.length]);

  /**
   * 手动添加新记录到列表顶部
   * 用于本地乐观更新或其他场景
   */
  const prependItems = useCallback((newItems: HistoryItem[]) => {
    if (!newItems || newItems.length === 0) return;

    setItems((prevItems) => {
      // 过滤已存在的
      const uniqueNew = newItems.filter(
        (item) => !existingIdsRef.current.has(item.id)
      );
      
      if (uniqueNew.length === 0) return prevItems;
      
      uniqueNew.forEach((item) => existingIdsRef.current.add(item.id));
      
      return [...uniqueNew, ...prevItems];
    });
    
    setLastUpdated(Date.now());
  }, []);

  /**
   * 手动追加记录到列表底部
   * 用于分页加载更多数据
   */
  const appendItems = useCallback((newItems: HistoryItem[]) => {
    if (!newItems || newItems.length === 0) return;

    setItems((prevItems) => {
      // 过滤已存在的
      const uniqueNew = newItems.filter(
        (item) => !existingIdsRef.current.has(item.id)
      );
      
      if (uniqueNew.length === 0) return prevItems;
      
      uniqueNew.forEach((item) => existingIdsRef.current.add(item.id));
      
      return [...prevItems, ...uniqueNew];
    });
    
    setLastUpdated(Date.now());
  }, []);

  /**
   * 手动设置历史数据
   */
  const setHistory = useCallback((newItems: HistoryItem[], newTotal?: number) => {
    setItems(newItems);
    setTotal(newTotal ?? newItems.length);
    existingIdsRef.current = new Set(newItems.map((i) => i.id));
    setLastUpdated(Date.now());
  }, []);

  // 使用 useMemo 缓存返回值
  return useMemo(
    () => ({
      items,
      hasMore,
      total,
      lastUpdated,
      isConnected,
      isReconnecting,
      prependItems,
      appendItems,
      setHistory,
    }),
    [items, hasMore, total, lastUpdated, isConnected, isReconnecting, prependItems, appendItems, setHistory]
  );
}

export default useLiveHistory;
