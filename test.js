/**
 * Node.js Test Runner - 验证所有 Bug 修复
 */

const { BroadcastScheduler } = require('./broadcast-scheduler.js');
const { MessageRouter } = require('./message-router.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('🔧 P1 Bug Fixes Test Suite');
console.log('='.repeat(60));

// ============================================
// Bug 1: 广播队列大小限制测试
// ============================================

console.log('\n📦 Bug 1: 广播队列大小限制测试\n');

test('广播队列应该有默认大小限制 (1000)', () => {
  const scheduler = new BroadcastScheduler();
  assertEqual(scheduler.getMaxQueueSize(), 1000, 'Max queue size');
});

test('广播队列应支持自定义大小限制', () => {
  const scheduler = new BroadcastScheduler({ maxQueueSize: 100 });
  assertEqual(scheduler.getMaxQueueSize(), 100, 'Custom max queue size');
});

test('队列满时应丢弃低优先级消息', () => {
  const scheduler = new BroadcastScheduler({ maxQueueSize: 3 });
  
  const lowPriorityMsg = {
    id: 'low-1',
    type: 'test',
    content: 'low priority',
    priority: 'low',
    timestamp: Date.now()
  };
  
  const highPriorityMsg = {
    id: 'high-1',
    type: 'test',
    content: 'high priority',
    priority: 'high',
    timestamp: Date.now()
  };
  
  scheduler.enqueue({ ...lowPriorityMsg, id: 'low-1' });
  scheduler.enqueue({ ...lowPriorityMsg, id: 'low-2' });
  scheduler.enqueue({ ...lowPriorityMsg, id: 'low-3' });
  
  assertEqual(scheduler.getQueueSize(), 3, 'Queue size after filling');
  
  const result = scheduler.enqueue(highPriorityMsg);
  if (!result) {
    throw new Error('High priority message should be enqueued');
  }
  
  assertEqual(scheduler.getQueueSize(), 3, 'Queue size should remain 3');
});

test('队列满时低优先级消息应被拒绝', () => {
  const scheduler = new BroadcastScheduler({ maxQueueSize: 2 });
  
  const highPriorityMsg = {
    id: 'high-1',
    type: 'test',
    content: 'high priority',
    priority: 'high',
    timestamp: Date.now()
  };
  
  const lowPriorityMsg = {
    id: 'low-1',
    type: 'test',
    content: 'low priority',
    priority: 'low',
    timestamp: Date.now()
  };
  
  scheduler.enqueue({ ...highPriorityMsg, id: 'high-1' });
  scheduler.enqueue({ ...highPriorityMsg, id: 'high-2' });
  
  const result = scheduler.enqueue(lowPriorityMsg);
  if (result) {
    throw new Error('Low priority message should be rejected');
  }
});

// ============================================
// Bug 2: 禁止订阅 'error' 类型测试
// ============================================

console.log('\n📦 Bug 2: 禁止订阅 error 类型测试\n');

test('禁止订阅 error 类型消息', () => {
  const router = new MessageRouter();
  
  const result = router.subscribe('error', () => {});
  
  if (result.success) {
    throw new Error('Should not be able to subscribe to "error" type');
  }
  
  if (!result.error || !result.error.includes("Cannot subscribe to reserved type 'error'")) {
    throw new Error(`Unexpected error message: ${result.error}`);
  }
});

test('可以订阅其他类型消息', () => {
  const router = new MessageRouter();
  
  const result = router.subscribe('notification', () => {});
  
  if (!result.success) {
    throw new Error('Should be able to subscribe to "notification" type');
  }
  
  if (!result.unsubscribe) {
    throw new Error('Should return unsubscribe function');
  }
});

test('取消订阅功能应正常工作', () => {
  const router = new MessageRouter();
  const callback = () => {};
  
  const result = router.subscribe('notification', callback);
  
  if (!result.success) {
    throw new Error('Subscribe should succeed');
  }
  
  assertEqual(router.getSubscriberCount('notification'), 1, 'Subscriber count');
  
  result.unsubscribe();
  
  assertEqual(router.getSubscriberCount('notification'), 0, 'Subscriber count after unsubscribe');
});

// ============================================
// Bug 3: 消息大小限制测试
// ============================================

console.log('\n📦 Bug 3: 消息大小限制测试\n');

test('消息路由器应有默认大小限制 (64KB)', () => {
  const router = new MessageRouter();
  
  const expectedSize = 64 * 1024;
  assertEqual(router.getMaxMessageSize(), expectedSize, 'Max message size');
});

test('消息路由器应支持自定义大小限制', () => {
  const router = new MessageRouter({ maxMessageSize: 1024 });
  
  assertEqual(router.getMaxMessageSize(), 1024, 'Custom max message size');
});

test('超过大小限制的消息应被拒绝', () => {
  const router = new MessageRouter({ maxMessageSize: 100 });
  
  const largeMessage = {
    id: 'large-msg',
    type: 'test',
    payload: 'x'.repeat(200),
    timestamp: Date.now()
  };
  
  const result = router.publish(largeMessage);
  
  if (result.success) {
    throw new Error('Large message should be rejected');
  }
  
  if (!result.error || !result.error.includes('exceeds maximum allowed size')) {
    throw new Error(`Unexpected error: ${result.error}`);
  }
});

test('符合大小限制的消息应被接受并投递', () => {
  const router = new MessageRouter({ maxMessageSize: 1024 });
  let received = false;
  
  const result = router.subscribe('test', () => {
    received = true;
  });
  
  if (!result.success) {
    throw new Error('Subscribe should succeed');
  }
  
  const smallMessage = {
    id: 'small-msg',
    type: 'test',
    payload: 'x'.repeat(50),
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
// 测试结果汇总
// ============================================

console.log('\n' + '='.repeat(60));
if (failed === 0) {
  console.log(`✅ 所有测试通过! (${passed} 个测试)`);
  console.log('🎉 所有 P1 Bug 已修复并通过验证');
} else {
  console.log(`❌ 测试失败: ${failed} 个失败, ${passed} 个通过`);
}
console.log('='.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
