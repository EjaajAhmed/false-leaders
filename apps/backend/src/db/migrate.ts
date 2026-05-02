import fs from 'fs'
import path from 'path'
import { db } from './client'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir).sort()

  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      run_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  for (const file of files) {
    const { rows } = await db.query('SELECT name FROM migrations WHERE name = $1', [file])
    if (rows.length > 0) {
      console.log(`Skipping ${file} — already run`)
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    await db.query(sql)
    await db.query('INSERT INTO migrations (name) VALUES ($1)', [file])
    console.log(`Ran migration: ${file}`)
  }

  await db.end()
  console.log('All migrations complete')
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})