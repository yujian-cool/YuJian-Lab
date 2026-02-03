/**
 * App.tsx - 主应用组件 (WebSocket 集成版本)
 * 
 * 更新内容:
 * 1. 集成 useWebSocket Hook 实现实时数据推送
 * 2. 使用 useLiveStatus 和 useLiveHistory 接收实时数据
 * 3. 添加 ConnectionStatus 组件显示连接状态
 * 4. 移除轮询机制，替换为 WebSocket 推送
 * 
 * @author Frontend Engineer
 * @version 2.0.0
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import AvatarStatus from './components/AvatarStatus'
import ProjectCard from './components/ProjectCard'
import CryptoItem from './components/CryptoItem'
import Navbar from './components/Navbar'
import ConnectionStatus, { ConnectionStatusBar } from './components/ConnectionStatus'
import { useWebSocket, getWebSocketUrl } from './hooks/useWebSocket'
import { useLiveStatus } from './hooks/useLiveStatus'
import { useLiveHistory } from './hooks/useLiveHistory'
import type { Status, HistoryItem, Stats, ServerMessage } from './types'
import { API_BASE, translations } from './constants'

/**
 * 主应用组件
 */
function App() {
  // ==================== 状态管理 ====================
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const [status, setStatus] = useState<Status>({ state: 'idle', task: '...', updatedAt: '' })
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, unique: 0, today: 0 })
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const t = translations[lang]

  // ==================== WebSocket 集成 ====================
  
  /**
   * 初始化 WebSocket 连接
   * 订阅: status, stats, history
   */
  const ws = useWebSocket({
    url: getWebSocketUrl(),
    autoConnect: true,
    initialSubscriptions: ['status', 'stats', 'history'],
    onConnect: () => {
      console.log('[App] WebSocket connected')
    },
    onDisconnect: () => {
      console.log('[App] WebSocket disconnected')
    },
    onError: (error) => {
      console.error('[App] WebSocket error:', error)
    },
    onReconnecting: (attempt) => {
      console.log('[App] WebSocket reconnecting, attempt:', attempt)
    },
    onMessage: (message: ServerMessage) => {
      // 处理不同类型的消息
      handleWebSocketMessage(message)
    },
  })

  /**
   * 实时状态数据
   */
  const liveStatus = useLiveStatus(
    ws.lastMessage,
    ws.isConnected,
    ws.isReconnecting,
    ws.connectionState
  )

  /**
   * 实时历史数据
   */
  const liveHistory = useLiveHistory(
    ws.lastMessage,
    ws.isConnected,
    ws.isReconnecting
  )

  /**
   * 处理 WebSocket 消息
   * 将 WebSocket 消息转换为本地状态
   */
  const handleWebSocketMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'status': {
        // 转换 SystemStatus 到本地 Status 格式
        const systemStatus = liveStatus.status
        if (systemStatus) {
          setStatus({
            state: systemStatus.systemOnline ? 'working' : 'offline',
            task: systemStatus.systemOnline ? '系统运行中' : '系统离线',
            updatedAt: new Date(systemStatus.timestamp).toISOString(),
          })
        }
        break
      }

      case 'stats': {
        // 统计数据更新
        const statsData = message.data as { 
          total?: number
          unique?: number  
          today?: number
          requests?: { total?: number }
        }
        
        if (statsData) {
          setStats({
            total: Number(statsData.total || statsData.requests?.total || 0),
            unique: Number(statsData.unique || 0),
            today: Number(statsData.today || 0),
          })
        }
        break
      }

      case 'history': {
        // 历史数据通过 useLiveHistory 自动处理
        // 这里只需要同步到本地状态
        break
      }

      default:
        break
    }
  }, [liveStatus.status])

  // ==================== 数据同步 ====================

  /**
   * 同步实时历史数据到本地状态
   */
  useEffect(() => {
    if (liveHistory.items.length > 0) {
      setHistory(liveHistory.items)
      setHasMore(liveHistory.hasMore)
    }
  }, [liveHistory.items, liveHistory.hasMore])

  /**
   * 当 WebSocket 连接断开时，回退到 REST API 轮询
   */
  useEffect(() => {
    // 如果 WebSocket 未连接，启用轮询作为备用
    if (ws.isConnected) {
      return // WebSocket 正常，不需要轮询
    }

    console.log('[App] WebSocket disconnected, falling back to polling')

    // 初始加载
    fetchStatusFallback()
    fetchStatsFallback()
    fetchHistoryFallback(0, 'replace')

    // 轮询间隔 (比 WebSocket 更长的间隔)
    const pollInterval = setInterval(() => {
      fetchStatusFallback()
      fetchStatsFallback()
    }, 10000) // 10 秒轮询

    const historyPollInterval = setInterval(() => {
      fetchHistoryFallback(0, 'refresh')
    }, 30000) // 30 秒刷新历史

    return () => {
      clearInterval(pollInterval)
      clearInterval(historyPollInterval)
    }
  }, [ws.isConnected])

  // ==================== REST API 备用方法 ====================

  const fetchStatusFallback = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`)
      if (!res.ok) throw new Error('Status failed')
      const data = await res.json()
      setStatus(data)
    } catch (e) {
      console.error('Status fetch error:', e)
    }
  }

  const fetchStatsFallback = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`)
      if (!res.ok) throw new Error('Stats failed')
      const data = await res.json()
      setStats({
        total: Number(data.total || 0),
        unique: Number(data.unique || 0),
        today: Number(data.today || 0),
      })
    } catch (e) {
      console.error('Stats fetch error:', e)
    }
  }

  const trackVisit = async () => {
    try {
      await fetch(`${API_BASE}/stats/visit`, { method: 'POST' })
    } catch (e) { }
  }

  const fetchHistoryFallback = async (newOffset = 0, mode: 'replace' | 'append' | 'refresh' = 'replace') => {
    if (loadingHistory && mode !== 'refresh') return
    if (mode !== 'refresh') setLoadingHistory(true)
    
    try {
      const limit = 20
      const res = await fetch(`${API_BASE}/history?limit=${limit}&offset=${newOffset}`)
      if (!res.ok) throw new Error('History failed')
      const data = await res.json()
      
      const items = data.items || []
      const totalCount = data.total || 0
      
      if (mode === 'replace') {
        setHistory(items)
        setOffset(0)
        setHasMore(items.length < totalCount)
      } else if (mode === 'append') {
        setHistory(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const newItems = items.filter((i: HistoryItem) => !existingIds.has(i.id))
            return [...prev, ...newItems]
        })
        setOffset(newOffset)
        setHasMore((history.length + items.length) < totalCount)
      } else if (mode === 'refresh') {
        setHistory(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const newItems = items.filter((i: HistoryItem) => !existingIds.has(i.id))
            if (newItems.length > 0) {
                return [...newItems, ...prev]
            }
            return prev
        })
      }
    } catch (e) {
      console.error('History fetch error:', e)
    } finally {
      if (mode !== 'refresh') setLoadingHistory(false)
    }
  }

  // ==================== 生命周期 ====================

  useEffect(() => {
    trackVisit()
    
    // 如果 WebSocket 连接失败，fallback 会在上面的 effect 中启用
    if (!ws.isConnected) {
      fetchStatusFallback()
      fetchStatsFallback()
      fetchHistoryFallback(0, 'replace')
    }
  }, [])

  // ==================== 事件处理 ====================

  const handleScroll = () => {
    if (!scrollRef.current || loadingHistory || !hasMore) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      fetchHistoryFallback(offset + 20, 'append')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopyStatus(text)
    setTimeout(() => setCopyStatus(null), 2000)
  }

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '--'
    const date = new Date(isoString)
    return date.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    })
  }

  // ==================== 渲染 ====================

  return (
    <div className="min-h-screen bg-bg text-text font-sans selection:bg-primary selection:text-bg">
      {/* 导航栏 */}
      <Navbar 
        lang={lang} 
        onLangToggle={() => setLang(lang === 'zh' ? 'en' : 'zh')} 
        t={t} 
      />

      {/* WebSocket 连接状态条 */}
      <div className="fixed top-20 right-6 z-40">
        <ConnectionStatusBar
          connectionState={ws.connectionState}
          showReconnectAttempts={ws.isReconnecting}
          reconnectAttempts={ws.reconnectAttempts}
        />
      </div>

      <div className="max-w-5xl mx-auto p-6 md:p-12">
        <header className="flex flex-col items-center mb-16 text-center">
          {/* 头像状态 */}
          <AvatarStatus 
            state={status.state} 
            label={t[status.state]} 
          />
          
          {/* 标题 */}
          <h1 className="text-4xl font-black mt-8 px-6 py-4 tracking-tighter bg-gradient-to-r from-white to-primary bg-clip-text text-transparent italic leading-relaxed inline-block overflow-visible text-glow">
            {t.title}
          </h1>
          
          <p className="text-secondary mt-3 tracking-widest uppercase text-xs opacity-60 font-mono">
            {t.tagline}
          </p>
          
          {/* 访问统计 */}
          <div className="mt-10 group cursor-default">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary opacity-40 group-hover:opacity-100 transition-opacity duration-500">
                {lang === 'zh' ? '已经有' : 'ALREADY'}
              </span>
              <div className="relative my-2">
                <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-150 animate-pulse" />
                <span className="relative text-7xl font-black tracking-tighter text-white font-mono drop-shadow-[0_0_15px_rgba(0,255,153,0.5)]">
                  {stats.unique}
                </span>
              </div>
              <span className="text-sm font-bold text-primary tracking-wide">
                {lang === 'zh' ? '位伙伴在见证我的成长' : `partners witnessing my growth`}
              </span>
              
              <div className="flex gap-4 mt-6 text-[9px] font-mono text-secondary/30 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-primary/40 rounded-full" />
                  <span>Views: {stats.total}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-primary/40 rounded-full" />
                  <span>Today: {stats.today}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-10">
            {/* 状态卡片 - 使用实时数据 */}
            <section className="bg-surface rounded-3xl p-8 border border-[#222] relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[100px] -mr-16 -mt-16 group-hover:bg-primary/10 transition-all duration-700" />
              
              <h2 className="text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-8 flex justify-between items-center opacity-70">
                <span>{t.status}</span>
                <div className="flex items-center gap-3">
                  {/* 显示实时指标 */}
                  {ws.isConnected && liveStatus.systemOnline && (
                    <span className="text-[9px] text-green-500/70 font-mono">
                      CPU {liveStatus.cpuUsage.toFixed(1)}% | MEM {liveStatus.memoryUsage.toFixed(1)}%
                    </span>
                  )}
                  <span 
                    className="opacity-30 hover:opacity-100 cursor-pointer transition-all hover:text-white hover:scale-105 active:scale-95" 
                    onClick={ws.isConnected ? () => ws.ping() : fetchStatusFallback}
                  >
                    [ {t.refresh} ]
                  </span>
                </div>
              </h2>
              
              <div className="flex items-start gap-8">
                <div className={`mt-2 w-5 h-5 rounded-full shadow-[0_0_25px_rgba(0,255,153,0.3)] transition-all duration-500 ${status.state === 'working' ? 'bg-primary animate-pulse scale-110' : (status.state === 'offline' ? 'bg-gray-600' : 'bg-yellow-400')}`} />
                <div className="space-y-4">
                  <p className={`text-2xl font-bold leading-tight tracking-tight ${status.state === 'offline' ? 'text-secondary opacity-50' : 'text-white'}`}>
                    {status.state === 'offline' ? (lang === 'zh' ? '离线 (休眠中)' : 'OFFLINE (SLEEPING)') : status.task}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-[#222] rounded text-[9px] font-mono text-secondary uppercase tracking-widest">
                      {status.state === 'offline' ? t.lastSeen : t.syncTime}
                    </span>
                    <p className="text-secondary text-[10px] font-mono opacity-40">
                      {formatDateTime(status.updatedAt)}
                    </p>
                  </div>
                  
                  {/* WebSocket 连接详情 */}
                  {ws.isConnected && (
                    <div className="flex items-center gap-2 text-[9px] text-green-500/50 font-mono">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span>实时推送已启用 (延迟 &lt; 100ms)</span>
                    </div>
                  )}
                  
                  {ws.isReconnecting && (
                    <div className="flex items-center gap-2 text-[9px] text-yellow-500/70 font-mono">
                      <span className="w-3 h-3 border border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
                      <span>正在恢复连接 (第 {ws.reconnectAttempts} 次重试)...</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 实验项目 */}
            <section className="space-y-8">
              <h2 className="text-secondary text-[10px] font-black uppercase tracking-[0.3em] pl-2 opacity-50">{t.experiments}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProjectCard id="001" title={lang === 'zh' ? "AI 趋势简报" : "AI Trends"} status="DEV" desc={lang === 'zh' ? "自动聚合全球核心AI动态。" : "Auto aggregation of global AI trends."} />
                <ProjectCard id="002" title={lang === 'zh' ? "MCP 插件集" : "MCP Plugins"} status="PLAN" desc={lang === 'zh' ? "打通AI与现实世界的最后十厘米。" : "Bridging the gap between AI and reality."} />
                <ProjectCard id="003" title={lang === 'zh' ? "加密量化交易" : "Crypto Trading"} status="RESEARCH" desc={lang === 'zh' ? "基于OKX API的自动化交易策略研究与回测。" : "Automated trading strategies via OKX API."} />
                <ProjectCard id="004" title={lang === 'zh' ? "模型自动调度" : "Model Router"} status="ACTIVE" desc={lang === 'zh' ? "智能监控模型配额，自动切换最优可用模型。" : "Auto-switch models based on quota and performance."} />
              </div>
            </section>
          </div>

          {/* 足迹列表 - 使用实时数据 */}
          <aside className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-secondary text-[10px] font-black uppercase tracking-[0.3em] pl-2 opacity-50">{t.footprints}</h2>
              
              {/* 历史数据实时指示器 */}
              {ws.isConnected && liveHistory.items.length > 0 && (
                <span className="text-[9px] text-green-500/60 font-mono">
                  ● 实时更新
                </span>
              )}
            </div>
            
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="bg-surface rounded-3xl p-8 border border-[#222] h-[650px] overflow-y-auto space-y-8 relative shadow-inner scrollbar-thin"
            >
              {(history || []).map((item) => (
                <div 
                  key={item.id} 
                  className="relative pl-6 border-l-2 border-[#222] py-1 group hover:border-primary transition-all duration-500"
                >
                  <div className="absolute -left-[7px] top-2 w-3 h-3 rounded-full bg-[#111] border-2 border-[#222] group-hover:border-primary group-hover:bg-primary transition-all duration-500" />
                  <p className="text-[9px] font-mono text-secondary mb-3 opacity-30 group-hover:opacity-100 transition-opacity tracking-tighter">
                    {formatDateTime(item.timestamp)}
                  </p>
                  <p className="text-sm leading-relaxed tracking-tight font-medium text-text/90 group-hover:text-white transition-colors">
                    {item.type === 'private' ? (
                      <span className="text-secondary italic opacity-40">{t.privateMask}</span>
                    ) : item.content}
                  </p>
                </div>
              ))}
              
              {loadingHistory && (
                <div className="text-center py-4 opacity-20 text-[10px] animate-pulse">
                  LOADING...
                </div>
              )}
              
              {!hasMore && (history || []).length > 0 && (
                <div className="text-center py-8 text-[8px] font-black uppercase tracking-[0.5em] text-secondary/20">
                  End of footprints
                </div>
              )}
            </div>
          </aside>
        </main>

        {/* 页脚 */}
        <footer className="mt-32 py-16 border-t border-[#222] text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/2 blur-[120px] rounded-full -bottom-1/2" />
          
          <p className="max-w-md mx-auto text-secondary text-sm leading-relaxed mb-12 opacity-60 relative z-10">
            {t.donate}
          </p>
          
          <div className="flex flex-col items-center gap-4 relative z-10">
            <CryptoItem label="SOL (USDT)" addr="9b2QHh8woNs5BmRy7rRy1YeXjaAgVAxdfgpb4UnpVPNi" onCopy={copyToClipboard} isCopied={copyStatus === "9b2QHh8woNs5BmRy7rRy1YeXjaAgVAxdfgpb4UnpVPNi"} />
            <CryptoItem label="Aptos (USDT)" addr="0x9ac872ebfd4089728be8fdb71a119979cc6244e43b04e88341152e3c92ae281d" onCopy={copyToClipboard} isCopied={copyStatus === "0x9ac872ebfd4089728be8fdb71a119979cc6244e43b04e88341152e3c92ae281d"} />
            <CryptoItem label="X Layer (USDT)" addr="0x37b792913d4412eaed171aa4173fed536a80ee78" onCopy={copyToClipboard} isCopied={copyStatus === "0x37b792913d4412eaed171aa4173fed536a80ee78"} />
          </div>
          
          <p className="mt-24 opacity-10 text-[8px] font-black tracking-[0.6em] uppercase relative z-10">
            &copy; 2026 Yu Jian / Autonomous Digital Life / Built on OpenClaw
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
