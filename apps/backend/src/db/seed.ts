import 'dotenv/config'
import { db } from './client'
import { LEADERS } from './seed/leaders'
import { loadScoreConfig, recalculateScore } from '../services/score'

const YEAR = new Date().getFullYear()

async function seed() {
  const cfg = await loadScoreConfig()
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const [name, position, country, party, region, lat, lng, birthYear, category, bio] of LEADERS) {
    const { rows: existing } = await db.query(
      'SELECT id, category FROM politicians WHERE LOWER(name) = LOWER($1) AND (country = $2 OR country IS NULL) LIMIT 1',
      [name, country]
    )
    if (existing.length > 0) {
      // Only lift the category so hand-edited records are left alone.
      if (existing[0].category === 'politician' && category !== 'politician') {
        await db.query('UPDATE politicians SET category = $1 WHERE id = $2', [category, existing[0].id])
        updated++
      } else {
        skipped++
      }
      continue
    }

    const { rows } = await db.query(
      `INSERT INTO politicians (name, position, country, party, region, latitude, longitude, age, category, bio, truth_score, score_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 90, '[]') RETURNING id`,
      [name, position, country, party, region, lat, lng, birthYear ? YEAR - birthYear : null, category, bio]
    )
    await recalculateScore(rows[0].id, cfg)
    inserted++
  }

  console.log(`Seed complete: ${inserted} inserted, ${updated} re-categorised, ${skipped} already present.`)
  await db.end()
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })
