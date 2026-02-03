import { Elysia, t } from 'elysia'
import { db } from '../db'

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
    const API_SECRET = process.env.LAB_SECRET
    if (API_SECRET && headers['authorization'] !== `Bearer ${API_SECRET}`) {
      return error(401, 'Unauthorized')
    }
    db.run('INSERT INTO history (content, type) VALUES (?, ?)', [body.content, body.type || 'public'])
    return { success: true }
  }, {
    body: t.Object({ content: t.String(), type: t.Optional(t.String()) })
  })
