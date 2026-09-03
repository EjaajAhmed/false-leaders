import 'dotenv/config'
import { db } from './client'

// Merge duplicate leader rows by exact name: keep the oldest, move child rows to it, delete the rest.
;(async () => {
  const { rows: groups } = await db.query(
    `SELECT name, array_agg(id::text ORDER BY created_at ASC) ids FROM politicians GROUP BY name HAVING COUNT(*) > 1`
  )
  for (const g of groups) {
    const [keep, ...drop] = g.ids as string[]
    for (const id of drop) {
      for (const t of ['comments', 'votes', 'bookmarks', 'verdicts', 'leaks', 'controversies', 'funding_sources', 'foreign_influence', 'controversy_proposals', 'feed_events', 'score_events']) {
        const col = t === 'feed_events' ? 'leader_id' : 'politician_id'
        await db.query(`UPDATE ${t} SET ${col} = $1 WHERE ${col} = $2`, [keep, id]).catch(() => undefined)
      }
      await db.query('DELETE FROM politicians WHERE id = $1', [id])
      console.log(`merged ${g.name}: ${id} -> ${keep}`)
    }
  }
  await db.end()
})()
