/**
 * ConnectionStatus 组件
 * WebSocket 连接状态可视化指示器
 * @author Frontend Engineer
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import type { ConnectionState, ConnectionStateConfig } from '../types/websocket';

/**
 * 组件属性
 */
interface ConnectionStatusProps {
  /** 连接状态 */
  connectionState: ConnectionState;
  /** 是否显示详细文本 (默认 true) */
  showText?: boolean;
  /** 是否显示重连次数 */
  showReconnectAttempts?: boolean;
  /** 重连次数 */
  reconnectAttempts?: number;
  /** 自定义样式类名 */
  className?: string;
  /** 点击事件 */
  onClick?: () => void;
}

/**
 * 连接状态配置映射
 */
const STATE_CONFIG: Record<ConnectionState, ConnectionStateConfig> = {
  connected: {
    color: 'bg-green-500',
    text: '已连接',
    icon: '●',
    description: '实时数据同步中',
  },
  connecting: {
    color: 'bg-blue-500',
    text: '连接中',
    icon: '◐',
    description: '正在建立连接...',
  },
  reconnecting: {
    color: 'bg-yellow-500',
    text: '重连中',
    icon: '◑',
    description: '连接断开，正在重试...',
  },
  disconnected: {
    color: 'bg-red-500',
    text: '已断开',
    icon: '○',
    description: '连接已断开',
  },
};

/**
 * ConnectionStatus 组件
 * 
 * 显示 WebSocket 连接状态的视觉指示器，包括：
 * - 彩色状态指示灯
 * - 状态图标和文本
 * - 重连次数显示 (可选)
 * 
 * @example
 * ```tsx
 * <ConnectionStatus 
 *   connectionState="connected" 
 *   showText={true}
 * />
 * 
 * // 显示重连次数
 * <ConnectionStatus 
 *   connectionState="reconnecting"
 *   showReconnectAttempts={true}
 *   reconnectAttempts={2}
 * />
 * ```
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionState,
  showText = true,
  showReconnectAttempts = false,
  reconnectAttempts = 0,
  className = '',
  onClick,
}) => {
  // 获取当前状态配置
  const config = STATE_CONFIG[connectionState];

  // 判断是否应该闪烁动画
  const shouldPulse = useMemo(() => {
    return connectionState === 'connecting' || connectionState === 'reconnecting';
  }, [connectionState]);

  // 判断是否为错误/离线状态
  const isErrorState = useMemo(() => {
    return connectionState === 'disconnected' || connectionState === 'reconnecting';
  }, [connectionState]);

  return (
    <div
      className={`
        inline-flex items-center gap-2 
        px-3 py-1.5 
        rounded-full 
        bg-surface/80 
        border border-white/5
        backdrop-blur-sm
        transition-all duration-300
        ${onClick ? 'cursor-pointer hover:bg-surface' : ''}
        ${className}
      `}
      onClick={onClick}
      title={config.description}
      role="status"
      aria-live="polite"
      aria-label={`WebSocket 连接状态: ${config.text}`}
    >
      {/* 状态指示灯 */}
      <span
        className={`
          w-2 h-2 rounded-full
          ${config.color}
          ${shouldPulse ? 'animate-pulse' : ''}
          shadow-[0_0_8px_rgba(0,0,0,0.3)]
          transition-all duration-300
        `}
      />

      {/* 状态图标 */}
      <span
        className={`
          text-xs
          ${isErrorState ? 'text-yellow-400' : 'text-primary'}
          font-mono
          ${shouldPulse ? 'animate-spin' : ''}
        `}
        style={{ animationDuration: shouldPulse ? '2s' : '0s' }}
      >
        {config.icon}
      </span>

      {/* 状态文本 */}
      {showText && (
        <span className="text-xs font-medium text-secondary/70 tracking-wide">
          {config.text}
        </span>
      )}

      {/* 重连次数 - 仅在重连状态下显示 */}
      {showReconnectAttempts && connectionState === 'reconnecting' && reconnectAttempts > 0 && (
        <span className="text-[10px] text-yellow-500/70 font-mono ml-1">
          (重试 {reconnectAttempts})
        </span>
      )}
    </div>
  );
};

/**
 * 连接状态指示条 (水平布局，适合导航栏)
 */
export const ConnectionStatusBar: React.FC<ConnectionStatusProps> = (props) => {
  return (
    <div className="flex items-center gap-3">
      <ConnectionStatus {...props} />
      
      {/* 额外的连接信息 */}
      {props.connectionState === 'reconnecting' && (
        <span className="text-[10px] text-secondary/40 animate-pulse">
          正在恢复实时数据...
        </span>
      )}
      
      {props.connectionState === 'disconnected' && (
        <span className="text-[10px] text-red-400/60">
          数据可能不是最新的
        </span>
      )}
    </div>
  );
};

/**
 * 连接状态卡片 (详细版本，适合设置页面)
 */
export const ConnectionStatusCard: React.FC<ConnectionStatusProps> = ({
  connectionState,
  reconnectAttempts = 0,
  className = '',
}) => {
  const config = STATE_CONFIG[connectionState];

  return (
    <div
      className={`
        p-4 rounded-xl 
        bg-surface/50 
        border border-white/5
        ${className}
      `}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className={`w-3 h-3 rounded-full ${config.color} animate-pulse`} />
        <span className="text-sm font-medium text-white">{config.text}</span>
      </div>
      
      <p className="text-xs text-secondary/60 mb-3">
        {config.description}
      </p>

      {connectionState === 'reconnecting' && reconnectAttempts > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-yellow-500/70">
          <span className="w-4 h-4 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
          <span>第 {reconnectAttempts} 次重连尝试...</span>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
