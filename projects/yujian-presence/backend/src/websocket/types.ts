/**
 * WebSocket 类型定义
 * 基于架构设计文档的消息协议规范
 */

/** 消息类型 */
export type MessageType =
  | 'status'      // 系统状态
  | 'stats'       // 统计数据
  | 'health'      // 健康监控
  | 'config'      // 配置/订阅
  | 'system'      // 系统消息
  | 'error'       // 错误
  | 'all';        // 订阅所有类型

/** 客户端动作类型 */
export type ClientAction =
  | 'subscribe'      // 订阅消息类型
  | 'unsubscribe'    // 取消订阅
  | 'ping'           // 心跳请求
  | 'get_history'    // 获取历史数据
  | 'ack';           // 确认收到

/** 服务端事件类型 */
export type ServerEvent =
  | 'connected'        // 连接成功
  | 'disconnected'     // 断开连接
  | 'status_update'    // 状态更新
  | 'stats_update'     // 统计更新
  | 'health_alert'     // 健康告警
  | 'health_recovery'  // 健康恢复
  | 'pong'             // 心跳响应
  | 'history_data'     // 历史数据
  | 'error'            // 错误
  | 'subscribed'       // 订阅确认
  | 'unsubscribed'     // 取消订阅确认
  | 'batch_update';    // 批量更新

/** 消息方向 */
export type MessageDirection = 'client-to-server' | 'server-to-client';

/** 消息优先级 */
export type MessagePriority = 'high' | 'normal' | 'low';

/** 基础消息接口 */
export interface BaseMessage {
  /** 消息唯一标识符 (UUID) */
  id: string;
  /** 消息类型 */
  type: MessageType;
  /** 消息时间戳 (Unix 毫秒) */
  timestamp: number;
  /** 消息方向 */
  direction: MessageDirection;
}

/** 客户端发送的消息 */
export interface ClientMessage extends BaseMessage {
  direction: 'client-to-server';
  /** 客户端动作 */
  action: ClientAction;
  /** 动作相关的载荷数据 */
  payload?: SubscribePayload | UnsubscribePayload | GetHistoryPayload | unknown;
}

/** 服务端发送的消息 */
export interface ServerMessage extends BaseMessage {
  direction: 'server-to-client';
  /** 服务端事件名称 */
  event: ServerEvent;
  /** 事件数据载荷 */
  data: unknown;
}

/** 订阅请求载荷 */
export interface SubscribePayload {
  /** 要订阅的消息类型列表 */
  types: MessageType[];
}

/** 取消订阅请求载荷 */
export interface UnsubscribePayload {
  /** 要取消订阅的消息类型列表 */
  types: MessageType[];
}

/** 获取历史数据请求载荷 */
export interface GetHistoryPayload {
  /** 数据类型 */
  type: Exclude<MessageType, 'config' | 'system' | 'error' | 'all'>;
  /** 请求数量限制 (1-100) */
  limit: number;
}

/** 连接元数据 */
export interface ConnectionMetadata {
  /** 连接唯一标识符 */
  id: string;
  /** 用户标识符 (从 token 或 session 提取) */
  userId: string;
  /** WebSocket 实例 */
  socket: WebSocket;
  /** 已订阅的消息类型集合 */
  subscriptions: Set<MessageType>;
  /** 连接建立时间 */
  connectedAt: Date;
  /** 最后心跳时间 */
  lastHeartbeat: Date;
  /** 连接是否存活 */
  isAlive: boolean;
}

/** 连接统计信息 */
export interface ConnectionStats {
  /** 总连接数 */
  totalConnections: number;
  /** 唯一用户数 */
  uniqueUsers: number;
  /** 平均订阅数 */
  averageSubscriptions: number;
}

/** 广播任务 */
export interface BroadcastTask {
  /** 消息类型 */
  type: MessageType;
  /** 事件名称 */
  event: ServerEvent;
  /** 事件数据 */
  data: unknown;
  /** 消息优先级 */
  priority: MessagePriority;
  /** 任务创建时间戳 */
  timestamp: number;
}

/** 系统状态数据 */
export interface SystemStatus {
  /** 系统在线状态 */
  systemOnline: boolean;
  /** CPU 使用率 (0-100) */
  cpuUsage: number;
  /** 内存使用率 (0-100) */
  memoryUsage: number;
  /** 磁盘使用率 (0-100) */
  diskUsage: number;
  /** 当前活跃连接数 */
  activeConnections: number;
  /** 系统运行时间 (秒) */
  uptime: number;
  /** 时间戳 */
  timestamp: number;
  /** 系统版本 */
  version: string;
}

/** 统计数据 */
export interface SystemStats {
  /** 统计周期 */
  period: '1m' | '5m' | '15m' | '1h' | '24h';
  /** 请求统计 */
  requests: {
    total: number;
    success: number;
    error: number;
    perSecond: number;
  };
  /** 延迟统计 */
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  /** 时间戳 */
  timestamp: number;
}

/** 健康告警 */
export interface HealthAlert {
  /** 告警级别 */
  level: 'info' | 'warning' | 'critical';
  /** 组件名称 */
  component: string;
  /** 告警消息 */
  message: string;
  /** 阈值 */
  threshold: number;
  /** 当前值 */
  currentValue: number;
  /** 时间戳 */
  timestamp: number;
  /** 详细信息 */
  details?: Record<string, unknown>;
}

/** 变更检测项 */
export interface Change {
  /** 变更字段 */
  field: string;
  /** 旧值 */
  oldValue: unknown;
  /** 新值 */
  newValue: unknown;
  /** 变化量 */
  delta?: number;
}

/** 错误代码 */
export type ErrorCode =
  | 'PARSE_ERROR'
  | 'INVALID_TYPE'
  | 'INVALID_ACTION'
  | 'MAX_CONNECTIONS_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR'
  | 'HEARTBEAT_TIMEOUT'
  | 'QUEUE_OVERFLOW'
  | 'SUBSCRIPTION_INVALID';

/** WebSocket 配置选项 */
export interface WebSocketConfig {
  /** 心跳间隔 (毫秒, 默认 30000) */
  heartbeatInterval: number;
  /** 心跳超时时间 (毫秒, 默认 60000) */
  heartbeatTimeout: number;
  /** 每用户最大连接数 (默认 3) */
  maxConnectionsPerUser: number;
  /** 全局最大连接数 (默认 10000) */
  maxTotalConnections: number;
  /** 广播批处理大小 (默认 100) */
  broadcastBatchSize: number;
  /** 广播刷新间隔 (毫秒, 默认 50) */
  broadcastFlushInterval: number;
  /** 历史数据默认条数 (默认 50) */
  defaultHistoryLimit: number;
  /** 支持的消息类型列表 */
  supportedTypes: MessageType[];
}

/** 默认 WebSocket 配置 */
export const DEFAULT_WS_CONFIG: WebSocketConfig = {
  heartbeatInterval: 30000,
  heartbeatTimeout: 60000,
  maxConnectionsPerUser: 3,
  maxTotalConnections: 10000,
  broadcastBatchSize: 100,
  broadcastFlushInterval: 50,
  defaultHistoryLimit: 50,
  supportedTypes: ['status', 'stats', 'health', 'config', 'system'],
};

/** WebSocket 上下文扩展 */
export interface WebSocketContext {
  /** 连接 ID */
  connectionId: string;
  /** 用户 ID */
  userId: string;
}
