import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import client, { errorMessage } from '../api/client'
import LevelBadge from './LevelBadge'

interface Props { politicianId: string; politicianName: string }
type Group = 'funding' | 'influence' | 'controversies'

export default function AIAnalyzer({ politicianId, politicianName }: Props) {
  const qc = useQueryClient()
  const [urls, setUrls] = useState('')
  const [rawText, setRawText] = useState('')
  const [mode, setMode] = useState<'urls' | 'text'>('urls')
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Record<Group, Set<number>>>({ funding: new Set(), influence: new Set(), controversies: new Set() })

  const analyze = useMutation({
    mutationFn: async () => {
      const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean)
      return (await client.post(`/politicians/${politicianId}/analyze`, { urls: mode === 'urls' ? urlList : [], rawText: mode === 'text' ? rawText : '' })).data
    },
    onSuccess: (data) => {
      setError('')
      setResults(data)
      setSelected({
        funding: new Set(data.funding_sources?.map((_: any, i: number) => i) || []),
        influence: new Set(data.foreign_influence?.map((_: any, i: number) => i) || []),
        controversies: new Set(data.controversies?.map((_: any, i: number) => i) || []),
      })
    },
    onError: e => setError(errorMessage(e)),
  })

  const save = useMutation({
    mutationFn: async () => (await client.post(`/politicians/${politicianId}/analyze/save`, {
      funding_sources: (results.funding_sources || []).filter((_: any, i: number) => selected.funding.has(i)),
      foreign_influence: (results.foreign_influence || []).filter((_: any, i: number) => selected.influence.has(i)),
      controversies: (results.controversies || []).filter((_: any, i: number) => selected.controversies.has(i)),
    })).data,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['politicians-admin'] })
      qc.invalidateQueries({ queryKey: ['politician', politicianId] })
      setResults(null); setUrls(''); setRawText('')
      alert(`Saved. New TruthScore: ${data.new_truth_score}`)
    },
    onError: e => setError(errorMessage(e)),
  })

  const toggle = (g: Group, i: number) => setSelected(prev => {
    const next = new Set(prev[g])
    if (next.has(i)) next.delete(i); else next.add(i)
    return { ...prev, [g]: next }
  })
  const total = selected.funding.size + selected.influence.size + selected.controversies.size

  const item = (g: Group, i: number, content: React.ReactNode) => (
    <label key={i} className="row" style={{ alignItems: 'flex-start', padding: '0.6rem 0.7rem', border: `1px solid ${selected[g].has(i) ? 'var(--gold)' : 'var(--border)'}`, background: 'var(--bg)', cursor: 'pointer', gap: '0.7rem' }}>
      <input type="checkbox" checked={selected[g].has(i)} onChange={() => toggle(g, i)} style={{ marginTop: '0.25rem', accentColor: '#c9a84c' }} />
      <div style={{ minWidth: 0, flex: 1 }}>{content}</div>
    </label>
  )

  return (
    <div className="card" style={{ borderColor: 'rgba(201,168,76,0.3)' }}>
      <div className="section-title">
        <div><p className="eyebrow eyebrow--gold">Analyst</p><h2>Extract intelligence on {politicianName}</h2></div>
      </div>
      <p className="help" style={{ marginBottom: '1rem' }}>Paste article URLs or raw text. The analyst proposes funding sources, foreign ties and controversies. Nothing is saved until you approve it.</p>

      <div className="chips" style={{ marginBottom: '0.75rem' }}>
        <button className={`chip${mode === 'urls' ? ' is-active' : ''}`} onClick={() => setMode('urls')}>URLs</button>
        <button className={`chip${mode === 'text' ? ' is-active' : ''}`} onClick={() => setMode('text')}>Raw text</button>
      </div>
      {mode === 'urls'
        ? <textarea className="textarea mono" rows={4} placeholder={'https://\nhttps://\n(one per line, max 10)'} value={urls} onChange={e => setUrls(e.target.value)} />
        : <textarea className="textarea" rows={6} placeholder="Paste article text" value={rawText} onChange={e => setRawText(e.target.value)} />}
      {error && <div className="error" style={{ marginTop: '0.75rem' }}>{error}</div>}
      <div className="row" style={{ marginTop: '0.75rem' }}>
        <button className="btn btn--gold" disabled={analyze.isPending || (mode === 'urls' ? !urls.trim() : !rawText.trim())} onClick={() => analyze.mutate()}>{analyze.isPending ? 'Analysing' : 'Analyse'}</button>
      </div>

      {results && (
        <div className="stack" style={{ marginTop: '1.5rem', gap: '1.25rem' }}>
          {results.controversies?.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Controversies · {results.controversies.length}</p>
              <div className="stack" style={{ gap: '0.4rem' }}>
                {results.controversies.map((c: any, i: number) => item('controversies', i, <>
                  <div className="row"><LevelBadge level={c.level} /><span className="small" style={{ fontWeight: 500 }}>{c.title}</span></div>
                  <p className="tiny muted" style={{ marginTop: '0.25rem' }}>{c.description}</p>
                </>))}
              </div>
            </div>
          )}
          {results.funding_sources?.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Funding · {results.funding_sources.length}</p>
              <div className="stack" style={{ gap: '0.4rem' }}>
                {results.funding_sources.map((f: any, i: number) => item('funding', i, <>
                  <div className="row row--between"><span className="small" style={{ fontWeight: 500 }}>{f.source_name}</span><span className="mono small">${Number(f.amount || 0).toLocaleString()}</span></div>
                  <p className="tiny muted">{f.source_type}{f.notes ? ` · ${f.notes}` : ''}</p>
                </>))}
              </div>
            </div>
          )}
          {results.foreign_influence?.length > 0 && (
            <div>
              <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Foreign influence · {results.foreign_influence.length}</p>
              <div className="stack" style={{ gap: '0.4rem' }}>
                {results.foreign_influence.map((f: any, i: number) => item('influence', i, <>
                  <div className="row row--between"><span className="small" style={{ fontWeight: 500 }}>{f.country}</span><span className="mono small">{f.influence_score}/100</span></div>
                  <p className="tiny muted">{f.influence_type}{f.notes ? ` · ${f.notes}` : ''}</p>
                </>))}
              </div>
            </div>
          )}
          {!results.controversies?.length && !results.funding_sources?.length && !results.foreign_influence?.length && (
            <p className="dim small">The analyst found nothing usable in that material.</p>
          )}
          <div className="row">
            <button className="btn btn--gold" disabled={total === 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving' : `Save ${total} item${total === 1 ? '' : 's'}`}</button>
            <button className="btn btn--ghost" onClick={() => setResults(null)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  )
}
