import 'dotenv/config'
import { db } from './client'
import { hardDeletePost, hardDeleteThread } from '../services/forum'

/**
 * Documented hard-delete path for legal removal. Everything else is soft delete.
 *   npm run forum:hard-delete -- thread <id> "reason"
 *   npm run forum:hard-delete -- post <id> "reason"
 * The full content is written to moderation_log before the row is deleted.
 */
async function main() {
  const [kind, id, ...rest] = process.argv.slice(2)
  const reason = rest.join(' ').trim()
  if (!['thread', 'post'].includes(kind) || !id || !reason) { console.error('usage: npm run forum:hard-delete -- thread|post <id> "reason"'); process.exit(2) }
  const ok = kind === 'thread' ? await hardDeleteThread(id, null, reason) : await hardDeletePost(id, null, reason)
  console.log(ok ? `${kind} ${id} hard-deleted and logged` : `${kind} ${id} not found`)
  await db.end?.()
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
