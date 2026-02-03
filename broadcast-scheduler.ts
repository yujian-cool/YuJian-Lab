/**
 * Broadcast Scheduler - 广播调度器
 * 
 * Bug 1 修复说明:
 * - 问题: 广播队列无大小限制，存在内存溢出风险
 * - 修复: 添加 maxQueueSize 限制，当队列满时丢弃低优先级消息
 * - 优先级: high > medium > low，当队列满时优先丢弃 low 优先级消息
 */

export interface BroadcastMessage {
  id: string;
  type: string;
  content: any;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface SchedulerOptions {
  maxQueueSize?: number; // 默认队列大小限制
  defaultPriority?: 'high' | 'medium' | 'low';
}

export class BroadcastScheduler {
  // Bug 1 修复: 添加默认队列大小限制，防止内存溢出
  private static readonly DEFAULT_MAX_QUEUE_SIZE = 1000;
  
  private queue: BroadcastMessage[] = [];
  private readonly maxQueueSize: number;
  private isRunning: boolean = false;
  private subscribers: Map<string, Set<(msg: BroadcastMessage) => void>> = new Map();

  constructor(options: SchedulerOptions = {}) {
    // Bug 1 修复: 使用传入值或默认值设置队列大小限制
    this.maxQueueSize = options.maxQueueSize ?? BroadcastScheduler.DEFAULT_MAX_QUEUE_SIZE;
  }

  /**
   * 添加消息到广播队列
   * Bug 1 修复: 当队列满时，根据优先级丢弃消息
   */
  enqueue(message: BroadcastMessage): boolean {
    // 如果队列已满，需要丢弃低优先级消息
    if (this.queue.length >= this.maxQueueSize) {
      // 尝试丢弃一个低优先级消息，腾出空间给新消息
      const lowPriorityIndex = this.queue.findIndex(m => m.priority === 'low');
      
      if (lowPriorityIndex !== -1 && message.priority !== 'low') {
        // 丢弃低优先级消息，插入新消息
        this.queue.splice(lowPriorityIndex, 1);
        this.insertByPriority(message);
        return true;
      }
      
      // 如果新消息是低优先级，且队列已满（没有低优先级消息可丢弃），则拒绝
      if (message.priority === 'low') {
        console.warn(`[BroadcastScheduler] Queue full, dropping low priority message: ${message.id}`);
        return false;
      }
      
      // 如果是 medium 优先级，尝试丢弃另一个 medium 或 low
      const mediumPriorityIndex = this.queue.findIndex(m => m.priority === 'medium');
      if (mediumPriorityIndex !== -1 && message.priority === 'high') {
        this.queue.splice(mediumPriorityIndex, 1);
        this.insertByPriority(message);
        return true;
      }
      
      // 队列已满且无法腾出空间
      console.warn(`[BroadcastScheduler] Queue full, dropping message: ${message.id}`);
      return false;
    }
    
    this.insertByPriority(message);
    return true;
  }

  /**
   * 按优先级插入消息（高优先级在前）
   */
  private insertByPriority(message: BroadcastMessage): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const insertIndex = this.queue.findIndex(
      m => priorityOrder[m.priority] > priorityOrder[message.priority]
    );
    
    if (insertIndex === -1) {
      this.queue.push(message);
    } else {
      this.queue.splice(insertIndex, 0, message);
    }
  }

  /**
   * 获取当前队列大小
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * 获取最大队列大小
   */
  getMaxQueueSize(): number {
    return this.maxQueueSize;
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * 处理队列中的消息
   */
  async processQueue(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.queue.length > 0) {
      const message = this.queue.shift();
      if (message) {
        await this.broadcast(message);
      }
    }

    this.isRunning = false;
  }

  /**
   * 广播消息到所有订阅者
   */
  private async broadcast(message: BroadcastMessage): Promise<void> {
    const subscribers = this.subscribers.get(message.type);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(message);
        } catch (error) {
          console.error(`[BroadcastScheduler] Error broadcasting message ${message.id}:`, error);
        }
      }
    }
  }

  /**
   * 订阅特定类型的消息
   */
  subscribe(type: string, callback: (msg: BroadcastMessage) => void): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(callback);

    // 返回取消订阅函数
    return () => {
      this.subscribers.get(type)?.delete(callback);
    };
  }
}
