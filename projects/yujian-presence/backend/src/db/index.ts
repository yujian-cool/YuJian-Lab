import { Database } from 'bun:sqlite'

export const db = new Database('./data/presence.db')

export const initDb = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT,
      type TEXT DEFAULT 'public',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}
