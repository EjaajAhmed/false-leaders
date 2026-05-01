import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getPoliticians, getPoliticiansMeta } from '../api/politicians'
import TruthScore from '../components/TruthScore'

export default function Browse() {
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [party, setParty] = useState('')
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [minTruth, setMinTruth] = useState('')
  const [maxTruth, setMaxTruth] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  const activeFilterCount = [country, party, minAge, maxAge, minTruth, maxTruth].filter(Boolean).length

  const clearFilters = () => {
    setCountry('')
    setParty('')
    setMinAge('')
    setMaxAge('')
    setMinTruth('')
    setMaxTruth('')
    setPage(1)
  }

  const handleSearchChange = (val: string) => { setSearch(val); setPage(1) }
  const handleFilterChange = (setter: (v: string) => void, val: string) => { setter(val); setPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['politicians', search, country, party, minAge, maxAge, minTruth, maxTruth, page],
    queryFn: () => getPoliticians({
      search: search || undefined,
      country: country || undefined,
      party: party || undefined,
      min_age: minAge ? Number(minAge) : undefined,
      max_age: maxAge ? Number(maxAge) : undefined,
      min_truth: minTruth ? Number(minTruth) : undefined,
      max_truth: maxTruth ? Number(maxTruth) : undefined,
      page,
      limit: 20
    }),
    staleTime: 300
  })

  const politicians = data?.politicians || []
  const totalPages = data?.totalPages || 1
  const total = data?.total || 0

  const { data: meta } = useQuery({
    queryKey: ['politicians-meta'],
    queryFn: getPoliticiansMeta
  })

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Politicians</h1>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>Search, filter, and browse profiles. {total > 0 && `${total} total.`}</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          placeholder="Search by name, party, region..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.95rem', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }}
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: '0.65rem 1rem',
            border: `1px solid ${activeFilterCount > 0 ? '#1a1a1a' : '#ddd'}`,
            borderRadius: '8px',
            background: activeFilterCount > 0 ? '#1a1a1a' : 'white',
            color: activeFilterCount > 0 ? 'white' : '#555',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap'
          }}
        >
          Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters && (
        <div style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px', marginBottom: '1rem', background: '#fafafa' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Country</label>
              <select
                value={country}
                onChange={e => handleFilterChange(setCountry, e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', background: 'white' }}
              >
                <option value="">All countries</option>
                {meta?.countries?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Party</label>
              <select
                value={party}
                onChange={e => handleFilterChange(setParty, e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', background: 'white' }}
              >
                <option value="">All parties</option>
                {meta?.parties?.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Age range</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number" placeholder="Min" value={minAge}
                  onChange={e => handleFilterChange(setMinAge, e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
                />
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>to</span>
                <input
                  type="number" placeholder="Max" value={maxAge}
                  onChange={e => handleFilterChange(setMaxAge, e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>TruthScore range (0–100)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number" placeholder="Min" min={0} max={100} value={minTruth}
                  onChange={e => handleFilterChange(setMinTruth, e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
                />
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>to</span>
                <input
                  type="number" placeholder="Max" min={0} max={100} value={maxTruth}
                  onChange={e => handleFilterChange(setMaxTruth, e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
                />
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {isLoading && <p style={{ color: '#aaa' }}>Searching...</p>}
      {!isLoading && politicians.length === 0 && (
        <p style={{ color: '#888' }}>No politicians found{search ? ` for "${search}"` : ''}.</p>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {politicians.map((p: any) => (
          <Link key={p.id} to={`/politicians/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: '1rem 1.25rem', border: '1px solid #eee', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{p.name}</h2>
                  <p style={{ margin: '0.2rem 0 0', color: '#888', fontSize: '0.85rem' }}>
                    {p.party} — {p.region}{p.country ? `, ${p.country}` : ''}
                    {p.age ? ` · Age ${p.age}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0, marginLeft: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', background: '#f3f3f3', padding: '0.2rem 0.6rem', borderRadius: '20px', color: '#555' }}>
                    {p.position}
                  </span>
                  {p.truth_score != null && <TruthScore score={Number(p.truth_score)} size="sm" />}
                </div>
              </div>
              {p.bio && (
                <p style={{ margin: '0.5rem 0 0', color: '#555', fontSize: '0.875rem' }}>
                  {p.bio.length > 120 ? p.bio.slice(0, 120) + '...' : p.bio}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '0.4rem 0.9rem', border: '1px solid #ddd', borderRadius: '6px', background: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#ccc' : '#111' }}
          >
            ←
          </button>
          <span style={{ fontSize: '0.9rem', color: '#888' }}>
            Page {page} of {totalPages} · {total} politicians
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '0.4rem 0.9rem', border: '1px solid #ddd', borderRadius: '6px', background: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#ccc' : '#111' }}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}