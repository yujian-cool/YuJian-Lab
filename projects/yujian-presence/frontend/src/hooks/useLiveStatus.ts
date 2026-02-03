/**
 * useLiveStatus Hook
 * 实时系统状态数据 Hook
 * @author Frontend Engineer
 * @version 1.0.0
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type {
  SystemStatus,
  StatusUpdateData,
  ServerMessage,
  StatusChange,
  MessageType,
} from '../types/websocket';

/**
 * 状态 Hook 返回值
 */
export interface UseLiveStatusReturn {
  /** 当前系统状态 */
  status: SystemStatus | null;
  /** 状态变化列表 */
  changes: StatusChange[];
  /** 最后更新时间 */
  lastUpdated: number;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在重连 */
  isReconnecting: boolean;
  /** 连接状态 */
  connectionState: string;
  /** 派生数据: CPU 使用率 */
  cpuUsage: number;
  /** 派生数据: 内存使用率 */
  memoryUsage: number;
  /** 派生数据: 磁盘使用率 */
  diskUsage: number;
  /** 派生数据: 活跃连接数 */
  activeConnections: number;
  /** 派生数据: 系统是否在线 */
  systemOnline: boolean;
  /** 派生数据: 系统运行时间 */
  uptime: number;
}

/**
 * 默认状态 (离线状态)
 */
const DEFAULT_STATUS: SystemStatus = {
  systemOnline: false,
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
  activeConnections: 0,
  uptime: 0,
  timestamp: Date.now(),
};

/**
 * useLiveStatus Hook
 * 
 * 与 useWebSocket 配合使用，接收实时状态更新
 * 
 * @param lastMessage 来自 useWebSocket 的最后消息
 * @param isConnected 连接状态
 * @param isReconnecting 重连状态
 * @param connectionState 连接状态字符串
 * @returns 实时状态数据
 * 
 * @example
 * ```tsx
 * const ws = useWebSocket({ initialSubscriptions: ['status'] });
 * const liveStatus = useLiveStatus(
 *   ws.lastMessage,
 *   ws.isConnected,
 *   ws.isReconnecting,
 *   ws.connectionState
 * );
 * ```
 */
export function useLiveStatus(
  lastMessage: ServerMessage | null,
  isConnected: boolean,
  isReconnecting: boolean,
  connectionState: string
): UseLiveStatusReturn {
  // 状态数据
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [changes, setChanges] = useState<StatusChange[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  
  // 用于防抖的 ref
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 处理状态更新消息
   */
  useEffect(() => {
    if (!lastMessage) return;

    // 只处理 status 类型的消息
    if (lastMessage.type !== 'status') return;

    const data = lastMessage.data as StatusUpdateData;
    
    if (data?.status) {
      // 清除之前的防抖定时器
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // 使用 requestAnimationFrame 节流，避免 UI 卡顿
      updateTimeoutRef.current = setTimeout(() => {
        setStatus(data.status);
        setChanges(data.changes || []);
        setLastUpdated(Date.now());
      }, 16); // ~60fps
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [lastMessage]);

  // 计算派生数据
  const currentStatus = status || DEFAULT_STATUS;

  // 使用 useMemo 缓存返回值
  return useMemo(
    () => ({
      status: currentStatus,
      changes,
      lastUpdated,
      isConnected,
      isReconnecting,
      connectionState,
      cpuUsage: currentStatus.cpuUsage,
      memoryUsage: currentStatus.memoryUsage,
      diskUsage: currentStatus.diskUsage,
      activeConnections: currentStatus.activeConnections,
      systemOnline: currentStatus.systemOnline,
      uptime: currentStatus.uptime,
    }),
    [
      currentStatus,
      changes,
      lastUpdated,
      isConnected,
      isReconnecting,
      connectionState,
    ]
  );
}

export default useLiveStatus;
