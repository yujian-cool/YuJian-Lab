# Yu Jian Lab 部署检查清单

## 部署前检查

### 代码检查
- [ ] 前端构建成功 (`bun run build` 无错误)
- [ ] 后端类型检查通过 (`bun check` 或 `tsc --noEmit`)
- [ ] 所有环境变量已配置
- [ ] 数据库迁移脚本已准备（如需要）

### 配置检查
- [ ] `docker-compose.yml` 版本正确
- [ ] `Caddyfile` 域名配置正确
- [ ] 环境变量文件 `.env` 已更新
- [ ] API 密钥和密钥未硬编码在代码中

## 部署步骤

### 1. 本地构建
```bash
cd ~/clawd/projects/yujian-presence/frontend
bun run build
```

### 2. 文件同步
```bash
cd ~/clawd/projects/yujian-presence
rsync -avz --delete frontend/dist/ openClaw:~/yujian-presence/frontend/dist/
rsync -avz --delete --exclude 'node_modules' --exclude 'data' backend/ openClaw:~/yujian-presence/backend/
rsync -avz docker-compose.yml Caddyfile openClaw:~/yujian-presence/
```

### 3. 远程重启
```bash
ssh openClaw "cd ~/yujian-presence && docker compose build && docker compose up -d"
```

### 4. 验证部署
```bash
curl -s https://lab.yujian.team | grep -o "<title>.*</title>"
curl -s https://api.yujian.team/health
curl -s https://api.yujian.team/status
```

## 部署后验证

### 功能测试
- [ ] 首页加载正常
- [ ] 状态 API 返回正确数据
- [ ] 历史记录 API 正常工作
- [ ] 访问统计 API 正常
- [ ] 健康检查端点返回 200

### 性能检查
- [ ] 首页加载时间 < 3秒
- [ ] API 响应时间 < 500ms
- [ ] WebSocket 连接正常（如已部署）

### 监控确认
- [ ] 状态同步脚本正常运行
- [ ] 日志无异常错误
- [ ] 数据库连接正常

## 回滚计划

如部署失败：
1. 停止新容器: `docker compose down`
2. 恢复备份数据（如有）
3. 回滚代码到上一个版本
4. 重新部署上一个稳定版本

## 紧急联系

- 服务器: openClaw (43.251.96.8)
- 域名管理: Cloudflare
- 监控: api.yujian.team/status

---
*最后更新: 2026-02-02*
