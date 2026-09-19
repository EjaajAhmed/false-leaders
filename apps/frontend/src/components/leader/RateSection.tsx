import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRating, setRating, clearRating } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import RatingRing from '../RatingRing'
import { Loading } from '../States'
import { ratingLabel } from '../../lib/format'

const BINS = ['0–24', '25–49', '50–74', '75–100']
export const RATE_SLIDER_ID = 'rate-slider'

export function useRating(leaderId: string) {
  return useQuery({ queryKey: ['rating', leaderId], queryFn: () => getRating(leaderId) })
}

/** Collapsed-state copy for the ratings section. Never shows an average below the publication threshold. */
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
    summary: `The average is published once ${min} members have rated, so a single vote never stands in for the crowd.`,
  }
}

/** Scroll to the rate bar and put focus on the slider. */
export function focusRateBar() {
  document.getElementById('rate-bar')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => document.getElementById(RATE_SLIDER_ID)?.focus({ preventScroll: true }), 350)
}

/**
 * The rating widget shown directly under the leader header: the community
 * number on one side, the member's own slider on the other.
 */
export function RateBar({ leaderId, leaderName }: { leaderId: string; leaderName: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const verified = !!user?.email_verified
  const { data } = useRating(leaderId)
  const [value, setValue] = useState(50)
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

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

  const n = Number(data?.n || 0)
  const min = Number(data?.min_votes || 5)
  const average: number | null = data?.average ?? null
  const mine: number | null = data?.mine ?? null

  return (
    <section className="rate-bar" id="rate-bar" aria-label={`Rate ${leaderName}`}>
      <div className="rate-bar__stat">
        <RatingRing value={average} size="lg" label="Community rating" sublabel={average != null ? `${ratingLabel(average)} · ${n} rating${n === 1 ? '' : 's'}` : n ? `${n} of ${min} ratings` : 'no ratings yet'} />
      </div>
      <div className="rate-bar__form">
        <div className="row row--between">
          <span className="rate-bar__title">{mine != null ? 'Your rating' : `Rate ${leaderName}`}</span>
          {mine != null && <button className="btn btn--ghost btn--sm btn--danger" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>Withdraw</button>}
        </div>
        {!user && (
          <>
            <p className="rate-bar__gate">One rating per account, 0 to 100, changeable any time.</p>
            <div className="row row--wrap"><Link to="/login" className="btn btn--gold btn--lg">Sign in to rate</Link><Link to="/register" className="btn btn--lg">Register</Link></div>
          </>
        )}
        {user && !verified && <p className="rate-bar__gate">Verify your email to rate.</p>}
        {verified && (
          <>
            <div className="rate">
              <span className="rate__value mono" aria-live="polite">{value}</span>
              <input id={RATE_SLIDER_ID} className="range" type="range" min={0} max={100} step={1} value={value} onChange={e => { setValue(Number(e.target.value)); setTouched(true) }} aria-label={`Your rating of ${leaderName}, 0 to 100`} />
              <div className="rate__ends mono tiny dim"><span>0 · condemn</span><span>100 · trust</span></div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="row row--wrap">
              <button className="btn btn--gold btn--lg" disabled={submit.isPending || (mine != null && !touched)} onClick={() => submit.mutate({ politician_id: leaderId, score: value })}>
                {submit.isPending ? 'Saving' : mine != null ? 'Update rating' : 'Submit rating'}
              </button>
              {done && <span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Rating saved.</span>}
              {average == null && n > 0 && !done && <span className="mono tiny dim">{min - n} more rating{min - n === 1 ? '' : 's'} until the average is public</span>}
            </div>
          </>
        )}
      </div>
    </section>
  )
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

/** Distribution of member ratings. The rating widget itself lives in RateBar. */
export default function RateSection({ leaderId, leaderName }: { leaderId: string; leaderName: string }) {
  const { data, isLoading } = useRating(leaderId)
  const n = Number(data?.n || 0)
  const min = Number(data?.min_votes || 5)

  return (
    <div className="card">
      <div className="row row--between" style={{ marginBottom: '0.6rem' }}><span className="eyebrow">Distribution of member ratings</span><span className="mono tiny dim">{n} total</span></div>
      {isLoading ? <Loading /> : n ? <Histogram bins={data.bins || [0, 0, 0, 0]} /> : <p className="small dim">No ratings yet. The first one sets the tone.</p>}
      {data?.average == null && n > 0 && <p className="help" style={{ marginTop: '0.6rem' }}>The average is withheld until {min} members have rated. {min - n} more to go.</p>}
      <p className="help" style={{ marginTop: '0.6rem' }}>Ratings are private to each account: nobody sees who rated {leaderName} what, only the average and the spread. Argue your rating in the Discussion section below.</p>
    </div>
  )
}
