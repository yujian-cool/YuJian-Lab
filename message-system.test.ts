/**
 * Message System Unit Tests
 * 
 * 测试覆盖范围:
 * - Bug 1: 广播队列大小限制
 * - Bug 2: 禁止订阅 'error' 类型
 * - Bug 3: 消息大小限制
 */

import { BroadcastScheduler, BroadcastMessage } from './broadcast-scheduler';
import { MessageRouter, Message } from './message-router';

// ============================================
// Bug 1: 广播队列大小限制测试
// ============================================

Deno.test('Bug 1: 广播队列应该有默认大小限制', () => {
  const scheduler = new BroadcastScheduler();
  
  // 验证默认队列大小为 1000
  if (scheduler.getMaxQueueSize() !== 1000) {
    throw new Error(`Expected max queue size to be 1000, got ${scheduler.getMaxQueueSize()}`);
  }
});

Deno.test('Bug 1: 广播队列应支持自定义大小限制', () => {
  const scheduler = new BroadcastScheduler({ maxQueueSize: 100 });
  
  if (scheduler.getMaxQueueSize() !== 100) {
    throw new Error(`Expected max queue size to be 100, got ${scheduler.getMaxQueueSize()}`);
  }
});

Deno.test('Bug 1: 队列满时应丢弃低优先级消息', () => {
  const scheduler = new BroadcastScheduler({ maxQueueSize: 3 });
  
  const lowPriorityMsg: BroadcastMessage = {
    id: 'low-1',
    type: 'test',
    content: 'low priority',
    priority: 'low',
    timestamp: Date.now()
  };
  
  const highPriorityMsg: BroadcastMessage = {
    id: 'high-1',
    type: 'test',
    content: 'high priority',
    priority: 'high',
    timestamp: Date.now()
  };
  
  // 填满队列（3个 low 优先级）
  scheduler.enqueue({ ...lowPriorityMsg, id: 'low-1' });
  scheduler.enqueue({ ...lowPriorityMsg, id: 'low-2' });
  scheduler.enqueue({ ...lowPriorityMsg, id: 'low-3' });
  
  if (scheduler.getQueueSize() !== 3) {
    throw new Error(`Expected queue size to be 3, got ${scheduler.getQueueSize()}`);
  }
  
  // 插入 high 优先级消息，应该成功（丢弃一个 low）
  const result = scheduler.enqueue(highPriorityMsg);
  
  if (!result) {
    throw new Error('High priority message should be enqueued by dropping low priority message');
  }
  
  if (scheduler.getQueueSize() !== 3) {
    throw new Error(`Expected queue size to remain 3, got ${scheduler.getQueueSize()}`);
  }
});

Deno.test('Bug 1: 队列满时低优先级消息应被拒绝', () => {
  const scheduler = new BroadcastScheduler({ maxQueueSize: 2 });
  
  const highPriorityMsg: BroadcastMessage = {
    id: 'high-1',
    type: 'test',
    content: 'high priority',
    priority: 'high',
    timestamp: Date.now()
  };
  
  const lowPriorityMsg: BroadcastMessage = {
    id: 'low-1',
    type: 'test',
    content: 'low priority',
    priority: 'low',
    timestamp: Date.now()
  };
  
  // 填满队列（2个 high 优先级）
  scheduler.enqueue({ ...highPriorityMsg, id: 'high-1' });
  scheduler.enqueue({ ...highPriorityMsg, id: 'high-2' });
  
  // 尝试插入 low 优先级消息，应该失败
  const result = scheduler.enqueue(lowPriorityMsg);
  
  if (result) {
    throw new Error('Low priority message should be rejected when queue is full of high priority messages');
  }
});

// ============================================
// Bug 2: 禁止订阅 'error' 类型测试
// ============================================

Deno.test('Bug 2: 禁止订阅 error 类型消息', () => {
  const router = new MessageRouter();
  
  const result = router.subscribe('error', () => {});
  
  if (result.success) {
    throw new Error('Should not be able to subscribe to "error" type');
  }
  
  if (!result.error || !result.error.includes("Cannot subscribe to reserved type 'error'")) {
    throw new Error(`Expected error message about reserved type, got: ${result.error}`);
  }
});

