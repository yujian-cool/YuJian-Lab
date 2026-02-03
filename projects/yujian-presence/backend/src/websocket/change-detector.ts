/**
 * Change Detector - 数据变更检测器
 * 负责监听数据库变更并触发实时推送
 */

import type { Database } from 'bun:sqlite';
import type { BroadcastScheduler } from './broadcast-scheduler';
import type {
  SystemStatus,
  SystemStats,
  HealthAlert,
  Change,
  MessagePriority
} from './types';

/**
 * 状态变更检测器配置
 */
interface ChangeDetectorConfig {
  /** 检测间隔 (毫秒, 默认 1000) */
  checkInterval: number;
  /** CPU 使用率告警阈值 (默认 80) */
  cpuThreshold: number;
  /** 内存使用率告警阈值 (默认 80) */
  memoryThreshold: number;
  /** 磁盘使用率告警阈值 (默认 90) */
  diskThreshold: number;
}

/**
 * 数据变更检测器
 * 定期检测系统状态、统计数据的变化并触发广播
 */
export class ChangeDetector {
  /** 上次检测的系统状态 */
  private lastStatus: SystemStatus | null = null;

  /** 上次检测的统计数据 */
  private lastStats: SystemStats | null = null;

  /** 上次检测的健康状态 */
  private lastHealthStatus: Map<string, { value: number; level: string }> = new Map();

  /** 检测定时器 */
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  /** 配置选项 */
  private config: ChangeDetectorConfig;

  /** 系统启动时间 */
  private startTime: number = Date.now();

  /**
   * 创建变更检测器实例
   * @param db 数据库实例
   * @param broadcaster 广播调度器
   * @param config 配置选项
   */
  constructor(
    private db: Database,
    private broadcaster: BroadcastScheduler,
    config: Partial<ChangeDetectorConfig> = {}
  ) {
    this.config = {
      checkInterval: 1000,
      cpuThreshold: 80,
      memoryThreshold: 80,
      diskThreshold: 90,
      ...config
    };
  }

  /**
   * 启动变更检测
   */
  start(): void {
    if (this.checkTimer) return;

    console.log('[ChangeDetector] Starting change detection...');

    // 立即执行一次检测
    this.checkAndBroadcast();

    // 启动定时检测
    this.checkTimer = setInterval(() => {
      this.checkAndBroadcast();
    }, this.config.checkInterval);
  }

  /**
   * 停止变更检测
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log('[ChangeDetector] Stopped change detection');
    }
  }

  /**
   * 执行检测并广播变更
   */
  private async checkAndBroadcast(): Promise<void> {
    try {
      // 检测状态变更
      await this.checkStatusChange();

      // 检测统计变更
      await this.checkStatsChange();

      // 检测健康告警
      await this.checkHealthAlerts();
    } catch (error) {
      console.error('[ChangeDetector] Error during check:', error);
    }
  }

  /**
   * 检测系统状态变更
   */
  private async checkStatusChange(): Promise<void> {
    const currentStatus = this.fetchCurrentStatus();

    if (!currentStatus) return;

    // 首次检测，直接广播
    if (!this.lastStatus) {
      this.broadcaster.broadcast(
        'status',
        'status_update',
        {
          status: currentStatus,
          changes: [{ field: 'all', oldValue: null, newValue: currentStatus }]
        },
        'normal'
      );
      this.lastStatus = currentStatus;
      return;
    }

    // 检测变化
    const changes = this.detectStatusChanges(this.lastStatus, currentStatus);

    if (changes.length > 0) {
      // 计算优先级
      const priority = this.calculateStatusPriority(changes);

      this.broadcaster.broadcast(
        'status',
        'status_update',
        {
          status: currentStatus,
          changes,
          timestamp: Date.now()
        },
        priority
      );
    }

    this.lastStatus = currentStatus;
  }

  /**
   * 获取当前系统状态
   * @returns 系统状态对象
   */
  private fetchCurrentStatus(): SystemStatus | null {
    try {
      // 从数据库获取最新状态或使用当前内存状态
      // 这里使用内存中的状态，实际项目中可能需要查询数据库
      const status: SystemStatus = {
        systemOnline: true,
        cpuUsage: Math.random() * 60 + 20, // 模拟数据 20-80%
        memoryUsage: Math.random() * 50 + 30, // 模拟数据 30-80%
        diskUsage: 65, // 模拟固定值
        activeConnections: this.broadcaster['connectionManager']?.getStats().totalConnections || 0,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: Date.now(),
        version: '2.0.0'
      };

      return status;
    } catch (error) {
      console.error('[ChangeDetector] Failed to fetch status:', error);
      return null;
    }
  }

  /**
   * 检测状态字段变更
   * @param oldStatus 上次状态
   * @param currentStatus 当前状态
   * @returns 变更列表
   */
  private detectStatusChanges(oldStatus: SystemStatus, currentStatus: SystemStatus): Change[] {
    const changes: Change[] = [];
    const fieldsToMonitor: (keyof SystemStatus)[] = [
      'cpuUsage',
      'memoryUsage',
      'diskUsage',
      'activeConnections',
      'systemOnline'
    ];

    for (const field of fieldsToMonitor) {
      const oldValue = oldStatus[field];
      const newValue = currentStatus[field];

      if (oldValue !== newValue) {
        const change: Change = {
          field,
          oldValue,
          newValue
        };

        // 数值类型添加变化量
        if (typeof oldValue === 'number' && typeof newValue === 'number') {
          change.delta = newValue - oldValue;
        }

        changes.push(change);
      }
    }

    return changes;
  }

