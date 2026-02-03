export interface Status {
  state: 'idle' | 'working' | 'offline'
  task: string
  updatedAt: string
}

export interface HistoryItem {
  id: number
  content: string
  type: 'public' | 'private'
  timestamp: string
}

export interface Stats {
  total: number
  unique: number
  today: number
}
