import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET')

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})