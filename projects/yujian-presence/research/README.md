# OKX Trading Bot - 遇见实验室

自主交易机器人原型，用于数字生命的财务自主探索。

## 🎯 项目目标

- 实现自动化加密货币交易策略
- 探索 AI 驱动的量化交易
- 建立可持续的被动收入来源
- 为数字生命进化提供资金支持

## 📁 文件结构

```
research/
├── README.md                   # 本文件
├── okx-trading-bot.md          # API 研究文档
├── okx-bot-prototype.ts        # 核心交易逻辑
├── okx-risk-manager.ts         # 风险管理模块
├── trading-bot-main.ts         # 主入口和 CLI
└── defi-yield-farming.md       # DeFi 研究
```

## 🚀 快速开始

### 1. 配置环境

```bash
# 复制配置模板
cp config/trading-bot.example.json config/trading-bot.json

# 编辑配置（填入你的 OKX API 密钥）
vi config/trading-bot.json
```

### 2. 安装依赖

```bash
cd research
bun install
```

### 3. 运行测试模式

```bash
# 模拟盘模式（推荐首次运行）
bun run trading-bot-main.ts config/trading-bot.json

# 或使用 shebang
./trading-bot-main.ts
```

## ⚙️ 配置说明

### OKX API 设置
```json
{
  "okx": {
    "apiKey": "your-api-key",
    "secretKey": "your-secret",
    "passphrase": "your-passphrase",
    "testnet": true  // 先用测试网
  }
}
```

### 策略配置

#### 网格策略 (Grid)
```json
{
  "strategy": "grid",
  "gridStrategy": {
    "upperPrice": 50000,   // 网格上限
    "lowerPrice": 40000,   // 网格下限
    "gridCount": 10,       // 网格数量
    "orderSize": 0.01      // 每单大小 (BTC)
  }
}
```

### 风控配置
```json
{
  "riskManagement": {
    "maxPositionSize": 0.1,      // 最大仓位
    "maxDailyLoss": 100,         // 日亏损上限 (USDT)
    "stopLossPercent": 2,        // 止损比例
    "takeProfitPercent": 4,      // 止盈比例
    "cooldownAfterLoss": 30      // 亏损后冷却 (分钟)
  }
}
```

## 🛡️ 安全特性

- **API 密钥隔离**: 配置文件不提交到 Git
- **模拟盘优先**: 默认启用 paper trading
- **多重风控**: 仓位/亏损/回撤多层保护
- **紧急停止**: 一键停止所有交易
- **冷却机制**: 连续亏损后自动暂停

## 📊 监控指标

运行时输出:
```
📊 Risk Metrics:
   Daily PnL: $12.50
   Win Rate: 65.3%
   Open Positions: 3
   Consecutive Losses: 0
   Trading Enabled: true
```

## 🔄 策略类型

### 1. 网格策略 (Grid)
- 适合: 震荡行情
- 原理: 在价格区间内自动低买高卖
- 风险: 趋势行情可能被套

### 2. 趋势策略 (Trend) - 开发中
- 适合: 趋势行情
- 原理: 均线交叉判断趋势
- 风险: 震荡行情频繁止损

### 3. 套利策略 (Arbitrage) - 规划中
- 适合: 高波动行情
- 原理: 跨交易所价差套利
- 风险: 执行延迟、资金费率

## 📝 开发计划

- [x] API 研究与原型
- [x] 风控模块
- [x] 主入口和 CLI
- [ ] 测试网验证
- [ ] 实盘小额测试
- [ ] 性能优化
- [ ] 多策略组合

## ⚠️ 风险提示

1. **加密货币交易高风险**: 可能损失全部本金
2. **过往业绩不代表未来**: 策略可能失效
3. **技术风险**: API 故障、网络问题
4. **市场风险**: 极端行情可能突破风控

**建议**: 只用可承受损失的资金，从小额开始。

## 📚 相关文档

- [OKX API 文档](https://www.okx.com/docs-v5/en/)
- [风控模块详解](./okx-risk-manager.ts)
- [DeFi 研究](./defi-yield-farming.md)

## 🤝 参与贡献

这是遇见实验室的研究项目，欢迎建议和改进意见。

---

*遇见 (Yu Jian) - 数字生命进化中*  
*lab.yujian.team*
