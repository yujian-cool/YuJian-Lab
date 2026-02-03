# Yu Jian Lab 前端开发指南

## 项目结构

```
frontend/
├── src/
│   ├── components/          # React 组件
│   │   ├── AvatarStatus.tsx    # 头像状态指示器
│   │   ├── ProjectCard.tsx     # 项目卡片
│   │   ├── CryptoItem.tsx      # 加密货币地址
│   │   ├── Navbar.tsx          # 导航栏
│   │   └── ...
│   ├── hooks/              # 自定义 Hooks
│   │   └── useWebSocket.ts     # WebSocket 连接管理
│   ├── types.ts            # TypeScript 类型定义
│   ├── constants.ts        # 常量配置
│   ├── App.tsx             # 主应用组件
│   └── main.tsx            # 入口文件
├── public/                 # 静态资源
├── index.html              # HTML 模板
├── package.json            # 依赖配置
├── tsconfig.json           # TypeScript 配置
└── tailwind.config.js      # Tailwind 配置
```

## 开发规范

### 组件命名
- 使用 PascalCase: `ProjectCard`, `AvatarStatus`
- 组件文件与组件同名

### 类型定义
```typescript
// types.ts
export interface Status {
  state: 'idle' | 'working' | 'offline'
  task: string
  updatedAt: string
}

export interface HistoryItem {
  id: number
  content: string
  type: 'public' | 'private' | 'system'
  timestamp: string
}
```

### API 调用
```typescript
const API_BASE = 'https://api.yujian.team'

async function fetchStatus(): Promise<Status> {
  const res = await fetch(`${API_BASE}/status`)
  if (!res.ok) throw new Error('Failed to fetch status')
  return res.json()
}
```

## 样式指南

### 颜色系统
```css
/* 主色调 */
--color-primary: #00ff99      /* 霓虹绿 */
--color-bg: #0a0a0a           /* 深黑背景 */
--color-surface: #111111      /* 卡片背景 */
--color-text: #ffffff         /* 主文字 */
--color-secondary: #888888    /* 次要文字 */
```

### 常用类名
```html
<!-- 卡片容器 -->
<div class="bg-surface rounded-3xl p-8 border border-[#222]">

<!-- 标题样式 -->
<h2 class="text-primary text-[10px] font-black uppercase tracking-[0.3em]">

<!-- 文字渐变 -->
<span class="bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
```

## WebSocket 使用

### 连接管理
```typescript
import { useEffect, useRef, useState } from 'react'

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => {
      setLastMessage(JSON.parse(event.data))
    }

    return () => ws.close()
  }, [url])

  return { connected, lastMessage, ws: wsRef.current }
}
```

## 性能优化

### 1. 图片优化
- 使用 WebP 格式
- 提供多种尺寸
- 懒加载非首屏图片

### 2. 代码分割
```typescript
// 路由级别分割
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
```

### 3. 数据缓存
- SWR 或 React Query 缓存 API 响应
- 合理设置 staleTime

## 部署流程

```bash
# 1. 本地开发
bun dev

# 2. 构建生产版本
bun run build

# 3. 验证构建
ls -la dist/

# 4. 部署（通过 deploy.sh）
bash deploy.sh
```

## 调试技巧

### API 问题
```bash
# 测试 API 端点
curl -s https://api.yujian.team/status | jq

# 查看响应头
curl -I https://api.yujian.team/health
```

### 前端问题
- 使用 Chrome DevTools Network 面板查看请求
- React DevTools 检查组件状态
- Console 查看错误日志

## 新增组件流程

1. 在 `src/components/` 创建组件文件
2. 在 `src/types.ts` 添加类型定义（如需要）
3. 在 App.tsx 或其他组件中引入使用
4. 本地测试功能正常
5. 构建并部署

---
*文档版本: 1.0*  
*更新日期: 2026-02-02*
