import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRating, setRating, clearRating, getThreads } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import ScoreRing from '../ScoreRing'
import Sparkline from '../Sparkline'
import ThreadRow from '../forum/ThreadRow'
import ThreadComposer from '../forum/ThreadComposer'
import { Empty, Loading } from '../States'
import type { ScorePoint } from '../../types'

export const COMMUNITY_WEIGHT = 60
export const EXTERNAL_WEIGHT = 40
const BINS = ['0–24', '25–49', '50–74', '75–100']

export function useRating(leaderId: string) {
  return useQuery({ queryKey: ['rating', leaderId], queryFn: () => getRating(leaderId) })
}

export function ratingHeadline(data: any, score: number | null) {
  const n = Number(data?.n || 0)
  if (!n) {
    return {
      headline: score == null ? 'Unrated' : 'No member ratings yet',
      summary: `Members rate this person from 0 to 100. Their average is ${COMMUNITY_WEIGHT}% of the TruthScore; the other ${EXTERNAL_WEIGHT}% is a signal from outside this site.`,
    }
  }
  return {
    headline: `Members: ${data.average} / 100`,
    summary: `${n} rating${n === 1 ? '' : 's'} from members. That average is ${COMMUNITY_WEIGHT}% of the TruthScore; the other ${EXTERNAL_WEIGHT}% comes from outside this site. Opinions of members, not findings of fact.`,
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

export default function RateSection({ leaderId, leaderName, score, history }: { leaderId: string; leaderName: string; score: number | null; history: ScorePoint[] }) {
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
    qc.invalidateQueries({ queryKey: ['score-events', leaderId] })
  }
  const submit = useMutation({
    mutationFn: setRating,
    onSuccess: () => { invalidate(); setError(''); setTouched(false); setDone(true); setTimeout(() => setDone(false), 2500) },
    onError: e => setError(errorMessage(e)),
  })
  const withdraw = useMutation({ mutationFn: () => clearRating(leaderId), onSuccess: () => { invalidate(); setValue(50); setTouched(false) } })
  const verdicts = useQuery({ queryKey: ['threads', 'leader', leaderId, 'verdict'], queryFn: () => getThreads({ leader: leaderId, kind: 'verdict', sort: 'new', limit: 10 }) })

  const comp = data?.components || {}
  const community = comp.community == null ? null : Math.round(Number(comp.community))
  const external = comp.external == null ? null : Math.round(Number(comp.external))
  const mine: number | null = data?.mine ?? null

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-around', gap: '1rem' }}>
          <ScoreRing value={score} size="md" label="TruthScore" />
          <ScoreRing value={data?.average} size="md" label="Members" sublabel={data?.n ? `${data.n} rating${data.n === 1 ? '' : 's'}` : 'none yet'} />
        </div>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>How it combines</div>
          <div className="breakdown">
            <div className="breakdown__row"><span>Members' ratings</span><span className="mono tiny dim">{COMMUNITY_WEIGHT}%</span><span className="mono">{community == null ? <span className="dim">—</span> : community}</span></div>
            <div className="breakdown__row"><span>Outside signal</span><span className="mono tiny dim">{EXTERNAL_WEIGHT}%</span><span className="mono">{external == null ? <span className="dim">—</span> : external}</span></div>
          </div>
          <p className="help" style={{ marginTop: '0.6rem' }}>
            {community == null && external == null && 'Neither part exists yet, so there is no score.'}
            {community == null && external != null && 'No member ratings yet, so the score is the outside signal alone until members rate.'}
            {community != null && external == null && 'No outside signal yet, so the score is the members’ average alone.'}
            {community != null && external != null && 'Both parts exist. Members are shrunk toward 50 while ratings are few.'}
            {' '}The outside signal is the share of world press coverage that is not negative in tone, less a deduction for listings by scoring sanctions authorities. Tap the score for every event.
          </p>
          {history?.length > 1 && <div style={{ marginTop: '0.6rem' }}><Sparkline points={history} /></div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="row row--between" style={{ marginBottom: '0.6rem' }}><span className="eyebrow">Distribution of member ratings</span><span className="mono tiny dim">{data?.n || 0} total</span></div>
        {isLoading ? <Loading /> : data?.n ? <Histogram bins={data.bins || [0, 0, 0, 0]} /> : <p className="small dim">No ratings yet. The first one sets the tone.</p>}
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
          <p className="help">Ratings are always private to your account: nobody sees who rated what, only the average and the spread.</p>
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
