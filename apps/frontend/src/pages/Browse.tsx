import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getPoliticians, getPoliticiansMeta } from '../api/politicians'
import LeaderCard from '../components/LeaderCard'
import { Empty, Loading } from '../components/States'
import { CATEGORIES } from '../lib/format'
import { VIEWS } from '../config'
import type { ViewKey } from '../config'

type Sort = 'prominence' | 'name' | 'score_asc' | 'score_desc' | 'newest'

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const [view, setView] = useState<ViewKey>((VIEWS.find(v => v.key === params.get('view'))?.key || (params.get('category') ? 'all' : 'main')) as ViewKey)
  const [country, setCountry] = useState('')
  const [party, setParty] = useState('')
  const [position, setPosition] = useState('')
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [minTruth, setMinTruth] = useState('')
  const [maxTruth, setMaxTruth] = useState('')
  const [sort, setSort] = useState<Sort>('prominence')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  const activeFilterCount = [category, country, party, position, minAge, maxAge, minTruth, maxTruth].filter(Boolean).length

  const clearFilters = () => {
    setCountry(''); setParty(''); setPosition(''); setMinAge(''); setMaxAge(''); setMinTruth(''); setMaxTruth('')
    setCategory(''); setPage(1); syncParams(search, '', view)
  }
  const syncParams = (q: string, c: string, vw: ViewKey) => {
    const next: Record<string, string> = {}
    if (q) next.q = q
    if (c) next.category = c
    if (vw !== 'main') next.view = vw
    setParams(next, { replace: true })
  }
  const onSearch = (v: string) => { setSearch(v); setPage(1); syncParams(v, category, view) }
  const onCategory = (c: string) => { setCategory(c); setPage(1); if (c) setView('all'); syncParams(search, c, c ? 'all' : view) }
  const onView = (vw: ViewKey) => { setView(vw); setCategory(''); setPage(1); syncParams(search, '', vw) }
  const set = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1) }

  const { data: meta } = useQuery({ queryKey: ['politicians-meta'], queryFn: getPoliticiansMeta })

  const { data, isLoading } = useQuery({
    queryKey: ['politicians', search, view, category, country, party, position, minAge, maxAge, minTruth, maxTruth, sort, page],
    queryFn: () => getPoliticians({
      search: search || undefined,
      country: country || undefined,
      party: party || undefined,
      position: position || undefined,
      category: category || undefined,
      view: category || view === 'all' ? undefined : view,
      min_age: minAge ? Number(minAge) : undefined,
      max_age: maxAge ? Number(maxAge) : undefined,
      min_truth: minTruth ? Number(minTruth) : undefined,
      max_truth: maxTruth ? Number(maxTruth) : undefined,
      sort, page, limit: 20,
    }),
    placeholderData: prev => prev,
  })

  const leaders = data?.politicians || []
  const totalPages = data?.totalPages || 1
  const total = data?.total || 0

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Files</p>
        <h1>Browse</h1>
        <p>{category ? CATEGORIES.find(c => c.value === category)?.plural : VIEWS.find(v => v.key === view)?.blurb} <span className="mono">{total.toLocaleString()}</span> on file.</p>
      </div>

      <div className="chips" style={{ marginBottom: '1rem' }}>
        {VIEWS.map(v => (
          <button key={v.key} className={`chip${!category && view === v.key ? ' is-active' : ''}`} onClick={() => onView(v.key)}>{v.label}</button>
        ))}
      </div>

      <div className="row" style={{ gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search name, alias, party, region, position"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        <select className="select" style={{ width: 'auto' }} value={sort} onChange={e => { setSort(e.target.value as Sort); setPage(1) }}>
          <option value="prominence">Prominence</option>
          <option value="name">A–Z</option>
          <option value="score_asc">Lowest score</option>
          <option value="score_desc">Highest score</option>
          <option value="newest">Newest files</option>
        </select>
        <button className={`btn${activeFilterCount > 0 ? ' is-active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            <div className="field">
              <label className="label">Category</label>
              <select className="select" value={category} onChange={e => onCategory(e.target.value)}>
                <option value="">Any</option>
                {CATEGORIES.filter(c => (meta?.categories?.find((m: any) => m.key === c.value)?.count || 0) > 0).map(c => (
                  <option key={c.value} value={c.value}>{c.plural} ({meta?.categories?.find((m: any) => m.key === c.value)?.count})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Country</label>
              <select className="select" value={country} onChange={e => set(setCountry)(e.target.value)}>
                <option value="">All</option>
                {meta?.countries?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Party</label>
              <select className="select" value={party} onChange={e => set(setParty)(e.target.value)}>
                <option value="">All</option>
                {meta?.parties?.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Position</label>
              <select className="select" value={position} onChange={e => set(setPosition)(e.target.value)}>
                <option value="">All</option>
                {meta?.positions?.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Age</label>
              <div className="row" style={{ gap: '0.5rem' }}>
                <input className="input" type="number" placeholder="Min" value={minAge} onChange={e => set(setMinAge)(e.target.value)} />
                <span className="dim">–</span>
                <input className="input" type="number" placeholder="Max" value={maxAge} onChange={e => set(setMaxAge)(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="label">TruthScore</label>
              <div className="row" style={{ gap: '0.5rem' }}>
                <input className="input" type="number" min={1} max={100} placeholder="Min" value={minTruth} onChange={e => set(setMinTruth)(e.target.value)} />
                <span className="dim">–</span>
                <input className="input" type="number" min={1} max={100} placeholder="Max" value={maxTruth} onChange={e => set(setMaxTruth)(e.target.value)} />
              </div>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button className="btn btn--ghost btn--sm" style={{ marginTop: '0.75rem' }} onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      )}

      {isLoading && <Loading />}
      {!isLoading && leaders.length === 0 && (
        <Empty text={search ? `Nothing on file for "${search}". Either they're clean, or nobody's looked yet.` : 'Nothing on file.'} />
      )}

      <div className="grid-cards" style={{ opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {leaders.map((p: any) => <LeaderCard key={p.id} leader={p} />)}
      </div>

      {totalPages > 1 && (
        <div className="row" style={{ justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn--sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
          <span className="mono tiny muted" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Page {page} / {totalPages}
          </span>
          <button className="btn btn--sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
        </div>
      )}
    </div>
  )
}
