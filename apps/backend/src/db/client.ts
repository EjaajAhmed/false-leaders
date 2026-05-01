import { Pool } from 'pg'


console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})