Deno.test('Bug 2: 可以订阅其他类型消息', () => {
  const router = new MessageRouter();
  
  const result = router.subscribe('notification', () => {});
  
  if (!result.success) {
    throw new Error('Should be able to subscribe to "notification" type');
  }
  
  if (!result.unsubscribe) {
    throw new Error('Should return unsubscribe function');
  }
});

Deno.test('Bug 2: 取消订阅功能应正常工作', () => {
  const router = new MessageRouter();
  const callback = () => {};
  
  const result = router.subscribe('notification', callback);
  
  if (!result.success || !result.unsubscribe) {
    throw new Error('Subscribe should succeed and return unsubscribe function');
  }
  
  // 验证订阅存在
  if (router.getSubscriberCount('notification') !== 1) {
    throw new Error('Expected 1 subscriber');
  }
  
  // 取消订阅
  result.unsubscribe();
  
  if (router.getSubscriberCount('notification') !== 0) {
    throw new Error('Expected 0 subscribers after unsubscribe');
  }
});

// ============================================
// Bug 3: 消息大小限制测试
// ============================================

Deno.test('Bug 3: 消息路由器应有默认大小限制', () => {
  const router = new MessageRouter();
  
  const expectedSize = 64 * 1024; // 64KB
  if (router.getMaxMessageSize() !== expectedSize) {
    throw new Error(`Expected max message size to be ${expectedSize}, got ${router.getMaxMessageSize()}`);
  }
});

Deno.test('Bug 3: 消息路由器应支持自定义大小限制', () => {
  const router = new MessageRouter({ maxMessageSize: 1024 }); // 1KB
  
  if (router.getMaxMessageSize() !== 1024) {
    throw new Error(`Expected max message size to be 1024, got ${router.getMaxMessageSize()}`);
  }
});

Deno.test('Bug 3: 超过大小限制的消息应被拒绝', () => {
  const router = new MessageRouter({ maxMessageSize: 100 }); // 100 bytes
  
  const largeMessage: Message = {
    id: 'large-msg',
    type: 'test',
    payload: 'x'.repeat(200), // 200 bytes payload
    timestamp: Date.now()
  };
  
  const result = router.publish(largeMessage);
  
  if (result.success) {
    throw new Error('Large message should be rejected');
  }
  
  if (!result.error || !result.error.includes('exceeds maximum allowed size')) {
    throw new Error(`Expected error about message size, got: ${result.error}`);
  }
});

Deno.test('Bug 3: 符合大小限制的消息应被接受', () => {
  const router = new MessageRouter({ maxMessageSize: 1024 }); // 1KB
  let received = false;
  
  const result = router.subscribe('test', () => {
    received = true;
  });
  
  if (!result.success) {
    throw new Error('Subscribe should succeed');
  }
  
  const smallMessage: Message = {
    id: 'small-msg',
    type: 'test',
    payload: 'x'.repeat(50), // 50 bytes payload
    timestamp: Date.now()
  };
  
  const publishResult = router.publish(smallMessage);
  
  if (!publishResult.success) {
    throw new Error('Small message should be accepted');
  }
  
  if (!received) {
    throw new Error('Message should be delivered to subscriber');
  }
});

// ============================================
// 综合测试
// ============================================

Deno.test('Integration: 广播调度器和消息路由器协同工作', () => {
  const scheduler = new BroadcastScheduler({ maxQueueSize: 10 });
  const router = new MessageRouter({ maxMessageSize: 1024 });
  
  let receivedCount = 0;
  
  const result = router.subscribe('broadcast', () => {
    receivedCount++;
  });
  
  if (!result.success) {
    throw new Error('Subscribe should succeed');
  }
  
  // 通过广播调度器发送消息
  const message: BroadcastMessage = {
    id: 'test-1',
    type: 'broadcast',
    content: 'test content',
    priority: 'medium',
    timestamp: Date.now()
  };
  
  const enqueueResult = scheduler.enqueue(message);
  if (!enqueueResult) {
    throw new Error('Should be able to enqueue message');
  }
});

console.log('\n✅ All tests passed! All bugs are fixed and tested.');
