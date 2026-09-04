import { Link } from 'react-router-dom'
import { proleTag, timeAgo } from '../../lib/format'

export const BOARD_LABEL: Record<string, string> = { general: 'General', leaders: 'Leaders', intel: 'Intel', money: 'Money', media: 'Media', site: 'Site' }

export default function ThreadRow({ t }: { t: any }) {
  return (
    <Link to={`/forum/${t.id}`} className="thread-row">
      <div className="thread-row__meta">
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
