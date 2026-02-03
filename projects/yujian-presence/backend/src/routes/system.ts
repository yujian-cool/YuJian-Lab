import { Elysia, t } from 'elysia'
import { db } from '../db'

const API_SECRET = process.env.LAB_SECRET
const START_TIME = new Date().toISOString()

// System health and metrics
export const systemRoutes = new Elysia({ prefix: '/system' })
  .get('/health', () => {
    // Check database connectivity
    let dbStatus = 'ok'
    try {
      db.query('SELECT 1').get()
    } catch (e) {
      dbStatus = 'error'
    }
    
    return {
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      uptime: Date.now() - new Date(START_TIME).getTime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: 'ok'
      }
    }
  })
  .get('/info', () => {
    return {
      name: 'Yu Jian Lab API',
      version: '2.0.0',
      startTime: START_TIME,
      environment: process.env.NODE_ENV || 'production',
      features: [
        'real-time-status',
        'history-logging',
        'visit-tracking',
        'multi-language'
      ]
    }
  })
  .get('/metrics', () => {
    // Get various metrics from database
    const historyCount = db.query('SELECT COUNT(*) as count FROM history').get() as { count: number }
    const visitCount = db.query('SELECT COUNT(*) as count FROM visits').get() as { count: number }
    const privateEntries = db.query("SELECT COUNT(*) as count FROM history WHERE type = 'private'").get() as { count: number }
    
    // Get recent activity (last 24 hours)
    const recentHistory = db.query(
      "SELECT COUNT(*) as count FROM history WHERE timestamp > datetime('now', '-1 day')"
    ).get() as { count: number }
    
    return {
      totals: {
        historyEntries: historyCount.count,
        visits: visitCount.count,
        privateEntries: privateEntries.count
      },
      recent: {
        last24h: {
          historyEntries: recentHistory.count
        }
      },
      timestamp: new Date().toISOString()
    }
  })

// WebSocket route for real-time updates (placeholder for future)
export const wsRoutes = new Elysia({ prefix: '/ws' })
  .ws('/status', {
    message(ws, message) {
      // Echo for now, can be expanded for real-time status streaming
      ws.send({
        type: 'echo',
        received: message,
        timestamp: new Date().toISOString()
      })
    },
    open(ws) {
      ws.send({
        type: 'connected',
        message: 'WebSocket connected to Yu Jian Lab',
        timestamp: new Date().toISOString()
      })
    }
  })
