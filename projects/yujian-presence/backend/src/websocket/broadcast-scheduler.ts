/**
 * Broadcast Scheduler - 广播调度器
 * 负责消息队列管理、批量广播和优先级调度
 */

import type {
  BroadcastTask,
  ConnectionMetadata,
  MessageType,
  MessagePriority,
  ServerEvent,
  WebSocketConfig,
  ServerMessage
} from './types';
import type { ConnectionManager } from './connection-manager';
import { generateUUID } from './connection-manager';

/**
 * 广播调度器
 * 管理消息队列，按优先级和时间顺序调度广播任务
 */
export class BroadcastScheduler {
  /** 消息队列 */
  private messageQueue: BroadcastTask[] = [];

  /** 是否正在处理队列 */
  private isProcessing = false;

  /** 批处理定时器 */
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /** WebSocket 配置 */
  private config: WebSocketConfig;

  /**
   * 创建广播调度器实例
   * @param connectionManager 连接管理器实例
   * @param config WebSocket 配置选项
   */
  constructor(
    private connectionManager: ConnectionManager,
    config: Partial<WebSocketConfig> = {}
  ) {
    this.config = {
      broadcastBatchSize: 100,
      broadcastFlushInterval: 50,
      ...config
    } as WebSocketConfig;

    // 启动定期刷新循环
    this.startFlushLoop();
  }

  /**
   * 将广播任务加入队列
   * @param task 广播任务
   */
  enqueue(task: BroadcastTask): void {
    this.messageQueue.push(task);

    // 高优先级任务立即触发处理
    if (task.priority === 'high') {
      this.processQueue();
    }
  }

  /**
   * 创建并加入广播任务 (便捷方法)
   * @param type 消息类型
   * @param event 事件名称
   * @param data 事件数据
   * @param priority 消息优先级 (默认 'normal')
   */
  broadcast(
    type: MessageType,
    event: ServerEvent,
    data: unknown,
    priority: MessagePriority = 'normal'
  ): void {
    this.enqueue({
      type,
      event,
      data,
      priority,
      timestamp: Date.now()
    });
  }

  /**
   * 紧急广播 - 立即发送，不经过队列
   * @param type 消息类型
   * @param event 事件名称
   * @param data 事件数据
   */
  async broadcastUrgent(
    type: MessageType,
    event: ServerEvent,
    data: unknown
  ): Promise<void> {
    const connections = this.connectionManager.getConnectionsBySubscription(type);

    if (connections.length === 0) return;

    const message: ServerMessage = {
      id: generateUUID(),
      type,
      timestamp: Date.now(),
      direction: 'server-to-client',
      event,
      data
    };

    const serialized = JSON.stringify(message);

    // 使用 Promise.allSettled 确保部分失败不影响其他
    await Promise.allSettled(
      connections.map(conn => this.sendToConnection(conn, serialized))
    );
  }

  /**
   * 批量广播给特定连接
   * @param connectionIds 目标连接 ID 列表
   * @param message 消息对象
   */
  async broadcastToConnections(
    connectionIds: string[],
    message: ServerMessage
  ): Promise<void> {
    const serialized = JSON.stringify(message);

    await Promise.allSettled(
      connectionIds.map(id => {
        const conn = this.connectionManager.getConnection(id);
        if (conn) {
          return this.sendToConnection(conn, serialized);
        }
        return Promise.resolve();
      })
    );
  }

  /**
   * 发送消息到单个连接
   * @param connection 连接元数据
   * @param message 已序列化的消息字符串
   */
  private async sendToConnection(
    connection: ConnectionMetadata,
    message: string
  ): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (connection.isAlive && connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(message);
        }
        resolve();
      } catch (error) {
        // 静默处理单个连接发送失败
        console.error(`[WebSocket] Failed to send to connection ${connection.id}:`, error);
        resolve();
      }
    });
  }

  /**
   * 处理消息队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // 按优先级和时间排序
      this.sortQueue();

      // 批量处理
      const batchSize = this.config.broadcastBatchSize || 100;
      const batch = this.messageQueue.splice(0, batchSize);

      await this.broadcastBatch(batch);
    } catch (error) {
      console.error('[WebSocket] Error processing broadcast queue:', error);
    } finally {
      this.isProcessing = false;

      // 如果队列还有消息，继续处理
      if (this.messageQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * 对队列进行排序
   * 优先级: high (0) > normal (1) > low (2)
   * 相同优先级按时间戳排序
   */
  private sortQueue(): void {
    const priorityWeight: Record<MessagePriority, number> = {
      high: 0,
      normal: 1,
      low: 2
    };

    this.messageQueue.sort((a, b) => {
      const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * 批量广播消息
   * @param tasks 广播任务数组
   */
  private async broadcastBatch(tasks: BroadcastTask[]): Promise<void> {
    if (tasks.length === 0) return;

    // 按类型分组，减少遍历次数
    const tasksByType = this.groupByType(tasks);

    for (const [type, typeTasks] of tasksByType) {
      const connections = this.connectionManager.getConnectionsBySubscription(type);

      if (connections.length === 0) continue;

      // 合并相同类型的消息
      const mergedMessage = this.createMergedMessage(type, typeTasks);
      const serialized = JSON.stringify(mergedMessage);

      // 批量发送
      await Promise.allSettled(
        connections.map(conn => this.sendToConnection(conn, serialized))
      );
    }
  }

  /**
   * 按消息类型对任务分组
   * @param tasks 广播任务数组
   * @returns 类型到任务数组的映射
   */
  private groupByType(tasks: BroadcastTask[]): Map<MessageType, BroadcastTask[]> {
    const groups = new Map<MessageType, BroadcastTask[]>();

    for (const task of tasks) {
      if (!groups.has(task.type)) {
        groups.set(task.type, []);
      }
      groups.get(task.type)!.push(task);
    }

    return groups;
  }

  /**
   * 创建合并后的消息
   * @param type 消息类型
   * @param tasks 广播任务数组
   * @returns 合并后的服务器消息
   */
  private createMergedMessage(
    type: MessageType,
    tasks: BroadcastTask[]
  ): ServerMessage {
    if (tasks.length === 1) {
      // 单条消息直接返回
      return {
        id: generateUUID(),
        type,
        timestamp: Date.now(),
        direction: 'server-to-client',
        event: tasks[0].event,
        data: tasks[0].data
      };
    }

    // 多条消息合并为批量更新
    return {
      id: generateUUID(),
      type,
      timestamp: Date.now(),
      direction: 'server-to-client',
      event: 'batch_update',
      data: {
        events: tasks.map(t => ({
          event: t.event,
          data: t.data,
          timestamp: t.timestamp
        }))
      }
    };
  }

  /**
   * 启动定期刷新循环
   */
  private startFlushLoop(): void {
    const interval = this.config.broadcastFlushInterval || 50;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, interval);
  }

  /**
   * 立即刷新队列 (发送所有待处理消息)
   */
  flush(): void {
    if (this.messageQueue.length > 0 && !this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * 获取队列统计信息
   * @returns 队列长度和处理状态
   */
  getQueueStats(): { length: number; isProcessing: boolean } {
    return {
      length: this.messageQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * 清理队列中的所有消息
   * @returns 被清理的消息数量
   */
  clearQueue(): number {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    return count;
  }

  /**
   * 停止调度器
   * 清理定时器和队列
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.clearQueue();
  }
}

export default BroadcastScheduler;
