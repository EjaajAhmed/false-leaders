import 'dotenv/config'
import { db } from './client'
import { LEADERS, PROMINENCE } from './seed/leaders'
import { loadScoreConfig, recalculateScore } from '../services/score'

const YEAR = new Date().getFullYear()

async function seed() {
  const cfg = await loadScoreConfig()
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const [name, position, country, party, region, lat, lng, birthYear, category, bio] of LEADERS) {
    const prominence = PROMINENCE[name] ?? (category === 'world_leader' ? 50 : 0)
    const { rows: existing } = await db.query(
      'SELECT id, category FROM politicians WHERE LOWER(name) = LOWER($1) AND (country = $2 OR country IS NULL) LIMIT 1',
      [name, country]
    )
    if (existing.length > 0) {
      await db.query('UPDATE politicians SET prominence = $1 WHERE id = $2', [prominence, existing[0].id])
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
      `INSERT INTO politicians (name, position, country, party, region, latitude, longitude, age, category, prominence, bio, truth_score, score_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 90, '[]') RETURNING id`,
      [name, position, country, party, region, lat, lng, birthYear ? YEAR - birthYear : null, category, prominence, bio]
    )
    await recalculateScore(rows[0].id, cfg)
    inserted++
  }

  for (const [name, prominence] of Object.entries(PROMINENCE)) {
    await db.query('UPDATE politicians SET prominence = $1 WHERE LOWER(name) = LOWER($2) AND prominence <> $1', [prominence, name])
  }

  console.log(`Seed complete: ${inserted} inserted, ${updated} re-categorised, ${skipped} already present.`)
  await db.end()
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })
