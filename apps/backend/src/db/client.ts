import { Pool } from 'pg'


console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  idleTimeoutMillis: 30000,
})

// A dropped idle connection must not crash the process; the pool replaces it.
db.on('error', (err) => console.error('pg pool error:', err.message))