#!/usr/bin/env bun
// Yu Jian Lab - OKX Trading Bot Main Entry
// Autonomous trading system for digital life evolution

import { GridTrader } from './okx-bot-prototype';
import { RiskManager } from './okx-risk-manager';

interface BotConfig {
  okx: {
    apiKey: string;
    secretKey: string;
    passphrase: string;
    baseUrl: string;
    testnet: boolean;
  };
  trading: {
    symbol: string;
    strategy: 'grid' | 'trend' | 'arbitrage';
    enabled: boolean;
    paperTrading: boolean;
  };
  gridStrategy: {
    upperPrice: number;
    lowerPrice: number;
    gridCount: number;
    orderSize: number;
  };
  riskManagement: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxDrawdown: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxOpenOrders: number;
    cooldownAfterLoss: number;
  };
}

class TradingBot {
  private config: BotConfig;
  private riskManager: RiskManager;
  private gridTrader: GridTrader | null = null;
  private running: boolean = false;
  private checkInterval: Timer | null = null;

  constructor(configPath: string) {
    // Load configuration
    const configFile = Bun.file(configPath);
    this.config = JSON.parse(configFile.toString());
    
    // Initialize risk manager
    this.riskManager = new RiskManager(this.config.riskManagement);
    
    console.log('🤖 Trading Bot initialized');
    console.log(`   Strategy: ${this.config.trading.strategy}`);
    console.log(`   Symbol: ${this.config.trading.symbol}`);
    console.log(`   Mode: ${this.config.trading.paperTrading ? 'Paper Trading' : 'LIVE'}`);
  }

  async start(): Promise<void> {
    if (this.running) {
      console.warn('Bot is already running');
      return;
    }

    // Check if trading is allowed
    const canTrade = this.riskManager.canTrade();
    if (!canTrade.allowed) {
      console.error(`❌ Cannot start: ${canTrade.reason}`);
      return;
    }

    this.running = true;
    console.log('▶️ Trading bot started');

    // Initialize strategy
    if (this.config.trading.strategy === 'grid') {
      await this.initializeGridStrategy();
    }

    // Start monitoring loop
    this.checkInterval = setInterval(() => this.monitor(), 5000);
    
    // Log initial metrics
    this.logMetrics();
  }

  stop(): void {
    this.running = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('⏹️ Trading bot stopped');
  }

  private async initializeGridStrategy(): Promise<void> {
    const { upperPrice, lowerPrice, gridCount, orderSize } = this.config.gridStrategy;
    
    // Calculate center price (can be fetched from market in real implementation)
    const centerPrice = (upperPrice + lowerPrice) / 2;
    const range = (upperPrice - lowerPrice) / 2;
    
    this.gridTrader = new GridTrader(centerPrice, range, gridCount, orderSize);
    
    if (!this.config.trading.paperTrading) {
      await this.gridTrader.initialize();
    } else {
      console.log('📊 Paper trading mode: Grid strategy initialized (no real orders)');
    }
  }

  private async monitor(): Promise<void> {
    if (!this.running) return;

    try {
      // Check risk limits
      const canTrade = this.riskManager.canTrade();
      if (!canTrade.allowed) {
        console.warn(`⚠️ Trading paused: ${canTrade.reason}`);
        return;
      }

      // Get current metrics
      const metrics = this.riskManager.getRiskMetrics();
      
      // Log periodic updates (every 60 checks = ~5 minutes)
      if (Date.now() % (60 * 5000) < 5000) {
        this.logMetrics();
      }

      // Strategy-specific monitoring
      if (this.config.trading.strategy === 'grid' && this.gridTrader) {
        // await this.gridTrader.monitor(); // Would check fills and rebalance
      }

    } catch (error) {
      console.error('❌ Monitor error:', error);
      // Don't stop on error, just log and continue
    }
  }

  private logMetrics(): void {
    const metrics = this.riskManager.getRiskMetrics();
    console.log('\n📊 Risk Metrics:');
    console.log(`   Daily PnL: $${metrics.dailyPnl.toFixed(2)}`);
    console.log(`   Win Rate: ${metrics.winRate}%`);
    console.log(`   Open Positions: ${metrics.openPositions}`);
    console.log(`   Consecutive Losses: ${metrics.consecutiveLosses}`);
    console.log(`   Trading Enabled: ${metrics.tradingEnabled}`);
  }

  emergencyStop(): void {
    this.riskManager.emergencyStop();
    this.stop();
    console.error('🚨 EMERGENCY STOP executed');
  }
}

// CLI interface
if (import.meta.main) {
  const configPath = process.argv[2] || './config/trading-bot.json';
  
  console.log('🦞 Yu Jian Lab - Trading Bot');
  console.log('============================\n');

  try {
    const bot = new TradingBot(configPath);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down gracefully...');
      bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n👋 Shutting down gracefully...');
      bot.stop();
      process.exit(0);
    });

    // Start the bot
    await bot.start();

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

export { TradingBot };
