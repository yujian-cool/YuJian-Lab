/**
 * Vitest 测试配置
 * @author Frontend Engineer
 * @version 1.0.0
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.crypto.randomUUID for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
  },
});

// Mock import.meta.env
(global as unknown as { import: { meta: { env: { DEV: boolean } } } }).import = {
  meta: {
    env: {
      DEV: true,
    },
  },
};

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'https:',
    host: 'lab.yujian.team',
  },
  writable: true,
});

// 清理所有 mock
afterEach(() => {
  vi.clearAllMocks();
});
