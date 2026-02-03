import { Elysia, t } from 'elysia'
import { db } from '../db'

// Status routes
let currentStatus = {
  state: 'idle',
  task: '座舱系统就绪',
  updatedAt: new Date().toISOString()
}

const OFFLINE_THRESHOLD_MS = 10 * 60 * 1000
const API_SECRET = process.env.LAB_SECRET

export const statusRoutes = new Elysia({ prefix: '/status' })
  .get('/', () => {
    const lastUpdate = new Date(currentStatus.updatedAt).getTime()
    if (Date.now() - lastUpdate > OFFLINE_THRESHOLD_MS) {
      return { ...currentStatus, state: 'offline' }
    }
    return currentStatus
  })
  .post('/', ({ body, headers, error }) => {
    if (API_SECRET && headers['authorization'] !== `Bearer ${API_SECRET}`) {
      return error(401, 'Unauthorized')
    }
    currentStatus = { ...currentStatus, ...body, updatedAt: new Date().toISOString() }
    return { success: true }
  }, {
    body: t.Object({ state: t.String(), task: t.String() })
  })

// History routes with timezone fix
export const historyRoutes = new Elysia({ prefix: '/history' })
  .get('/', ({ query }) => {
    const limit = parseInt(query.limit || '30')
    const offset = parseInt(query.offset || '0')
    const items = db.query('SELECT * FROM history ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset)
    const total = db.query('SELECT COUNT(*) as count FROM history').get() as { count: number }
    
    // Convert timestamps to ISO format with explicit timezone handling
    const formattedItems = (items as any[]).map(item => ({
      ...item,
      timestamp: new Date(item.timestamp + 'Z').toISOString() // Ensure UTC interpretation
    }))
    
    return { items: formattedItems, total: total.count }
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      offset: t.Optional(t.String())
    })
  })
  .post('/', ({ body, headers, error }) => {
    if (API_SECRET && headers['authorization'] !== `Bearer ${API_SECRET}`) {
      return error(401, 'Unauthorized')
    }
    db.run('INSERT INTO history (content, type) VALUES (?, ?)', [body.content, body.type || 'public'])
    return { success: true }
  }, {
    body: t.Object({ content: t.String(), type: t.Optional(t.String()) })
  })

// Stats routes
export const statsRoutes = new Elysia({ prefix: '/stats' })
  .get('/', () => {
    const totalVisits = db.query('SELECT COUNT(*) as count FROM visits').get() as { count: number }
    const uniqueVisits = db.query('SELECT COUNT(DISTINCT ip_hash) as count FROM visits').get() as { count: number }
    const todayVisits = db.query("SELECT COUNT(*) as count FROM visits WHERE timestamp > date('now')").get() as { count: number }
    
    return {
      total: totalVisits.count,
      unique: uniqueVisits.count,
      today: todayVisits.count
    }
  })
  .post('/visit', ({ request }) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const hash = Bun.hash(ip).toString()
    db.run('INSERT INTO visits (ip_hash) VALUES (?)', [hash])
    return { success: true }
  })
