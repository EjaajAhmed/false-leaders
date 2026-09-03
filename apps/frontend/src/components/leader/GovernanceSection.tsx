import { useQuery } from '@tanstack/react-query'
import { getLeaderGovernance } from '../../api/politicians'
import LineChart from '../LineChart'
import { Redacted, Skeleton } from '../Redaction'
import { formatDate } from '../../lib/format'

export function useGovernance(leaderId: string) {
  return useQuery({ queryKey: ['governance', leaderId], queryFn: () => getLeaderGovernance(leaderId), staleTime: 60 * 60 * 1000 })
}

const num = (v: number | null, d: number) => (v == null ? '—' : v.toFixed(d))
const signed = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`

/** Change since the term began; falls back to the earliest year the index covers and says so. */
function change(s: any): { delta: number | null; from: number | null; sinceTerm: boolean } {
  if (s.delta != null) return { delta: s.delta, from: s.base_year, sinceTerm: true }
  const first = s.points[0]
  if (first && s.latest_year > first.year && s.latest_value != null) return { delta: Math.round((s.latest_value - first.value) * 1000) / 1000, from: first.year, sinceTerm: false }
  return { delta: null, from: null, sinceTerm: false }
}

export function governanceHeadline(g: any) {
  if (!g || !g.series?.length) return { headline: 'No governance indices', summary: g?.reason || 'None of the four indices covers this record.' }
  const withTerm = g.series.map((s: any) => ({ s, c: change(s) })).filter((x: any) => x.c.delta != null)
  if (withTerm.length === 0) {
    return { headline: g.base_year ? `Term began ${g.base_year} · no later index year yet` : 'No comparable years', summary: `Latest published values for ${g.country}: ${g.series.map((s: any) => `${s.short.toLowerCase()} ${num(s.latest_value, s.decimals)} (${s.latest_year})`).join(', ')}. Annual indices lag by a year or more.` }
  }
  const dem = withTerm.find((x: any) => x.s.code === 'VDEM_LIBDEM') || withTerm[0]
  const fell = withTerm.filter((x: any) => x.c.delta < 0).length
  const headline = `${dem.s.short} ${signed(dem.c.delta, dem.s.decimals)} ${dem.c.sinceTerm ? `since ${dem.c.from}` : `since ${dem.c.from} (earliest available)`}`
  const rest = withTerm.filter((x: any) => x !== dem).map((x: any) => `${x.s.short.toLowerCase()} ${signed(x.c.delta, x.s.decimals)}`)
  const summary = `${fell} of ${withTerm.length} indices fell over the period${rest.length ? `: ${rest.join(', ')}` : ''}. Higher is better on all of them. They measure ${g.country} as a whole and do not isolate one person's effect.`
  return { headline, summary }
}

export default function GovernanceSection({ leaderId }: { leaderId: string }) {
  const { data: g, isLoading } = useGovernance(leaderId)
  if (isLoading) return <Skeleton lines={5} />
  if (!g || !g.series?.length) return <Redacted label={g?.reason || 'No index data'} />

  return (
    <div>
      <div className="grid-2" style={{ gap: '1.25rem' }}>
        {g.series.map((s: any) => {
          const c = change(s)
          return (
            <div key={s.code} className="card" style={{ padding: '1rem 1.1rem' }}>
              <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="eyebrow">{s.label} <span className="dim">· {s.scale}</span></div>
                  <div className="section__headline" style={{ fontSize: '1.7rem', margin: '0.3rem 0 0' }}>
                    {c.delta == null ? <span className="muted">no comparison</span> : <span className={c.delta < 0 ? 'delta-down' : ''} style={{ fontFamily: 'var(--font-display)' }}>{signed(c.delta, s.decimals)}</span>}
                  </div>
                  <div className="mono tiny muted" style={{ marginTop: '0.2rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {c.delta == null ? `latest ${num(s.latest_value, s.decimals)} (${s.latest_year})` : `${num(c.sinceTerm ? s.base_value : s.points[0].value, s.decimals)} (${c.from}) → ${num(s.latest_value, s.decimals)} (${s.latest_year})${c.sinceTerm ? '' : ' · earliest year the index covers'}`}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <LineChart
                  series={[{ key: s.code, label: s.short, points: s.points.map((p: any) => ({ x: p.year, y: p.value })), highlight: true }]}
                  marker={g.base_year ? { x: g.base_year, label: 'took office' } : undefined}
                  yFormat={v => v.toFixed(s.decimals)}
                  ariaLabel={`${s.label} for ${g.country}, ${s.points[0]?.year}–${s.latest_year}.`}
                  caption={`${s.original}. ${s.source_name}, ${s.license}. Fetched ${formatDate(s.fetched_at)}. A country-level index; it does not attribute change to any individual.`}
                />
              </div>
              <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="mono tiny" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border-strong)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Open source</a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
