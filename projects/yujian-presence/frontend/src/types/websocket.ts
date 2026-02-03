/**
 * WebSocket 类型定义
 * 基于架构设计文档的消息协议规范
 * @author Frontend Engineer
 * @version 1.0.0
 */

// ==================== 消息类型 ====================

/** WebSocket 消息类型 */
export type MessageType = 
  | 'status'      // 系统状态
  | 'stats'       // 统计数据
  | 'health'      // 健康监控
  | 'history'     // 历史数据
  | 'config'      // 配置/订阅
  | 'system'      // 系统消息
  | 'error';      // 错误

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
  | 'disconnected'       // 断开连接
  | 'subscribed'         // 订阅确认
  | 'unsubscribed'       // 取消订阅确认
  | 'status_update'      // 状态更新
  | 'stats_update'       // 统计更新
  | 'health_alert'       // 健康告警
  | 'health_recovery'    // 健康恢复
  | 'history_update'     // 历史更新
  | 'pong'               // 心跳响应
  | 'history_data'       // 历史数据
  | 'error';             // 错误

/** 连接状态 */
export type ConnectionState = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting';

// ==================== 基础消息结构 ====================

/** 基础消息接口 */
export interface BaseMessage {
  /** 消息唯一标识 (UUID) */
  id: string;
  /** 消息类型 */
  type: MessageType;
  /** 消息时间戳 (Unix ms) */
  timestamp: number;
}

/** 客户端消息 (Client -> Server) */
export interface ClientMessage extends BaseMessage {
  /** 客户端动作 */
  action: ClientAction;
  /** 动作相关数据 */
  payload?: unknown;
}

/** 服务端消息 (Server -> Client) */
export interface ServerMessage extends BaseMessage {
  /** 服务端事件 */
  event: ServerEvent;
  /** 事件数据 */
  data: unknown;
}

// ==================== 订阅相关 ====================

/** 订阅请求负载 */
export interface SubscribePayload {
  /** 要订阅的消息类型列表 */
  types: MessageType[];
}

/** 订阅确认响应 */
export interface SubscribedData {
  /** 已订阅的类型列表 */
  subscribed: MessageType[];
  /** 订阅确认时间戳 */
  timestamp: number;
}

/** 取消订阅响应 */
export interface UnsubscribedData {
  /** 已取消订阅的类型列表 */
  unsubscribed: MessageType[];
  /** 取消订阅时间戳 */
  timestamp: number;
}

// ==================== 连接相关 ====================

/** 连接成功响应数据 */
export interface ConnectedData {
  /** 连接唯一标识 */
  connectionId: string;
  /** 服务器时间 */
  serverTime: number;
  /** 支持的消息类型 */
  supportedTypes: MessageType[];
  /** 心跳间隔 (ms) */
  heartbeatInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
}

// ==================== 系统状态 ====================

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
  version?: string;
}

/** 状态更新数据 */
export interface StatusUpdateData {
  /** 当前状态 */
  status: SystemStatus;
  /** 变化字段列表 */
  changes?: StatusChange[];
}

/** 状态变化项 */
export interface StatusChange {
  /** 变化的字段名 */
  field: string;
  /** 旧值 */
  oldValue: unknown;
  /** 新值 */
  newValue: unknown;
  /** 变化量 */
  delta?: number;
}

// ==================== 统计数据 ====================

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

/** 统计更新数据 */
export interface StatsUpdateData {
  /** 统计数据 */
  stats: SystemStats;
}

// ==================== 历史数据 ====================

/** 历史更新数据 */
export interface HistoryUpdateData {
  /** 新增的历史记录列表 */
  items: HistoryItem[];
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 总数 */
  total: number;
}

/** 历史记录项 (扩展原有的 HistoryItem) */
export interface HistoryItem {
  id: number;
  content: string;
  type: 'public' | 'private';
  timestamp: string;
}

// ==================== 健康监控 ====================

/** 健康告警级别 */
export type HealthLevel = 'info' | 'warning' | 'critical';

/** 健康告警数据 */
export interface HealthAlert {
  /** 告警级别 */
  level: HealthLevel;
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

/** 健康告警数据 */
export interface HealthAlertData {
  /** 告警信息 */
  alert: HealthAlert;
}

/** 健康恢复数据 */
export interface HealthRecoveryData {
  /** 恢复的组件 */
  component: string;
  /** 恢复消息 */
  message: string;
  /** 时间戳 */
  timestamp: number;
}

// ==================== 错误处理 ====================

/** 错误响应数据 */
export interface ErrorData {
  /** 错误码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 可选的错误详情 */
  details?: unknown;
}

// ==================== WebSocket 客户端配置 ====================

/** WebSocket 客户端选项 */
export interface WebSocketClientOptions {
  /** WebSocket URL */
  url: string;
  /** 自动连接 (默认 true) */
  autoConnect?: boolean;
  /** 重连间隔 (ms, 默认 3000) */
  reconnectInterval?: number;
  /** 最大重连次数 (默认 5) */
  maxReconnectAttempts?: number;
  /** 心跳间隔 (ms, 默认 30000) */
  heartbeatInterval?: number;
  /** 心跳超时 (ms, 默认 60000) */
  heartbeatTimeout?: number;
  /** 连接建立回调 */
  onOpen?: () => void;
  /** 连接关闭回调 */
  onClose?: () => void;
  /** 消息接收回调 */
  onMessage?: (message: ServerMessage) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 重连中回调 */
  onReconnecting?: (attempt: number) => void;
}

/** WebSocket 客户端状态 */
export interface WebSocketClientState {
  /** 连接状态 */
  connectionState: ConnectionState;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在重连 */
  isReconnecting: boolean;
  /** 当前重连次数 */
  reconnectAttempts: number;
  /** 最后接收的消息 */
  lastMessage: ServerMessage | null;
  /** 最后错误 */
  lastError: Error | null;
  /** 连接 ID */
  connectionId: string | null;
}

/** useWebSocket Hook 返回值 */
export interface UseWebSocketReturn extends WebSocketClientState {
  /** 主动连接 */
  connect: () => void;
  /** 主动断开 */
  disconnect: () => void;
  /** 订阅消息类型 */
  subscribe: (types: MessageType[]) => void;
  /** 取消订阅 */
  unsubscribe: (types: MessageType[]) => void;
  /** 发送消息 */
  send: (message: ClientMessage) => void;
  /** 发送 ping */
  ping: () => void;
}

// ==================== 连接状态显示 ====================

/** 连接状态配置 */
export interface ConnectionStateConfig {
  /** 状态颜色类名 */
  color: string;
  /** 状态文本 */
  text: string;
  /** 状态图标 */
  icon: string;
  /** 状态描述 */
  description?: string;
}
