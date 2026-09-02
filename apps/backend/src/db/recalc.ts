import 'dotenv/config'
import { db } from './client'
import { loadScoreConfig, recalculateScore } from '../services/score'

async function run() {
  const cfg = await loadScoreConfig()
  const { rows } = await db.query('SELECT id FROM politicians')
  let changed = 0
  for (const r of rows) {
    const res = await recalculateScore(r.id, cfg)
    if (res?.changed) changed++
  }
  console.log(`Recalculated ${rows.length} leaders, ${changed} changed.`)
  await db.end()
}

run().catch(err => { console.error(err); process.exit(1) })
