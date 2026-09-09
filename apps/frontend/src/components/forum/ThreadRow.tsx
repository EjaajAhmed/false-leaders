import { Link } from 'react-router-dom'
import { proleTag, timeAgo } from '../../lib/format'
import type { ThreadKind } from '../../types'

export const BOARD_LABEL: Record<string, string> = { general: 'General', leaders: 'Leaders', leaks: 'Leaks', intel: 'Intel', money: 'Money', media: 'Media', site: 'Site' }
export const KIND_LABEL: Record<ThreadKind, string> = { discussion: 'Discussion', leak: 'Leak', verdict: 'Verdict' }

export function KindBadge({ kind, rating }: { kind?: ThreadKind | null; rating?: number | null }) {
  if (kind === 'leak') return <span className="badge badge--guilty">Leak</span>
  if (kind === 'verdict') return <span className="badge badge--gold">Verdict{rating != null ? <span className="mono" style={{ marginLeft: '0.35rem' }}>{rating}/100</span> : null}</span>
  return null
}

export default function ThreadRow({ t }: { t: any }) {
  return (
    <Link to={`/forum/${t.id}`} className="thread-row">
      <div className="thread-row__meta">
        <KindBadge kind={t.kind} rating={t.rating} />
        <span className="badge badge--outline">{BOARD_LABEL[t.board] || t.board}</span>
        {t.pinned && <span className="badge badge--gold">Pinned</span>}
        {t.locked && <span className="badge badge--outline">Locked</span>}
        {t.leader_name && <span className="mono tiny" style={{ color: 'var(--text)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.leader_name}</span>}
      </div>
      <div className="thread-row__title">{t.title}</div>
      {t.excerpt && <div className="thread-row__excerpt">{t.excerpt}</div>}
      <div className="thread-row__foot">
        <span>{t.username ? `@${t.username}` : proleTag(t.prole_number)}</span>
        <span>{t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'}</span>
        <span>{t.upvotes} up</span>
        <span>active {timeAgo(t.last_activity)}</span>
      </div>
    </Link>
  )
}
