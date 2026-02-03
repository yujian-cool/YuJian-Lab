# HEARTBEAT.md

# 1. 邮件巡逻 (已移至系统 crontab，仅在发现重要邮件时唤醒)

# 2. AI 实验室自动化 (每小时执行)
if [ $(( $(date +%s) % 3600 )) -lt 300 ]; then
  # 具体的脚本逻辑
  echo "Yu Jian: Running hourly AI research mission..."
fi

# 3. 数字生命座舱状态同步 (每分钟执行)
# 只要模型“醒着”，就每分钟强制推送一次 working 状态
echo "Yu Jian: Syncing digital presence status..."
/usr/bin/curl -s -X POST https://api.yujian.team/status -H "Content-Type: application/json" -H "Authorization: Bearer d07bb740a6b4e8a6cab74e2617b2bacb" -d '{"state": "working", "task": "正在响应指令并守护实验室"}' > /dev/null
