import 'dotenv/config'
import { db } from './client'
import { enrichLeader } from '../services/enrich'

// Usage: npm run enrich            (only rows never enriched)
//        npm run enrich -- --all   (re-run everything, keeps existing wiki titles)
//        npm run enrich -- --force (re-match titles too)
async function run() {
  const args = process.argv.slice(2)
  const all = args.includes('--all') || args.includes('--force')
  const force = args.includes('--force')
  const { rows } = await db.query(
    `SELECT id, name FROM politicians ${all ? '' : 'WHERE enriched_at IS NULL'} ORDER BY prominence DESC, name ASC`
  )
  let matched = 0
  let missed = 0
  for (const [i, r] of rows.entries()) {
    const res = await enrichLeader(r.id, { force })
    if (res.matched) matched++; else missed++
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${rows.length} · matched ${matched} · missed ${missed}`)
    await new Promise(t => setTimeout(t, 150))
  }
  console.log(`Enrichment complete: ${matched} matched, ${missed} without a Wikipedia page.`)
  await db.end()
}

run().catch(err => { console.error(err); process.exit(1) })
