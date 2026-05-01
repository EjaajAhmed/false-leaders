import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNotifications, getUnreadCount, markAllRead, markRead, clearNotifications } from '../api/politicians'

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

  const { data: countData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30000
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    enabled: open
  })

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const markOneMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const clearMutation = useMutation({
    mutationFn: clearNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const unread = countData?.count || 0

  const handleNotificationClick = (n: any) => {
    markOneMutation.mutate(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.4rem',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: '#c0392b',
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '2.5rem',
          right: 'auto',
          left: '-280px',
          width: '300px',
          background: '#242424',
          border: '1px solid #333',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #333' }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem', color: '#fff' }}>
              Notifications {unread > 0 && <span style={{ color: '#c9a84c' }}>({unread})</span>}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {unread > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Mark all read
                </button>
              )}
              {notifications?.length > 0 && (
                <button
                  onClick={() => clearMutation.mutate()}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {!notifications?.length && (
              <p style={{ padding: '1.5rem', textAlign: 'center', color: '#888', fontSize: '0.85rem', margin: 0 }}>
                No notifications yet
              </p>
            )}
            {notifications?.map((n: any) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #2a2a2a',
                  cursor: 'pointer',
                  background: n.read ? 'none' : 'rgba(201,168,76,0.06)',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: '0.1rem' }}>
                      {n.type === 'comment_reply' ? '💬' : '📋'}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: n.read ? '#888' : '#ddd', lineHeight: '1.4' }}>
                      {n.message}
                    </p>
                  </div>
                  {!n.read && (
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#c9a84c', flexShrink: 0, marginTop: '0.3rem' }} />
                  )}
                </div>
                <p style={{ margin: '0.25rem 0 0 1.6rem', fontSize: '0.72rem', color: '#666' }}>
                  {timeAgo(n.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}