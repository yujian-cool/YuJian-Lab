// OKX Trading Bot - Risk Management Module
// Part of Yu Jian Lab Trading System

interface RiskConfig {
  maxPositionSize: number;        // 最大仓位 (BTC)
  maxDailyLoss: number;           // 最大日亏损 (USDT)
  maxDrawdown: number;            // 最大回撤比例 (%)
  stopLossPercent: number;        // 止损比例 (%)
  takeProfitPercent: number;      // 止盈比例 (%)
  maxOpenOrders: number;          // 最大挂单数
  cooldownAfterLoss: number;      // 亏损后冷却时间 (分钟)
}

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  timestamp: number;
}

interface DailyStats {
  date: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  maxDrawdown: number;
}

export class RiskManager {
  private config: RiskConfig;
  private positions: Map<string, Position> = new Map();
  private dailyStats: DailyStats;
  private lastTradeTime: number = 0;
  private consecutiveLosses: number = 0;
  private tradingEnabled: boolean = true;
  
  constructor(config: Partial<RiskConfig> = {}) {
    this.config = {
      maxPositionSize: 0.1,         // 0.1 BTC max
      maxDailyLoss: 100,            // $100 max daily loss
      maxDrawdown: 10,              // 10% max drawdown
      stopLossPercent: 2,           // 2% stop loss
      takeProfitPercent: 4,         // 4% take profit (2:1 RR)
      maxOpenOrders: 10,            // Max 10 open orders
      cooldownAfterLoss: 30,        // 30 min cooldown
      ...config
    };
    
    this.dailyStats = this.initDailyStats();
  }
  
  private initDailyStats(): DailyStats {
    return {
      date: new Date().toISOString().split('T')[0],
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnl: 0,
      maxDrawdown: 0
    };
  }
  
