import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNotifications, getUnreadCount, markAllRead, markRead, clearNotifications } from '../api/politicians'
import { timeAgo } from '../lib/format'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const { data: countData } = useQuery({ queryKey: ['unread-count'], queryFn: getUnreadCount, refetchInterval: 30000 })
  const { data: notifications } = useQuery({ queryKey: ['notifications'], queryFn: getNotifications, enabled: open })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }
  const markAllMutation = useMutation({ mutationFn: markAllRead, onSuccess: invalidate })
  const markOneMutation = useMutation({ mutationFn: markRead, onSuccess: invalidate })
  const clearMutation = useMutation({ mutationFn: clearNotifications, onSuccess: invalidate })

  const unread = countData?.count || 0

  const handleClick = (n: any) => {
    markOneMutation.mutate(n.id)
    setOpen(false)
    if (n.link) navigate(n.link.replace('/politicians/', '/leaders/'))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        style={{ background: 'rgba(10,10,10,0.85)', border: '1px solid var(--border-strong)', padding: '0.45rem', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={unread > 0 ? '#c9a84c' : '#8a857b'} strokeWidth="1.6" strokeLinecap="square">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="mono" style={{ position: 'absolute', top: -6, right: -6, background: 'var(--blood)', color: '#f3e4e4', minWidth: 16, height: 16, padding: '0 4px', fontSize: '0.58rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '2.4rem', right: 0, width: 320, maxWidth: 'calc(100vw - 1.5rem)', background: 'var(--surface)', border: '1px solid var(--border-strong)', zIndex: 1000 }}>
          <div className="row row--between" style={{ padding: '0.65rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
            <span className="eyebrow">Signals {unread > 0 && <span style={{ color: 'var(--gold)' }}>({unread})</span>}</span>
            <div className="row" style={{ gap: '0.75rem' }}>
              {unread > 0 && <button className="btn btn--ghost btn--sm" onClick={() => markAllMutation.mutate()}>Mark read</button>}
              {notifications?.length > 0 && <button className="btn btn--ghost btn--sm" onClick={() => clearMutation.mutate()}>Clear</button>}
            </div>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {!notifications?.length && <p className="dim small" style={{ padding: '1.5rem', textAlign: 'center' }}>No signals.</p>}
            {notifications?.map((n: any) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{ padding: '0.7rem 0.9rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.read ? 'none' : 'var(--gold-soft)', display: 'grid', gridTemplateColumns: '8px 1fr', gap: '0.6rem', alignItems: 'start' }}
              >
                <span style={{ width: 6, height: 6, marginTop: 7, background: n.read ? 'var(--border-strong)' : 'var(--gold)' }} />
                <div>
                  <p style={{ fontSize: '0.82rem', color: n.read ? 'var(--muted)' : 'var(--text)', lineHeight: 1.4 }}>{n.message}</p>
                  <p className="mono tiny dim" style={{ marginTop: '0.2rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
