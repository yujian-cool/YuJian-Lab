/**
 * Message Router - 消息路由器
 * 
 * Bug 2 修复说明:
 * - 问题: 可以订阅 'error' 类型消息，不符合预期
 * - 修复: 禁止订阅 'error' 类型，返回错误提示
 * - 原因: error 类型消息是系统内部错误通知，不应被外部订阅
 * 
 * Bug 3 修复说明:
 * - 问题: 消息大小无限制，存在安全隐患
 * - 修复: 添加 maxMessageSize 检查 (64KB)
 * - 原因: 防止超大消息导致内存问题和网络拥塞
 */

class MessageRouter {
  // Bug 3 修复: 默认最大消息大小为 64KB
  static DEFAULT_MAX_MESSAGE_SIZE = 64 * 1024;
  
  // Bug 2 修复: 定义禁止订阅的消息类型列表
  static RESERVED_TYPES = ['error'];
  
  constructor(options = {}) {
    // Bug 3 修复: 使用传入值或默认值设置消息大小限制
    this.maxMessageSize = options.maxMessageSize ?? MessageRouter.DEFAULT_MAX_MESSAGE_SIZE;
    this.subscribers = new Map();
  }

  /**
   * 订阅特定类型的消息
   * Bug 2 修复: 禁止订阅 'error' 类型消息
   */
  subscribe(type, callback) {
    // Bug 2 修复: 检查是否为保留类型（禁止订阅）
    if (MessageRouter.RESERVED_TYPES.includes(type)) {
      return {
        success: false,
        error: `Cannot subscribe to reserved type '${type}'. This type is reserved for system internal use.`
      };
    }

    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type).add(callback);

    return {
      success: true,
      unsubscribe: () => {
        this.subscribers.get(type)?.delete(callback);
      }
    };
  }

  /**
   * 发布消息
   * Bug 3 修复: 检查消息大小，超过限制则拒绝
   */
  publish(message) {
    // Bug 3 修复: 检查消息大小
    const messageSize = this.calculateMessageSize(message);
    if (messageSize > this.maxMessageSize) {
      return {
        success: false,
        error: `Message size (${messageSize} bytes) exceeds maximum allowed size (${this.maxMessageSize} bytes). Please reduce message payload.`
      };
    }

    const subscribers = this.subscribers.get(message.type);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(message);
        } catch (error) {
          console.error(`[MessageRouter] Error delivering message ${message.id}:`, error);
        }
      }
    }

    return { success: true };
  }

  /**
   * 计算消息大小（序列化后字节数）
   * Bug 3 修复: 用于检查消息大小限制
     */
  calculateMessageSize(message) {
    try {
      const serialized = JSON.stringify(message);
      // 计算 UTF-8 字节数
      return Buffer.byteLength(serialized, 'utf8');
    } catch (error) {
      console.error('[MessageRouter] Failed to calculate message size:', error);
      return Infinity;
    }
  }

  getMaxMessageSize() {
    return this.maxMessageSize;
  }

  getSubscriberCount(type) {
    return this.subscribers.get(type)?.size ?? 0;
  }

  /**
   * 发布错误消息（系统内部使用）
   * Bug 2 修复: error 类型只能由系统内部发布，不能被订阅
   */
  publishError(error, context) {
    const errorMessage = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'error',
      payload: {
        message: error.message,
        stack: error.stack,
        context
      },
      timestamp: Date.now()
    };

    console.error('[MessageRouter] System error:', errorMessage);
  }
}

module.exports = { MessageRouter };
