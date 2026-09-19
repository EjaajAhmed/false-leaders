import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getPoliticians, getPoliticiansMeta } from '../api/politicians'
import LeaderCard from '../components/LeaderCard'
import { Empty, ErrorBox, Loading } from '../components/States'
import { useDebounced, useTitle } from '../lib/hooks'
import Dropdown from '../components/Dropdown'
import { CATEGORIES } from '../lib/format'
import { VIEWS } from '../config'
import type { ViewKey } from '../config'

type Sort = 'prominence' | 'name' | 'rating_asc' | 'rating_desc' | 'newest'
const SORTS: Sort[] = ['prominence', 'name', 'rating_asc', 'rating_desc', 'newest']

// Primary views shown in the bar. Specific categories and countries narrow across everyone on file.
const PRIMARY = VIEWS.filter(v => v.key !== 'all')
const NARROW_CATEGORIES = CATEGORIES.filter(c => c.value !== 'world_leader' && c.value !== 'politician')

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const [country, setCountry] = useState(params.get('country') || '')
  const [view, setView] = useState<ViewKey>((PRIMARY.find(v => v.key === params.get('view'))?.key || 'main') as ViewKey)
  const [party, setParty] = useState(params.get('party') || '')
  const [position, setPosition] = useState(params.get('position') || '')
  const [minAge, setMinAge] = useState(params.get('min_age') || '')
  const [maxAge, setMaxAge] = useState(params.get('max_age') || '')
  const [minTruth, setMinTruth] = useState(params.get('min_rating') || '')
  const [maxTruth, setMaxTruth] = useState(params.get('max_rating') || '')
  const [sort, setSort] = useState<Sort>((SORTS.includes(params.get('sort') as Sort) ? params.get('sort') : 'prominence') as Sort)
  const [showFilters, setShowFilters] = useState(() => ['party', 'position', 'min_age', 'max_age', 'min_rating', 'max_rating'].some(k => params.get(k)))
  const [page, setPage] = useState(Math.max(1, Number(params.get('page')) || 1))
  const q = useDebounced(search, 300)
  useTitle('Browse')

  // Any narrowing (search, category, country) searches everyone on file rather than the current view.
  const narrowed = !!(search || category || country)
  const activeFilterCount = [party, position, minAge, maxAge, minTruth, maxTruth].filter(Boolean).length

  // Everything that shapes the list lives in the URL, so Back from a leader page returns to the same page and filters.
  useEffect(() => {
    const out: Record<string, string> = {}
    const put = (k: string, v: string) => { if (v) out[k] = v }
    put('q', search); put('category', category); put('country', country); if (view !== 'main') out.view = view
    put('party', party); put('position', position); put('min_age', minAge); put('max_age', maxAge); put('min_rating', minTruth); put('max_rating', maxTruth)
    if (sort !== 'prominence') out.sort = sort
    if (page > 1) out.page = String(page)
    // Only navigate when something actually changed, so this can never feed itself.
    if (new URLSearchParams(out).toString() !== params.toString()) setParams(out, { replace: true })
  }, [search, category, country, view, party, position, minAge, maxAge, minTruth, maxTruth, sort, page]) // eslint-disable-line react-hooks/exhaustive-deps
  const sync = (_next?: unknown) => setPage(1)
  const onSearch = (v: string) => { setSearch(v); sync({ q: v }) }
  const onCategory = (c: string) => { setCategory(c); sync({ category: c }) }
  const onCountry = (c: string) => { setCountry(c); sync({ country: c }) }
  const onView = (v: ViewKey) => { setView(v); setCategory(''); setCountry(''); setSearch(''); sync({ view: v, category: '', country: '', q: '' }) }
  const set = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1) }
  const clearFilters = () => { setParty(''); setPosition(''); setMinAge(''); setMaxAge(''); setMinTruth(''); setMaxTruth(''); setPage(1) }

  const { data: meta } = useQuery({ queryKey: ['politicians-meta'], queryFn: getPoliticiansMeta })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['politicians', q, view, category, country, party, position, minAge, maxAge, minTruth, maxTruth, sort, page],
    queryFn: () => getPoliticians({
      search: q || undefined,
      category: category || undefined,
      country: country || undefined,
      view: narrowed ? undefined : view,
      party: party || undefined,
      position: position || undefined,
      min_age: minAge ? Number(minAge) : undefined,
      max_age: maxAge ? Number(maxAge) : undefined,
      min_rating: minTruth ? Number(minTruth) : undefined,
      max_rating: maxTruth ? Number(maxTruth) : undefined,
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
          <Dropdown placeholder="Category" value={category} onChange={onCategory} options={[{ value: '', label: 'Every category' }, ...NARROW_CATEGORIES.filter(c => (meta?.categories?.find((m: any) => m.key === c.value)?.count || 0) > 0).map(c => ({ value: c.value, label: c.plural }))]} />
          <Dropdown placeholder="Country" searchable value={country} onChange={onCountry} options={[{ value: '', label: 'Every country' }, ...((meta?.countries || []) as string[]).map((c: string) => ({ value: c, label: c }))]} />
        </div>
      </div>

      <div className="row" style={{ gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search everyone on file"
          aria-label="Search everyone on file"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        <Dropdown placeholder="Sort" value={sort} onChange={v => { setSort(v as Sort); setPage(1) }} align="right" options={[{ value: 'prominence', label: 'Prominence' }, { value: 'name', label: 'A–Z' }, { value: 'rating_asc', label: 'Lowest rated' }, { value: 'rating_desc', label: 'Highest rated' }, { value: 'newest', label: 'Newest files' }]} />
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
              <label className="label">Community rating</label>
              <div className="row" style={{ gap: '0.5rem' }}>
                <input className="input" type="number" min={0} max={100} placeholder="Min" value={minTruth} onChange={e => set(setMinTruth)(e.target.value)} />
                <span className="dim">–</span>
                <input className="input" type="number" min={0} max={100} placeholder="Max" value={maxTruth} onChange={e => set(setMaxTruth)(e.target.value)} />
              </div>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button className="btn btn--ghost btn--sm" style={{ marginTop: '0.75rem' }} onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      )}

      {isLoading && <Loading />}
      {isError && !data && <ErrorBox message="Could not load the files." onRetry={() => refetch()} />}
      {!isLoading && !isError && leaders.length === 0 && (
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
