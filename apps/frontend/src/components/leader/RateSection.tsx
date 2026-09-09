import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRating, setRating, clearRating, getThreads } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import RatingRing from '../RatingRing'
import ThreadRow from '../forum/ThreadRow'
import ThreadComposer from '../forum/ThreadComposer'
import { Empty, Loading } from '../States'
import { ratingLabel } from '../../lib/format'

const BINS = ['0–24', '25–49', '50–74', '75–100']

export function useRating(leaderId: string) {
  return useQuery({ queryKey: ['rating', leaderId], queryFn: () => getRating(leaderId) })
}

/** Collapsed-state copy for the Rate section. Never shows an average below the publication threshold. */
export function ratingHeadline(data: any) {
  const n = Number(data?.n || 0)
  const min = Number(data?.min_votes || 5)
  if (data?.average != null) {
    return {
      headline: `${data.average} / 100 · ${n} rating${n === 1 ? '' : 's'}`,
      summary: `${ratingLabel(data.average)}. The floored average of member ratings, 0 to 100. Opinions of members, not findings of fact.`,
    }
  }
  return {
    headline: n ? `Unrated · ${n} of ${min} ratings` : 'Unrated',
    summary: `Members rate this person from 0 to 100. The average is published once ${min} members have rated, so a single vote never stands in for the crowd.`,
  }
}

function Histogram({ bins }: { bins: number[] }) {
  const max = Math.max(1, ...bins)
  return (
    <div>
      <div className="hist" aria-hidden="true">
        {bins.map((b, i) => <div key={i} className="hist__col"><span className="hist__count mono tiny">{b || ''}</span><div className="hist__bar" style={{ height: `${Math.round((b / max) * 100)}%` }} /></div>)}
      </div>
      <div className="hist__labels">{BINS.map(l => <span key={l} className="mono tiny dim">{l}</span>)}</div>
    </div>
  )
}

export default function RateSection({ leaderId, leaderName }: { leaderId: string; leaderName: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const verified = !!user?.email_verified
  const { data, isLoading } = useRating(leaderId)
  const [value, setValue] = useState(50)
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [explaining, setExplaining] = useState(false)

  useEffect(() => { if (data?.mine != null) { setValue(data.mine); setTouched(false) } }, [data?.mine])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rating', leaderId] })
    qc.invalidateQueries({ queryKey: ['politician', leaderId] })
  }
  const submit = useMutation({
    mutationFn: setRating,
    onSuccess: () => { invalidate(); setError(''); setTouched(false); setDone(true); setTimeout(() => setDone(false), 2500) },
    onError: e => setError(errorMessage(e)),
  })
  const withdraw = useMutation({ mutationFn: () => clearRating(leaderId), onSuccess: () => { invalidate(); setValue(50); setTouched(false) } })
  const verdicts = useQuery({ queryKey: ['threads', 'leader', leaderId, 'verdict'], queryFn: () => getThreads({ leader: leaderId, kind: 'verdict', sort: 'new', limit: 10 }) })

  const n = Number(data?.n || 0)
  const min = Number(data?.min_votes || 5)
  const average: number | null = data?.average ?? null
  const mine: number | null = data?.mine ?? null

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '1rem' }}>
          <RatingRing value={average} size="lg" label="Community rating" sublabel={average != null ? `${n} rating${n === 1 ? '' : 's'}` : n ? `${n} of ${min} ratings` : 'no ratings yet'} />
        </div>
        <div className="card">
          <div className="row row--between" style={{ marginBottom: '0.6rem' }}><span className="eyebrow">Distribution</span><span className="mono tiny dim">{n} total</span></div>
          {isLoading ? <Loading /> : n ? <Histogram bins={data.bins || [0, 0, 0, 0]} /> : <p className="small dim">No ratings yet. The first one sets the tone.</p>}
          {average == null && n > 0 && <p className="help" style={{ marginTop: '0.6rem' }}>The average is withheld until {min} members have rated. {min - n} more to go.</p>}
        </div>
      </div>

      {!user && <div className="notice notice--plain" style={{ marginBottom: '1.25rem' }}><Link to="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to rate {leaderName}. One rating per account, changeable any time.</div>}
      {user && !verified && <div className="notice" style={{ marginBottom: '1.25rem' }}>Verify your email to rate.</div>}

      {verified && (
        <div className="card card--elevated stack" style={{ marginBottom: '1.25rem' }}>
          <div className="row row--between">
            <span className="eyebrow">{mine != null ? 'Your rating · change it any time' : 'Your rating'}</span>
            {mine != null && <button className="btn btn--ghost btn--sm btn--danger" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>Withdraw</button>}
          </div>
          <div className="rate">
            <span className="rate__value mono">{value}</span>
            <input className="range" type="range" min={0} max={100} step={1} value={value} onChange={e => { setValue(Number(e.target.value)); setTouched(true) }} aria-label={`Your rating of ${leaderName}, 0 to 100`} />
            <div className="rate__ends mono tiny dim"><span>0 · condemn</span><span>100 · trust</span></div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="row row--wrap">
            <button className="btn btn--gold" disabled={submit.isPending || (mine != null && !touched)} onClick={() => submit.mutate({ politician_id: leaderId, score: value })}>
              {submit.isPending ? 'Filing' : mine != null ? 'Update rating' : 'File rating'}
            </button>
            <button className={`btn btn--ghost${explaining ? ' is-active' : ''}`} onClick={() => setExplaining(!explaining)}>{explaining ? 'Close' : 'Explain it on the forum'}</button>
            {done && <span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Filed.</span>}
          </div>
          <p className="help">Ratings are private to your account: nobody sees who rated what, only the average and the spread.</p>
        </div>
      )}

      {explaining && <div style={{ marginBottom: '1.25rem' }}><ThreadComposer kind="verdict" leader={{ id: leaderId, name: leaderName }} rating={mine ?? value} onDone={() => setExplaining(false)} /></div>}

      <div className="row row--between" style={{ marginBottom: '0.6rem' }}>
        <span className="eyebrow">Verdict threads · {verdicts.data?.total || 0}</span>
        <Link to={`/forum?board=leaders&kind=verdict`} className="mono tiny muted">All verdicts →</Link>
      </div>
      {verdicts.isLoading && <Loading />}
      {!verdicts.isLoading && !verdicts.data?.threads?.length && <Empty text="No written verdicts yet." sub="Rate, then explain it" />}
      <div className="stack" style={{ gap: '0.5rem' }}>{verdicts.data?.threads?.map((t: any) => <ThreadRow key={t.id} t={t} />)}</div>
    </div>
  )
}
