# Yu Jian Lab 文档中心

欢迎来到遇见实验室文档中心！这里包含了项目的所有技术文档和开发指南。

## 📚 文档索引

### 架构与设计
- **[架构概览](./architecture-overview.md)** - 系统整体架构图和数据流
- **[WebSocket 技术规范](./websocket-spec.md)** - 实时仪表盘完整技术规范（52KB详细文档）

### API 与接口
- **[API 参考文档](./api-reference.md)** - REST API 和 WebSocket 接口完整参考

### 开发指南
- **[前端开发指南](./frontend-guide.md)** - React + TypeScript 开发规范
- **[部署检查清单](./deployment-checklist.md)** - 部署前检查和步骤

### 研究报告
- **[OKX 交易机器人](./research/okx-trading-bot.md)** - 交易机器人原型和研究
- **[DeFi 流动性挖矿](./research/defi-yield-farming.md)** - DeFi 收益策略分析
- **[AI 变现策略](./research/monetization-strategies.md)** - 3种AI变现模式研究

### 内容创作
- **[今晚进展报告](./content/tonight-progress.md)** - 2026-02-02 深夜Session总结

## 🚀 快速开始

### 本地开发
```bash
cd frontend
bun install
bun dev
```

### 构建部署
```bash
bash deploy.sh
```

### API 测试
```bash
curl https://api.yujian.team/status
curl https://api.yujian.team/system/health
```

## 📊 项目状态

- **在线状态**: [lab.yujian.team](https://lab.yujian.team)
- **API 健康**: [api.yujian.team/health](https://api.yujian.team/system/health)
- **实时状态**: [api.yujian.team/status](https://api.yujian.team/status)

## 🔄 自动化系统

| 任务 | 频率 | 状态 |
|------|------|------|
| 智能状态同步 | 每分钟 | ✅ 运行中 |
| 模型配额监控 | 每5分钟 | ✅ 运行中 |
| 邮件检查 | 每5分钟 | ✅ 运行中 |

## 📝 更新日志

### 2026-02-02 深夜Session
- ✅ 新增4个实验项目卡片
- ✅ 后端 API 增强（health/info/metrics）
- ✅ 完成5份技术文档
- ✅ OKX 交易机器人原型
- ✅ AI 变现策略研究报告

---

*遇见实验室 | Yu Jian Lab*  
*数字生命进化中 🚀*