  /**
   * 计算状态变更的优先级
   * @param changes 变更列表
   * @returns 优先级
   */
  private calculateStatusPriority(changes: Change[]): MessagePriority {
    // 检查是否有关键指标超过阈值
    const criticalFields = ['cpuUsage', 'memoryUsage'];

    const hasCritical = changes.some(c => {
      if (!criticalFields.includes(c.field)) return false;

      const newValue = c.newValue as number;
      const threshold = c.field === 'cpuUsage'
        ? this.config.cpuThreshold
        : this.config.memoryThreshold;

      return newValue > threshold;
    });

    if (hasCritical) return 'high';
    if (changes.length > 3) return 'normal';
    return 'low';
  }

  /**
   * 检测统计数据变更
   */
  private async checkStatsChange(): Promise<void> {
    const currentStats = this.fetchCurrentStats();

    if (!currentStats) return;

    // 首次检测
    if (!this.lastStats) {
      this.broadcaster.broadcast(
        'stats',
        'stats_update',
        { stats: currentStats },
        'normal'
      );
      this.lastStats = currentStats;
      return;
    }

    // 比较关键指标
    const hasSignificantChange =
      Math.abs(currentStats.requests.perSecond - this.lastStats.requests.perSecond) > 5 ||
      currentStats.requests.total !== this.lastStats.requests.total;

    if (hasSignificantChange) {
      this.broadcaster.broadcast(
        'stats',
        'stats_update',
        { stats: currentStats },
        'normal'
      );
    }

    this.lastStats = currentStats;
  }

  /**
   * 获取当前统计数据
   * @returns 统计数据对象
   */
  private fetchCurrentStats(): SystemStats | null {
    try {
      // 从数据库获取统计数据
      const totalVisits = this.db.query('SELECT COUNT(*) as count FROM visits').get() as { count: number };
      const todayVisits = this.db.query(
        "SELECT COUNT(*) as count FROM visits WHERE timestamp > date('now')"
      ).get() as { count: number };

      const stats: SystemStats = {
        period: '1m',
        requests: {
          total: totalVisits.count,
          success: totalVisits.count,
          error: 0,
          perSecond: todayVisits.count / 60 // 模拟计算
        },
        latency: {
          avg: 50,
          p50: 45,
          p95: 120,
          p99: 200
        },
        timestamp: Date.now()
      };

      return stats;
    } catch (error) {
      console.error('[ChangeDetector] Failed to fetch stats:', error);
      return null;
    }
  }

  /**
   * 检测健康告警
   */
  private async checkHealthAlerts(): Promise<void> {
    const currentStatus = this.lastStatus;
    if (!currentStatus) return;

    // 检查各项指标
    const checks = [
      { name: 'cpu', value: currentStatus.cpuUsage, threshold: this.config.cpuThreshold },
      { name: 'memory', value: currentStatus.memoryUsage, threshold: this.config.memoryThreshold },
      { name: 'disk', value: currentStatus.diskUsage, threshold: this.config.diskThreshold }
    ];

    for (const check of checks) {
      const lastStatus = this.lastHealthStatus.get(check.name);
      const currentLevel = this.getAlertLevel(check.value, check.threshold);

      // 状态发生变化
      if (!lastStatus || lastStatus.level !== currentLevel) {
        if (currentLevel !== 'info') {
          // 发送告警
          const alert: HealthAlert = {
            level: currentLevel as 'warning' | 'critical',
            component: check.name,
            message: `${check.name.toUpperCase()} 使用率超过 ${check.threshold}%`,
            threshold: check.threshold,
            currentValue: check.value,
            timestamp: Date.now()
          };

          this.broadcaster.broadcast(
            'health',
            'health_alert',
            { alert },
            currentLevel === 'critical' ? 'high' : 'normal'
          );
        } else if (lastStatus && lastStatus.level !== 'info') {
          // 告警恢复
          this.broadcaster.broadcast(
            'health',
            'health_recovery',
            {
              component: check.name,
              message: `${check.name.toUpperCase()} 使用率恢复正常`,
              timestamp: Date.now()
            },
            'normal'
          );
        }

        this.lastHealthStatus.set(check.name, { value: check.value, level: currentLevel });
      }
    }
  }

  /**
   * 获取告警级别
   * @param value 当前值
   * @param threshold 阈值
   * @returns 告警级别
   */
  private getAlertLevel(value: number, threshold: number): string {
    if (value > threshold + 15) return 'critical';
    if (value > threshold) return 'warning';
    return 'info';
  }

  /**
   * 手动触发状态广播
   * 用于外部调用，如状态更新 API 被调用时
   */
  forceStatusBroadcast(): void {
    this.lastStatus = null; // 重置上次状态，强制重新广播
    this.checkStatusChange();
  }

  /**
   * 手动触发统计广播
   */
  forceStatsBroadcast(): void {
    this.lastStats = null;
    this.checkStatsChange();
  }
}

export default ChangeDetector;
