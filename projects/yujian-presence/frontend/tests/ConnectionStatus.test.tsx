/**
 * ConnectionStatus 组件单元测试
 * @author Frontend Engineer
 * @version 1.0.0
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectionStatus, { 
  ConnectionStatusBar, 
  ConnectionStatusCard 
} from '../src/components/ConnectionStatus';
import type { ConnectionState } from '../src/types/websocket';

describe('ConnectionStatus', () => {
  describe('连接状态显示', () => {
    it('应该显示已连接状态', () => {
      render(<ConnectionStatus connectionState="connected" />);
      
      expect(screen.getByText('已连接')).toBeInTheDocument();
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'WebSocket 连接状态: 已连接');
    });

    it('应该显示连接中状态', () => {
      render(<ConnectionStatus connectionState="connecting" />);
      
      expect(screen.getByText('连接中')).toBeInTheDocument();
      expect(screen.getByText('◐')).toBeInTheDocument();
    });

    it('应该显示重连中状态', () => {
      render(<ConnectionStatus connectionState="reconnecting" />);
      
      expect(screen.getByText('重连中')).toBeInTheDocument();
      expect(screen.getByText('◑')).toBeInTheDocument();
    });

    it('应该显示已断开状态', () => {
      render(<ConnectionStatus connectionState="disconnected" />);
      
      expect(screen.getByText('已断开')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument();
    });
  });

  describe('重连次数显示', () => {
    it('应该显示重连次数', () => {
      render(
        <ConnectionStatus 
          connectionState="reconnecting" 
          showReconnectAttempts={true}
          reconnectAttempts={3}
        />
      );
      
      expect(screen.getByText('(重试 3)')).toBeInTheDocument();
    });

    it('不应该在 showReconnectAttempts=false 时显示重连次数', () => {
      render(
        <ConnectionStatus 
          connectionState="reconnecting" 
          showReconnectAttempts={false}
          reconnectAttempts={3}
        />
      );
      
      expect(screen.queryByText('(重试 3)')).not.toBeInTheDocument();
    });

    it('当 showReconnectAttempts=true 但 reconnectAttempts=0 时不应显示', () => {
      render(
        <ConnectionStatus 
          connectionState="reconnecting" 
          showReconnectAttempts={true}
          reconnectAttempts={0}
        />
      );
      
      // 有 reconnectAttempts 条件判断，0 时不显示
      expect(screen.queryByText(/重试/)).not.toBeInTheDocument();
    });
  });

  describe('文本显示控制', () => {
    it('应该根据 showText 控制文本显示', () => {
      const { container } = render(
        <ConnectionStatus connectionState="connected" showText={false} />
      );
      
      expect(screen.queryByText('已连接')).not.toBeInTheDocument();
      // 状态指示灯和图标应该仍然显示
      expect(container.querySelector('.w-2')).toBeInTheDocument();
    });
  });

  describe('点击事件', () => {
    it('应该触发点击事件', () => {
      const onClick = vi.fn();
      render(<ConnectionStatus connectionState="connected" onClick={onClick} />);
      
      const element = screen.getByRole('status');
      fireEvent.click(element);
      
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('样式类名', () => {
    it('应该接受自定义 className', () => {
      const { container } = render(
        <ConnectionStatus 
          connectionState="connected" 
          className="custom-class"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('无障碍支持', () => {
    it('应该包含正确的 aria 属性', () => {
      render(<ConnectionStatus connectionState="connected" />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-label', expect.stringContaining('WebSocket'));
    });

    it('应该包含标题提示', () => {
      render(<ConnectionStatus connectionState="connected" />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('title', expect.stringContaining('同步'));
    });
  });
});

describe('ConnectionStatusBar', () => {
  it('应该显示连接状态和额外信息', () => {
    render(<ConnectionStatusBar connectionState="reconnecting" reconnectAttempts={2} />);
    
    expect(screen.getByText('重连中')).toBeInTheDocument();
    expect(screen.getByText('正在恢复实时数据...')).toBeInTheDocument();
  });

  it('应该在断开时显示警告', () => {
    render(<ConnectionStatusBar connectionState="disconnected" />);
    
    expect(screen.getByText('已断开')).toBeInTheDocument();
    expect(screen.getByText('数据可能不是最新的')).toBeInTheDocument();
  });

  it('应该在连接时正常显示', () => {
    render(<ConnectionStatusBar connectionState="connected" />);
    
    expect(screen.getByText('已连接')).toBeInTheDocument();
    expect(screen.queryByText('正在恢复实时数据...')).not.toBeInTheDocument();
    expect(screen.queryByText('数据可能不是最新的')).not.toBeInTheDocument();
  });
});

describe('ConnectionStatusCard', () => {
  it('应该显示详细的连接状态卡片', () => {
    render(
      <ConnectionStatusCard 
        connectionState="reconnecting" 
        reconnectAttempts={3}
      />
    );
    
    expect(screen.getByText('重连中')).toBeInTheDocument();
    expect(screen.getByText(/第 3 次重连尝试/)).toBeInTheDocument();
  });

  it('应该在连接成功时不显示重连信息', () => {
    render(<ConnectionStatusCard connectionState="connected" />);
    
    expect(screen.getByText('已连接')).toBeInTheDocument();
    expect(screen.queryByText(/重连/)).not.toBeInTheDocument();
  });
});
