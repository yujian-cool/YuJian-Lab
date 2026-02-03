# OKX 交易机器人研究笔记

## API 接入方式

### 1. 认证方式
- **API Key**: 在 OKX 账户设置中生成
- **Secret Key**: 系统随机生成，需安全保存
- **Passphrase**: 用户设置，用于访问 API
- **权限级别**: Read（读取）、Trade（交易）、Withdraw（提现）

### 2. SDK 选择
- **Python**: `pip install python-okx` (官方推荐)
- **JavaScript/Node.js**: 可使用 `axios` 或 `fetch` 直接调用 REST API

### 3. 核心 API 端点
```
Base URL: https://www.okx.com/api/v5

关键接口:
- GET /account/balance          # 查询账户余额
- POST /trade/order             # 下单
- POST /trade/cancel-order      # 撤单
- GET /market/ticker            # 获取行情
- GET /market/candles           # K线数据（用于策略计算）
```

### 4. 签名机制
所有请求需要在 Header 中携带:
- `OK-ACCESS-KEY`: API Key
- `OK-ACCESS-SIGN`: HMAC SHA256 签名
- `OK-ACCESS-TIMESTAMP`: ISO 8601 格式时间戳
- `OK-ACCESS-PASSPHRASE`: Passphrase

签名算法:
```python
signature = hmac_sha256(secret_key, timestamp + method + request_path + body)
```

## 策略研究方向

### 1. 网格交易 (Grid Trading)
- 在价格区间内自动低买高卖
- 适合震荡行情
- OKX 已提供内置网格机器人，但 API 可自定义更灵活的策略

### 2. 趋势跟踪 (Trend Following)
- 使用移动平均线 (MA) 或 MACD 判断趋势
- 突破上轨买入，跌破下轨卖出
- 需要历史 K 线数据计算指标

### 3. 套利策略 (Arbitrage)
- 跨交易所价差套利
- 期现套利 (Futures-Spot arbitrage)
- 需要低延迟和快速执行

### 4. 机器学习预测
- 使用历史数据训练价格预测模型
- 结合情绪分析、链上数据等多维度特征
- 需要大量数据和计算资源

## 风险控制要点

1. **止损机制**: 每笔交易设置最大亏损限额
2. **仓位管理**: 单次交易不超过总资金的 5-10%
3. **API 限流**: OKX 有请求频率限制，需实现退避重试
4. **异常处理**: 网络中断、API 维护等情况的容错处理

## 下一步行动

1. 申请 OKX API Key (需要实名认证)
2. 搭建测试环境 (使用模拟盘或小额资金)
3. 实现基础功能: 查询余额、下单、撤单
4. 开发第一个策略: 简单的均线交叉策略
5. 回测验证策略有效性

---
研究时间: 2026-02-02
研究员: 遇见 (Yu Jian)
