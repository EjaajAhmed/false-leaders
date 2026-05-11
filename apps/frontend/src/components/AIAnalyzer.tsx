import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'

interface Props {
  politicianId: string
  politicianName: string
}

const LEVEL_COLORS: Record<string, string> = {
  confirmed: '#c0392b',
  likely: '#e67e22',
  maybe: '#f39c12',
  speculative: '#95a5a6'
}

const TYPE_COLORS: Record<string, string> = {
  Corporate: '#c0392b', Foreign: '#8e44ad', PAC: '#e67e22',
  Government: '#2980b9', Union: '#16a085', Individual: '#27ae60', Unknown: '#95a5a6'
}

export default function AIAnalyzer({ politicianId, politicianName }: Props) {
  const queryClient = useQueryClient()
  const [urls, setUrls] = useState('')
  const [rawText, setRawText] = useState('')
  const [inputMode, setInputMode] = useState<'urls' | 'text'>('urls')
  const [results, setResults] = useState<any>(null)
  const [selected, setSelected] = useState<{ funding: Set<number>, influence: Set<number>, controversies: Set<number> }>({
    funding: new Set(), influence: new Set(), controversies: new Set()
  })

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean)
      const res = await client.post(`/politicians/${politicianId}/analyze`, {
        urls: inputMode === 'urls' ? urlList : [],
        rawText: inputMode === 'text' ? rawText : ''
      })
      return res.data
    },
    onSuccess: (data) => {
      setResults(data)
      setSelected({
        funding: new Set(data.funding_sources?.map((_: any, i: number) => i) || []),
        influence: new Set(data.foreign_influence?.map((_: any, i: number) => i) || []),
        controversies: new Set(data.controversies?.map((_: any, i: number) => i) || [])
      })
    }
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        funding_sources: (results.funding_sources || []).filter((_: any, i: number) => selected.funding.has(i)),
        foreign_influence: (results.foreign_influence || []).filter((_: any, i: number) => selected.influence.has(i)),
        controversies: (results.controversies || []).filter((_: any, i: number) => selected.controversies.has(i))
      }
      const res = await client.post(`/politicians/${politicianId}/analyze/save`, payload)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['politicians-admin'] })
      setResults(null)
      setUrls('')
      setRawText('')
      alert(`Saved! New TruthScore: ${data.new_truth_score}`)
    }
  })

  const toggleSelected = (type: 'funding' | 'influence' | 'controversies', i: number) => {
    setSelected(prev => {
      const next = new Set(prev[type])
      next.has(i) ? next.delete(i) : next.add(i)
      return { ...prev, [type]: next }
    })
  }

  const totalSelected = selected.funding.size + selected.influence.size + selected.controversies.size

  const containerStyle: React.CSSProperties = {
    padding: '1.5rem', border: '1px solid #d4c5a9', borderRadius: '12px',
    marginBottom: '2rem', background: '#fdfbf7'
  }

  const chipStyle = (color: string): React.CSSProperties => ({
    display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px',
    fontSize: '0.7rem', fontWeight: 700, color: 'white', background: color,
    textTransform: 'uppercase', letterSpacing: '0.04em'
  })

  const cardStyle = (selected: boolean): React.CSSProperties => ({
    padding: '0.75rem 1rem', border: `2px solid ${selected ? '#c9a84c' : '#eee'}`,
    borderRadius: '8px', cursor: 'pointer', background: selected ? '#fffdf5' : 'white',
    transition: 'all 0.15s'
  })

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '1.1rem' }}>🤖</span>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>AI Research — {politicianName}</h2>
      </div>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Paste article URLs or raw text. Gemini will extract funding, foreign influence, and controversies for you to review before saving.
      </p>

      {/* Input mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {(['urls', 'text'] as const).map(mode => (
          <button key={mode} onClick={() => setInputMode(mode)} style={{
            padding: '0.35rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer',
            border: inputMode === mode ? '2px solid #1a1a1a' : '1px solid #ddd',
            background: inputMode === mode ? '#1a1a1a' : 'white',
            color: inputMode === mode ? 'white' : '#555', fontWeight: inputMode === mode ? 600 : 400
          }}>
            {mode === 'urls' ? '🔗 Article URLs' : '📄 Paste Text'}
          </button>
        ))}
      </div>

      {inputMode === 'urls' ? (
        <div>
          <textarea
            placeholder={"Paste one URL per line:\nhttps://cbc.ca/news/article-1\nhttps://globeandmail.com/article-2"}
            value={urls}
            onChange={e => setUrls(e.target.value)}
            rows={5}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0.35rem 0 0' }}>
            Up to 10 URLs. Works best with CBC, Globe and Mail, National Post, Toronto Star.
          </p>
        </div>
      ) : (
        <textarea
          placeholder="Paste the full article text here..."
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          rows={8}
          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', resize: 'vertical' }}
        />
      )}

      <button
        onClick={() => analyzeMutation.mutate()}
        disabled={analyzeMutation.isPending || (!urls.trim() && !rawText.trim())}
        style={{ marginTop: '0.75rem', padding: '0.6rem 1.5rem', background: '#c9a84c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
      >
        {analyzeMutation.isPending ? '⏳ Analyzing...' : '✨ Analyze with AI'}
      </button>

      {analyzeMutation.isError && (
        <p style={{ color: '#c0392b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          {(analyzeMutation.error as any)?.response?.data?.error || 'Analysis failed'}
        </p>
      )}

      {/* Results */}
      {results && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>
              Review extracted data — click to deselect items you don't want to save
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>{totalSelected} item{totalSelected !== 1 ? 's' : ''} selected</span>
          </div>

          {/* Funding */}
          {results.funding_sources?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                💰 Funding Sources ({results.funding_sources.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {results.funding_sources.map((f: any, i: number) => (
                  <div key={i} onClick={() => toggleSelected('funding', i)} style={cardStyle(selected.funding.has(i))}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.source_name}</span>
                        {f.amount > 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#555' }}>${f.amount.toLocaleString()} {f.currency}</span>}
                      </div>
                      <span style={chipStyle(TYPE_COLORS[f.source_type] || '#95a5a6')}>{f.source_type}</span>
                    </div>
                    {f.notes && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#777' }}>{f.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Foreign influence */}
          {results.foreign_influence?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🌍 Foreign Influence ({results.foreign_influence.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {results.foreign_influence.map((inf: any, i: number) => (
                  <div key={i} onClick={() => toggleSelected('influence', i)} style={cardStyle(selected.influence.has(i))}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inf.country}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#777' }}>{inf.influence_type}</span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: inf.influence_score >= 60 ? '#c0392b' : inf.influence_score >= 40 ? '#e67e22' : '#27ae60' }}>
                        Score: {inf.influence_score}
                      </span>
                    </div>
                    {inf.notes && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#777' }}>{inf.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controversies */}
          {results.controversies?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⚠️ Controversies ({results.controversies.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {results.controversies.map((c: any, i: number) => (
                  <div key={i} onClick={() => toggleSelected('controversies', i)} style={cardStyle(selected.controversies.has(i))}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</span>
                      <span style={chipStyle(LEVEL_COLORS[c.level] || '#95a5a6')}>{c.level}</span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#777' }}>{c.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.funding_sources?.length === 0 && results.foreign_influence?.length === 0 && results.controversies?.length === 0 && (
            <p style={{ color: '#888', fontSize: '0.85rem' }}>No relevant data found in these articles. Try adding more sources.</p>
          )}

          {totalSelected > 0 && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={{ padding: '0.6rem 1.5rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
            >
              {saveMutation.isPending ? 'Saving...' : `✅ Save ${totalSelected} selected item${totalSelected !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}