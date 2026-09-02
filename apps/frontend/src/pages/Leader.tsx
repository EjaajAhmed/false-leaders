import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPolitician, getGrafts, addBookmark, removeBookmark, checkBookmark } from '../api/politicians'
import { useAuth } from '../context/AuthContext'
import type { LeaderDetail } from '../types'
import { Loading } from '../components/States'
import OverviewTab from '../components/leader/OverviewTab'
import ControversiesTab from '../components/leader/ControversiesTab'
import FundingTab from '../components/leader/FundingTab'
import InfluenceTab from '../components/leader/InfluenceTab'
import VerdictsTab from '../components/leader/VerdictsTab'
import LeaksTab from '../components/leader/LeaksTab'
import { categoryLabel, scoreColor, scoreLabel } from '../lib/format'
import { ARCHIVED } from '../config'

const ALL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'controversies', label: 'Controversies' },
  { key: 'funding', label: 'Funding' },
  { key: 'influence', label: 'Influence' },
  { key: 'verdicts', label: 'Verdicts' },
  { key: 'leaks', label: 'Leaks' },
] as const
const TABS = ALL_TABS.filter(t => !(ARCHIVED as Record<string, boolean>)[t.key])
type TabKey = typeof ALL_TABS[number]['key']

function SaveButton({ leaderId }: { leaderId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const verified = !!user?.email_verified

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const { data: status, refetch } = useQuery({ queryKey: ['bookmark', leaderId], queryFn: () => checkBookmark(leaderId), enabled: verified })
  const { data: grafts } = useQuery({ queryKey: ['grafts'], queryFn: getGrafts, enabled: verified })
  const add = useMutation({ mutationFn: addBookmark, onSuccess: () => refetch() })
  const remove = useMutation({ mutationFn: removeBookmark, onSuccess: () => refetch() })

  if (!verified) return null
  const saved = status?.bookmarks || []

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`btn btn--sm${status?.bookmarked ? ' is-active' : ''}`} onClick={() => setOpen(!open)}>
        {status?.bookmarked ? 'Saved' : 'Save'}
      </button>
      {open && (
        <div className="card card--elevated" style={{ position: 'absolute', right: 0, top: '2.3rem', width: 240, zIndex: 20, padding: '0.75rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Save to graft</p>
          <button className="btn btn--ghost btn--sm btn--block" style={{ justifyContent: 'flex-start' }} onClick={() => add.mutate({ politician_id: leaderId })}>
            Unsorted
          </button>
          {grafts?.map((g: any) => {
            const already = saved.some((b: any) => b.graft_id === g.id)
            return (
              <button key={g.id} className="btn btn--ghost btn--sm btn--block" style={{ justifyContent: 'space-between', opacity: already ? 0.5 : 1 }} disabled={already} onClick={() => add.mutate({ politician_id: leaderId, graft_id: g.id })}>
                <span className="truncate">{g.name}</span>{already && <span className="mono tiny">saved</span>}
              </button>
            )
          })}
          {saved.length > 0 && (
            <>
              <hr className="divider" style={{ margin: '0.6rem 0' }} />
              {saved.map((b: any) => (
                <div key={b.id} className="row row--between" style={{ padding: '0.25rem 0.4rem' }}>
                  <span className="small muted truncate">{b.graft_name || 'Unsorted'}</span>
                  <button className="btn btn--ghost btn--sm btn--danger" onClick={() => remove.mutate(b.id)}>Remove</button>
                </div>
              ))}
            </>
          )}
          <hr className="divider" style={{ margin: '0.6rem 0' }} />
          <Link to="/bookmarks" className="eyebrow">Manage grafts →</Link>
        </div>
      )}
    </div>
  )
}

export default function Leader() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find(t => t.key === params.get('tab'))?.key || 'overview') as TabKey
  const setTab = (k: TabKey) => setParams(k === 'overview' ? {} : { tab: k }, { replace: true })

  const { data: leader, isLoading, isError } = useQuery<LeaderDetail>({ queryKey: ['politician', id], queryFn: () => getPolitician(id!) })

  if (isLoading) return <div className="page"><Loading /></div>
  if (isError || !leader) {
    return (
      <div className="page page--narrow" style={{ paddingTop: '5rem' }}>
        <p className="eyebrow">404</p>
        <h1 style={{ fontSize: '2.2rem', margin: '0.5rem 0 1rem' }}>No such file.</h1>
        <Link to="/browse" className="btn">Back to browse</Link>
      </div>
    )
  }

  const score = Number(leader.truth_score)

  return (
    <div className="page">
      <header style={{ marginBottom: '1.5rem' }}>
        <div className="row row--between row--wrap" style={{ alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="eyebrow">Case file · {categoryLabel(leader.category)}{leader.country ? ` · ${leader.country}` : ''}</p>
            <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.4rem)', margin: '0.4rem 0 0.5rem' }}>{leader.name}</h1>
            <p className="muted">{[leader.position, leader.party, leader.region].filter(Boolean).join(' · ') || 'Position unlisted'}{leader.age ? ` · ${leader.age}` : ''}</p>
            {leader.aliases && leader.aliases.length > 0 && (
              <p className="mono tiny dim" style={{ marginTop: '0.4rem', letterSpacing: '0.08em' }}>a.k.a. {leader.aliases.join(' · ')}</p>
            )}
          </div>
          <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">TruthScore</div>
              <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 600, lineHeight: 1.1, color: scoreColor(score) }}>{score}</div>
              <div className="mono tiny" style={{ color: scoreColor(score), letterSpacing: '0.12em', textTransform: 'uppercase' }}>{scoreLabel(score)}</div>
            </div>
            <SaveButton leaderId={leader.id} />
          </div>
        </div>
      </header>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {TABS.map(t => {
          const count = t.key === 'controversies' ? leader.stats?.controversies
            : t.key === 'verdicts' ? leader.stats?.verdicts
            : t.key === 'leaks' ? leader.stats?.leaks : undefined
          return (
            <button key={t.key} className={`tab${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}{count ? <span className="tab__count">{count}</span> : null}
            </button>
          )
        })}
      </div>

      <div key={tab} className="fade-in">
        {tab === 'overview' && <OverviewTab leader={leader} onGoTo={setTab} />}
        {tab === 'controversies' && <ControversiesTab leaderId={leader.id} />}
        {tab === 'funding' && <FundingTab politicianId={leader.id} />}
        {tab === 'influence' && <InfluenceTab politicianId={leader.id} />}
        {tab === 'verdicts' && <VerdictsTab leaderId={leader.id} />}
        {tab === 'leaks' && <LeaksTab leaderId={leader.id} onGoTo={setTab} />}
      </div>
    </div>
  )
}