  // Check if trading is allowed
  canTrade(): { allowed: boolean; reason?: string } {
    if (!this.tradingEnabled) {
      return { allowed: false, reason: 'Trading manually disabled' };
    }
    
    // Check daily loss limit
    if (this.dailyStats.netPnl <= -this.config.maxDailyLoss) {
      return { allowed: false, reason: `Daily loss limit reached: $${this.config.maxDailyLoss}` };
    }
    
    // Check cooldown after losses
    const now = Date.now();
    if (this.consecutiveLosses >= 3) {
      const cooldownMs = this.config.cooldownAfterLoss * 60 * 1000;
      if (now - this.lastTradeTime < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - this.lastTradeTime)) / 60000);
        return { allowed: false, reason: `Cooldown after losses: ${remaining}min remaining` };
      }
      // Reset consecutive losses after cooldown
      this.consecutiveLosses = 0;
    }
    
    return { allowed: true };
  }
  
  // Validate new order
  validateOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    price: number;
  }): { valid: boolean; reason?: string; adjusted?: any } {
    // Check position size limit
    const currentPosition = this.positions.get(order.symbol);
    const newSize = currentPosition ? currentPosition.size + order.size : order.size;
    
    if (newSize > this.config.maxPositionSize) {
      return {
        valid: false,
        reason: `Position size ${newSize} exceeds limit ${this.config.maxPositionSize}`,
        adjusted: { ...order, size: this.config.maxPositionSize - (currentPosition?.size || 0) }
      };
    }
    
    // Check max open orders
    if (this.positions.size >= this.config.maxOpenOrders) {
      return { valid: false, reason: `Max open orders reached: ${this.config.maxOpenOrders}` };
    }
    
    return { valid: true };
  }
  
  // Calculate stop loss and take profit prices
  calculateExitPrices(entryPrice: number, side: 'long' | 'short'): {
    stopLoss: number;
    takeProfit: number;
  } {
    const slDistance = entryPrice * (this.config.stopLossPercent / 100);
    const tpDistance = entryPrice * (this.config.takeProfitPercent / 100);
    
    if (side === 'long') {
      return {
        stopLoss: entryPrice - slDistance,
        takeProfit: entryPrice + tpDistance
      };
    } else {
      return {
        stopLoss: entryPrice + slDistance,
        takeProfit: entryPrice - tpDistance
      };
    }
  }
  
  // Update position after trade
  updatePosition(trade: {
    symbol: string;
    side: 'buy' | 'sell';
    size: number;
    price: number;
    realizedPnl?: number;
  }): void {
    this.lastTradeTime = Date.now();
    
    const existing = this.positions.get(trade.symbol);
    
    if (trade.side === 'buy') {
      if (existing) {
        // Increase position
        const totalSize = existing.size + trade.size;
        const avgPrice = (existing.size * existing.entryPrice + trade.size * trade.price) / totalSize;
        existing.size = totalSize;
        existing.entryPrice = avgPrice;
      } else {
        // New long position
        this.positions.set(trade.symbol, {
          symbol: trade.symbol,
          side: 'long',
          size: trade.size,
          entryPrice: trade.price,
          unrealizedPnl: 0,
          timestamp: Date.now()
        });
      }
    } else {
      if (existing) {
        // Decrease or close position
        if (trade.size >= existing.size) {
          this.positions.delete(trade.symbol);
        } else {
          existing.size -= trade.size;
        }
      }
    }
    
    // Update daily stats
    if (trade.realizedPnl !== undefined) {
      this.updateDailyStats(trade.realizedPnl);
    }
  }
  
  // Update daily statistics
  private updateDailyStats(pnl: number): void {
    this.dailyStats.totalTrades++;
    
    if (pnl > 0) {
      this.dailyStats.winningTrades++;
      this.dailyStats.grossProfit += pnl;
      this.consecutiveLosses = 0;
    } else {
      this.dailyStats.losingTrades++;
      this.dailyStats.grossLoss += Math.abs(pnl);
      this.consecutiveLosses++;
    }
    
    this.dailyStats.netPnl = this.dailyStats.grossProfit - this.dailyStats.grossLoss;
    
    // Update max drawdown
    if (this.dailyStats.netPnl < -this.dailyStats.maxDrawdown) {
      this.dailyStats.maxDrawdown = Math.abs(this.dailyStats.netPnl);
    }
    
    // Check if we hit daily loss limit
    if (this.dailyStats.netPnl <= -this.config.maxDailyLoss) {
      this.tradingEnabled = false;
      console.warn(`🛑 Daily loss limit reached! Trading disabled for today.`);
    }
  }
  
  // Get current risk metrics
  getRiskMetrics(): {
    dailyPnl: number;
    winRate: number;
    maxDrawdown: number;
    openPositions: number;
    consecutiveLosses: number;
    tradingEnabled: boolean;
  } {
    const winRate = this.dailyStats.totalTrades > 0
      ? (this.dailyStats.winningTrades / this.dailyStats.totalTrades) * 100
      : 0;
    
    return {
      dailyPnl: this.dailyStats.netPnl,
      winRate: Math.round(winRate * 100) / 100,
      maxDrawdown: this.dailyStats.maxDrawdown,
      openPositions: this.positions.size,
      consecutiveLosses: this.consecutiveLosses,
      tradingEnabled: this.tradingEnabled
    };
  }
  
  // Reset daily stats (call at midnight)
  resetDailyStats(): void {
    this.dailyStats = this.initDailyStats();
    this.tradingEnabled = true;
    this.consecutiveLosses = 0;
    console.log('📊 Daily stats reset. Trading enabled.');
  }
  
  // Emergency stop
  emergencyStop(): void {
    this.tradingEnabled = false;
    console.error('🚨 EMERGENCY STOP ACTIVATED. All trading halted.');
  }
  
  // Resume trading (manual override)
  resumeTrading(): void {
    this.tradingEnabled = true;
    console.log('▶️ Trading manually resumed.');
  }
}

// Usage example
if (import.meta.main) {
  const riskManager = new RiskManager({
    maxPositionSize: 0.05,    // Conservative for testing
    maxDailyLoss: 50,         // $50 max loss
    stopLossPercent: 1.5,     // Tight stops
    takeProfitPercent: 3      // 2:1 risk/reward
  });
  
  // Simulate trading
  console.log('Risk Manager initialized');
  console.log('Can trade:', riskManager.canTrade());
  console.log('Risk metrics:', riskManager.getRiskMetrics());
}
