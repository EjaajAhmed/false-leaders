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

// Primary views shown in the bar. Specific categories and countries narrow across everyone on file.
const PRIMARY = VIEWS.filter(v => v.key !== 'all')
const NARROW_CATEGORIES = CATEGORIES.filter(c => c.value !== 'world_leader' && c.value !== 'politician')

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const [country, setCountry] = useState(params.get('country') || '')
  const [view, setView] = useState<ViewKey>((PRIMARY.find(v => v.key === params.get('view'))?.key || 'main') as ViewKey)
  const [party, setParty] = useState('')
  const [position, setPosition] = useState('')
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [minTruth, setMinTruth] = useState('')
  const [maxTruth, setMaxTruth] = useState('')
  const [sort, setSort] = useState<Sort>('prominence')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  // Any narrowing (search, category, country) searches everyone on file rather than the current view.
  const narrowed = !!(search || category || country)
  const activeFilterCount = [party, position, minAge, maxAge, minTruth, maxTruth].filter(Boolean).length

  const sync = (next: { q?: string; category?: string; country?: string; view?: ViewKey }) => {
    const q = next.q ?? search
    const c = next.category ?? category
    const co = next.country ?? country
    const v = next.view ?? view
    const out: Record<string, string> = {}
    if (q) out.q = q
    if (c) out.category = c
    if (co) out.country = co
    if (v !== 'main') out.view = v
    setParams(out, { replace: true })
    setPage(1)
  }
  const onSearch = (v: string) => { setSearch(v); sync({ q: v }) }
  const onCategory = (c: string) => { setCategory(c); sync({ category: c }) }
  const onCountry = (c: string) => { setCountry(c); sync({ country: c }) }
  const onView = (v: ViewKey) => { setView(v); setCategory(''); setCountry(''); setSearch(''); sync({ view: v, category: '', country: '', q: '' }) }
  const set = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1) }
  const clearFilters = () => { setParty(''); setPosition(''); setMinAge(''); setMaxAge(''); setMinTruth(''); setMaxTruth(''); setPage(1) }

  const { data: meta } = useQuery({ queryKey: ['politicians-meta'], queryFn: getPoliticiansMeta })

  const { data, isLoading } = useQuery({
    queryKey: ['politicians', search, view, category, country, party, position, minAge, maxAge, minTruth, maxTruth, sort, page],
    queryFn: () => getPoliticians({
      search: search || undefined,
      category: category || undefined,
      country: country || undefined,
      view: narrowed ? undefined : view,
      party: party || undefined,
      position: position || undefined,
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

  const heading = () => {
    if (search) return `Everyone on file matching "${search}".`
    if (category && country) return `${CATEGORIES.find(c => c.value === category)?.plural} · ${country}.`
    if (category) return `${CATEGORIES.find(c => c.value === category)?.plural}, everywhere.`
    if (country) return `Everyone on file from ${country}.`
    return PRIMARY.find(v => v.key === view)?.blurb || ''
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Files</p>
        <h1>Browse</h1>
        <p>{heading()} <span className="mono">{total.toLocaleString()}</span> on file.</p>
      </div>

      <div className="viewbar">
        <div className="viewbar__views">
          {PRIMARY.map(v => (
            <button key={v.key} className={`chip${!narrowed && view === v.key ? ' is-active' : ''}`} onClick={() => onView(v.key)}>{v.label}</button>
          ))}
        </div>
        <div className="viewbar__narrow">
          <select className={`select select--quiet${category ? ' is-active' : ''}`} value={category} onChange={e => onCategory(e.target.value)} aria-label="Category">
            <option value="">Category</option>
            {NARROW_CATEGORIES.filter(c => (meta?.categories?.find((m: any) => m.key === c.value)?.count || 0) > 0).map(c => (
              <option key={c.value} value={c.value}>{c.plural}</option>
            ))}
          </select>
          <select className={`select select--quiet${country ? ' is-active' : ''}`} value={country} onChange={e => onCountry(e.target.value)} aria-label="Country">
            <option value="">Country</option>
            {meta?.countries?.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="row" style={{ gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search everyone on file"
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
              <label className="label">Party / organisation</label>
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
