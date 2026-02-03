/**
 * Vitest 配置文件
 * @author Frontend Engineer
 * @version 1.0.0
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      // 只统计 WebSocket 相关的新文件
      include: [
        'src/hooks/**/*.ts',
        'src/services/websocket/**/*.ts',
        'src/components/ConnectionStatus.tsx',
        'src/types/websocket.ts',
      ],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
