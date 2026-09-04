import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPolitician, getGrafts, addBookmark, removeBookmark, checkBookmark, syncLeader, getLeaderNews, getVerdicts, getLeaks } from '../api/politicians'
import { useAuth } from '../context/AuthContext'
import type { LeaderDetail } from '../types'
import { Loading } from '../components/States'
import Section from '../components/Section'
import ScorePanel from '../components/ScorePanel'
import SourcesDrawer from '../components/SourcesDrawer'
import ScoreRing from '../components/ScoreRing'
import Sparkline from '../components/Sparkline'
import VerdictBar from '../components/VerdictBar'
import { Redacted } from '../components/Redaction'
import CareerLedger, { careerHeadline, usePositions } from '../components/leader/CareerLedger'
import WatchSection, { useWatch, watchHeadline } from '../components/leader/WatchSection'
import GovernanceSection, { governanceHeadline, useGovernance } from '../components/leader/GovernanceSection'
import MediaSection, { mediaHeadline, useMedia } from '../components/leader/MediaSection'
import FlagsSection, { flagsHeadline, useFlags } from '../components/leader/FlagsSection'
import AttentionSection, { attentionHeadline, useAttention } from '../components/leader/AttentionSection'
import RecordsSection, { recordsHeadline, useRecords } from '../components/leader/RecordsSection'
import { PromisesList, ContradictionsList, promisesHeadline, contradictionsHeadline, usePromises } from '../components/leader/PromisesSection'
import VerdictsTab from '../components/leader/VerdictsTab'
import LeaksTab from '../components/leader/LeaksTab'
import Discussion from '../components/leader/Discussion'
import { categoryLabel, compact, formatDate, scoreLabel, verdictLabel } from '../lib/format'

function ScoreStamp({ score, compactMode = false, onClick }: { score: number; compactMode?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`score-stamp${compactMode ? ' score-stamp--compact' : ''}`} onClick={onClick} aria-label={`TruthScore ${score}. Show how it was produced.`}>
      {!compactMode && <span className="eyebrow">TruthScore</span>}
      <span className="score-stamp__value">{score}</span>
      <span className="score-stamp__bar" aria-hidden="true"><span style={{ width: `${Math.max(0, 100 - score)}%` }} /></span>
      {!compactMode && <span className="score-stamp__hint">{scoreLabel(score)} · tap to interrogate</span>}
    </button>
  )
}

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
      <button className={`btn btn--sm${status?.bookmarked ? ' is-active' : ''}`} onClick={() => setOpen(!open)}>{status?.bookmarked ? 'Saved' : 'Save'}</button>
      {open && (
        <div className="card card--elevated" style={{ position: 'absolute', right: 0, top: '2.3rem', width: 240, zIndex: 20, padding: '0.75rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Save to graft</p>
          <button className="btn btn--ghost btn--sm btn--block" style={{ justifyContent: 'flex-start' }} onClick={() => add.mutate({ politician_id: leaderId })}>Unsorted</button>
          {grafts?.map((g: any) => {
            const already = saved.some((b: any) => b.graft_id === g.id)
            return <button key={g.id} className="btn btn--ghost btn--sm btn--block" style={{ justifyContent: 'space-between', opacity: already ? 0.5 : 1 }} disabled={already} onClick={() => add.mutate({ politician_id: leaderId, graft_id: g.id })}><span className="truncate">{g.name}</span>{already && <span className="mono tiny">saved</span>}</button>
          })}
          {saved.length > 0 && (<><hr className="divider" style={{ margin: '0.6rem 0' }} />{saved.map((b: any) => (
            <div key={b.id} className="row row--between" style={{ padding: '0.25rem 0.4rem' }}><span className="small muted truncate">{b.graft_name || 'Unsorted'}</span><button className="btn btn--ghost btn--sm btn--danger" onClick={() => remove.mutate(b.id)}>Remove</button></div>
          ))}</>)}
          <hr className="divider" style={{ margin: '0.6rem 0' }} />
          <Link to="/bookmarks" className="eyebrow">Manage grafts →</Link>
        </div>
      )}
    </div>
  )
}

