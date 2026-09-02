import { Link } from 'react-router-dom'
import type { FeedEvent } from '../types'
import { feedText, timeAgo } from '../lib/format'
import { Empty } from './States'

export function FeedItem({ event }: { event: FeedEvent }) {
  const t = feedText(event)
  const name = event.leader_name || 'Unknown'
  return (
    <div className={`feed-item feed-item--${event.type}`}>
      <div className="feed-item__time" title={new Date(event.created_at).toLocaleString()}>{timeAgo(event.created_at)}</div>
      <div className="feed-item__body">
        {t.before}
        {event.leader_id ? <Link to={`/leaders/${event.leader_id}`}>{name}</Link> : <span>{name}</span>}
        {t.after}
        {t.detail && <span className={`${t.deltaClass || 'mono'} small`} style={{ marginLeft: '0.5rem' }}>{t.detail}</span>}
        <div className="feed-item__type">{t.label}</div>
      </div>
    </div>
  )
}

export default function FeedList({ events, emptyText = 'Nothing has moved. Yet.' }: { events: FeedEvent[]; emptyText?: string }) {
  if (!events.length) return <Empty text={emptyText} sub="The Wall is quiet" />
  return (
    <div className="feed">
      {events.map(e => <FeedItem key={e.id} event={e} />)}
    </div>
  )
}
