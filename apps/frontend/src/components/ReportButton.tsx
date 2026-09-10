import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { reportContent } from '../api/legal'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Dropdown from './Dropdown'

const REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment or threats' },
  { value: 'private_info', label: 'Private information about a private person' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'defamation', label: 'False statement about a named person' },
  { value: 'other', label: 'Something else' },
]

/** Report a thread or reply into the moderation queue. */
export default function ReportButton({ targetType, targetId }: { targetType: 'thread' | 'post'; targetId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const send = useMutation({ mutationFn: reportContent, onSuccess: () => { setDone(true); setOpen(false) }, onError: e => setError(errorMessage(e)) })
  if (!user?.email_verified) return null
  if (done) return <span className="mono tiny dim" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>Reported</span>
  return (
    <span className="report">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(o => !o)}>{open ? 'Cancel' : 'Report'}</button>
      {open && (
        <span className="report__form stack">
          <Dropdown placeholder="Reason" value={reason} onChange={setReason} options={REASONS} className="dd--block" />
          <textarea className="textarea" rows={2} placeholder="Anything the moderators should know (optional)" value={detail} onChange={e => setDetail(e.target.value)} maxLength={2000} />
          {error && <span className="error">{error}</span>}
          <span><button type="button" className="btn btn--sm" disabled={!reason || send.isPending} onClick={() => send.mutate({ target_type: targetType, target_id: targetId, reason, detail: detail.trim() || undefined })}>{send.isPending ? 'Sending' : 'Send report'}</button></span>
        </span>
      )}
    </span>
  )
}