const POLITICAL = new Set(['world_leader', 'politician'])
const year = (d?: string | null) => (d ? String(d).slice(0, 4) : null)
const firstSentence = (t?: string | null) => { if (!t) return null; const m = t.match(/^.+?[.!?](?=\s|$)/); return m ? m[0] : t }

export default function Leader() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const focus = params.get('tab')
  const { user } = useAuth()
  const qc = useQueryClient()
  const [panel, setPanel] = useState<'score' | 'sources' | null>(null)
  const [sticky, setSticky] = useState(false)
  const headRef = useRef<HTMLElement>(null)
  const closePanel = useCallback(() => setPanel(null), [])

  const { data: leader, isLoading, isError } = useQuery<LeaderDetail>({ queryKey: ['politician', id], queryFn: () => getPolitician(id!) })
  const positions = usePositions(id!)
  const watch = useWatch(id!)
  const governance = useGovernance(id!)
  const media = useMedia(id!)
  const flags = useFlags(id!)
  const attention = useAttention(id!)
  const records = useRecords(id!)
  const promises = usePromises(id!)
  const verdicts = useQuery({ queryKey: ['verdicts', id], queryFn: () => getVerdicts(id!) })
  const leaks = useQuery({ queryKey: ['leaks', id], queryFn: () => getLeaks(id!) })
  const news = useQuery({ queryKey: ['news', id], queryFn: () => getLeaderNews(id!), staleTime: 10 * 60 * 1000 })
  const sync = useMutation({ mutationFn: () => syncLeader(id!), onSuccess: () => { qc.invalidateQueries({ queryKey: ['politician', id] }); qc.invalidateQueries({ queryKey: ['positions', id] }); qc.invalidateQueries({ queryKey: ['watch', id] }); qc.invalidateQueries({ queryKey: ['sources', id] }) } })

  useEffect(() => {
    const el = headRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const obs = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting), { threshold: 0, rootMargin: '-60px 0px 0px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [leader?.id])

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

  if (!leader.wikidata_id && !user?.is_admin) {
    return (
      <div className="page page--narrow" style={{ paddingTop: '5rem' }}>
        <p className="eyebrow">Case file · withheld</p>
        <h1 style={{ fontSize: '2.2rem', margin: '0.5rem 0 1rem' }}>{leader.name}</h1>
        <div className="redact-rule" style={{ marginBottom: '1rem' }} />
        <p className="muted" style={{ maxWidth: '58ch' }}>No Wikidata record is linked to this person, so nothing on this page could be traced to a source. Pages are only published for people with a verifiable public record.</p>
        <Link to="/browse" className="btn" style={{ marginTop: '1.5rem' }}>Back to browse</Link>
      </div>
    )
  }

  const score = Number(leader.truth_score)
  const political = POLITICAL.has(String(leader.category))
  const office = political && leader.current_office ? leader.current_office : leader.position
  const termStart = year(leader.term_start)
  const termEnd = year(leader.term_end)
  const termText = political && termStart ? (termEnd ? `${termStart}–${termEnd}` : `since ${termStart}`) : null
  const former = political && !!leader.term_end
  const career = careerHeadline(positions.data, leader.position)
  const onWatch = watchHeadline(watch.data)
  const gov = governanceHeadline(governance.data)
  const med = mediaHeadline(media.data)
  const flg = flagsHeadline(flags.data)
  const att = attentionHeadline(attention.data)
  const rec = recordsHeadline(records.data)
  const prm = promisesHeadline(promises.data)
  const ctr = contradictionsHeadline(promises.data)
  const agg = verdicts.data?.aggregate
  const verdictHeadline = agg?.total ? `${agg.percentages[agg.dominant]}% ${verdictLabel(agg.dominant)}` : 'No verdicts yet'
  const verdictSummary = agg?.total ? `${agg.total} member verdict${agg.total === 1 ? '' : 's'}. Community score ${agg.score} of 100. Opinions of site members, not findings of fact.` : 'No member has submitted a verdict. Verdicts are opinions of site members, not findings of fact.'
  const leakCount = leaks.data?.length || 0
  const newsCount = news.data?.items?.length || 0

  return (
    <div className="page page--narrow" style={{ maxWidth: 860 }}>
      <div className={`sticky-score${sticky ? ' is-visible' : ''}`} aria-hidden={!sticky}>
        <div className="sticky-score__name truncate">{leader.name}</div>
        <ScoreStamp score={score} compactMode onClick={() => setPanel('score')} />
      </div>

      <header className="dossier-head" ref={headRef}>
        {leader.photo_url ? <img className="photo photo--hero" src={leader.photo_url} alt={`Portrait of ${leader.name}`} /> : <div className="photo photo--hero" aria-hidden="true" />}
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">Case file · {categoryLabel(leader.category)}{leader.country ? ` · ${leader.country}` : ''}</p>
          <h1 className="dossier-head__name">{leader.name}</h1>
          <p className="dossier-head__office">{former ? 'Former ' : ''}{office || 'Office unlisted'}{termText ? <span className="muted"> · {termText}</span> : null}</p>
          <p className="dossier-head__meta">
            {[leader.party && leader.party !== 'Independent' ? leader.party : null, leader.born ? `born ${formatDate(leader.born)}` : leader.age ? `age ${leader.age}` : null, Number(leader.attention) > 0 ? `${compact(leader.attention)} Wikipedia views in 30 days` : null].filter(Boolean).join(' · ')}
          </p>
          <div className="row row--wrap" style={{ marginTop: '0.9rem', gap: '0.5rem' }}>
            <button className="btn btn--sm" onClick={() => setPanel('sources')}>Sources</button>
            <SaveButton leaderId={leader.id} />
            {user?.is_admin && <button className="btn btn--ghost btn--sm" onClick={() => sync.mutate()} disabled={sync.isPending}>{sync.isPending ? 'Syncing' : 'Sync data'}</button>}
          </div>
        </div>
        <div className="dossier-head__score">
          <ScoreStamp score={score} onClick={() => setPanel('score')} />
        </div>
      </header>

      <Section id="flags" label="Flags · sanctions and exposure" headline={flg.headline} summary={flg.summary} open={focus === 'flags'} defaultOpen={(flags.data?.flags || []).some((x: any) => x.kind === 'sanction')}>
        <FlagsSection leaderId={leader.id} name={leader.name} />
      </Section>

      <Section id="career" label="Office" headline={career.headline} summary={career.summary} defaultOpen={!!focus && focus === 'career'} open={focus === 'career'}>
        <CareerLedger leaderId={leader.id} />
      </Section>

      <Section id="watch" label={`On their watch · ${leader.country || 'country'}`} headline={onWatch.headline} summary={onWatch.summary} open={focus === 'watch'}>
        <WatchSection leaderId={leader.id} />
      </Section>

      <Section id="governance" label={`Governance trajectory · ${leader.country || 'country'}`} headline={gov.headline} summary={gov.summary} open={focus === 'governance'}>
        <GovernanceSection leaderId={leader.id} />
      </Section>

      <Section id="media" label="Media tone and coverage" headline={med.headline} summary={med.summary} open={focus === 'media'}>
        <MediaSection leaderId={leader.id} isAdmin={!!user?.is_admin} />
      </Section>

      <Section id="attention" label="Attention · Wikipedia page views" headline={att.headline} summary={att.summary} open={focus === 'attention'}>
        <AttentionSection leaderId={leader.id} />
      </Section>

      <Section id="records" label={`Votes, money, courts · ${leader.country || 'country'}`} headline={rec.headline} summary={rec.summary} open={focus === 'records'}>
        <RecordsSection leaderId={leader.id} />
      </Section>

      <Section id="promises" label="Promises" headline={prm.headline} summary={prm.summary} open={focus === 'promises'}>
        <PromisesList leaderId={leader.id} isAdmin={!!user?.is_admin} />
      </Section>

      <Section id="contradictions" label="Contradictions" headline={ctr.headline} summary={ctr.summary} open={focus === 'contradictions'}>
        <ContradictionsList leaderId={leader.id} isAdmin={!!user?.is_admin} />
      </Section>

      <Section id="profile" label="Profile" headline={leader.born ? `Born ${year(leader.born)}${leader.country ? ` · ${leader.country}` : ''}` : leader.country || 'Profile'} summary={firstSentence(leader.summary) || leader.bio || 'No summary on file.'} open={focus === 'profile'}>
        {leader.summary ? <p style={{ lineHeight: 1.65, color: 'var(--muted)' }}>{leader.summary}</p> : <Redacted label="No summary on file" />}
        <dl style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1rem', fontSize: '0.85rem' }}>
          {[['Position on file', leader.position], ['Party', leader.party], ['Region', leader.region], ['Country', leader.country], ['Born', leader.born ? formatDate(leader.born) : null], ['Net worth', leader.net_worth ? `$${compact(leader.net_worth)}` : null], ['Wikidata', leader.wikidata_id]].filter(([, v]) => v).map(([k, v]) => (
            <div key={String(k)} style={{ display: 'contents' }}><dt className="eyebrow" style={{ paddingTop: '0.15rem' }}>{k}</dt><dd className="mono small">{String(v)}</dd></div>
          ))}
        </dl>
        {leader.wiki_url && <p className="section__caption">Summary adapted from <a href={leader.wiki_url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>Wikipedia</a>, CC BY-SA 4.0.</p>}
      </Section>

      <Section id="verdicts" label="Community verdict" headline={verdictHeadline} summary={verdictSummary} open={focus === 'verdicts'}>
        <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-around', gap: '1rem' }}>
            <ScoreRing value={score} size="md" label="TruthScore" />
            <ScoreRing value={agg?.score} size="md" label="Community" />
          </div>
          <div className="card">
            <div className="row row--between" style={{ marginBottom: '0.5rem' }}><span className="eyebrow">TruthScore · 30 days</span></div>
            <Sparkline points={leader.score_history || []} />
            <div style={{ marginTop: '0.75rem' }}><VerdictBar counts={agg?.counts} size="lg" /></div>
          </div>
        </div>
        <VerdictsTab leaderId={leader.id} />
      </Section>

      <Section id="leaks" label="Leaks" headline={`${leakCount} leak${leakCount === 1 ? '' : 's'}`} summary="Anonymous, unverified submissions from members. Upvoted leaks can lower the score; every deduction is logged with its source." open={focus === 'leaks'}>
        <LeaksTab leaderId={leader.id} onGoTo={() => undefined} />
      </Section>

      <Section id="news" label="Coverage" headline={newsCount ? `${newsCount} headline${newsCount === 1 ? '' : 's'} · 30 days` : 'No indexed coverage'} summary={newsCount ? 'Recent English-language headlines indexed by GDELT. Presence in the news is not a judgement.' : 'GDELT has not indexed English-language coverage in the last 30 days, or the index is temporarily unavailable.'} open={focus === 'news'}>
        {news.data?.items?.length ? news.data.items.map((h: any, i: number) => (
          <div key={i} className="headline">
            <div className="headline__meta">{h.date}<br />{h.source}</div>
            <a className="headline__title" href={h.url} target="_blank" rel="noopener noreferrer">{h.title}</a>
          </div>
        )) : <Redacted label="Nothing indexed" />}
      </Section>

      <Section id="discussion" label="Discussion" headline={`${leader.stats?.comments || 0} entr${(leader.stats?.comments || 0) === 1 ? 'y' : 'ies'}`} summary="Member discussion. Not moderated for accuracy." open={focus === 'discussion'}>
        <Discussion leaderId={leader.id} />
      </Section>

      {panel === 'score' && <ScorePanel leaderId={leader.id} score={score} onClose={closePanel} />}
      {panel === 'sources' && <SourcesDrawer leaderId={leader.id} onClose={closePanel} />}
    </div>
  )
}
