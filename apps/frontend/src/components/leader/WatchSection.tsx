import { useQuery } from '@tanstack/react-query'
import { getLeaderWatch } from '../../api/politicians'
import LineChart from '../LineChart'
import { Redacted, Skeleton } from '../Redaction'
import { formatDate } from '../../lib/format'

export function useWatch(leaderId: string) {
  return useQuery({ queryKey: ['watch', leaderId], queryFn: () => getLeaderWatch(leaderId), staleTime: 60 * 60 * 1000 })
}

const fmt = (s: any, v: number | null) => {
  if (v == null) return '—'
  if (s.indicator === 'NY.GDP.PCAP.KD') return `$${Math.round(v).toLocaleString()}`
  if (s.kind === 'rate') return `${v.toFixed(1)}%`
  return v.toFixed(1)
}
const pct = (a: number | null, b: number | null) => (a == null || b == null || !a ? null : ((b - a) / a) * 100)
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`

export function watchHeadline(w: any) {
  if (!w || !w.series?.length) {
    return { headline: 'No country data', summary: w?.reason || 'No World Bank indicators are available for this record.' }
  }
  const gdp = w.series.find((s: any) => s.indicator === 'NY.GDP.PCAP.KD')
  const base = w.base_year
  const sameYear = gdp && gdp.base_year != null && gdp.latest_year != null && gdp.latest_year <= gdp.base_year
  let headline: string
  if (!gdp) headline = 'Partial country data'
  else if (!base) headline = `GDP per capita ${fmt(gdp, gdp.latest_value)} (${gdp.latest_year})`
  else if (sameYear) headline = `Term began ${base} · no full year of data yet`
  else {
    const p = pct(gdp.base_value, gdp.latest_value)
    headline = p == null ? 'GDP per capita: no baseline' : `GDP per capita ${signed(p)}% since ${gdp.base_year}`
  }
  const parts = w.series
    .filter((s: any) => s.indicator !== 'NY.GDP.PCAP.KD' && s.base_value != null && s.latest_value != null && s.latest_year > s.base_year)
    .map((s: any) => `${s.label.toLowerCase()} ${fmt(s, s.base_value)} → ${fmt(s, s.latest_value)}`)
  const summary = parts.length
    ? `In ${w.country}, between ${Math.min(...w.series.map((s: any) => s.base_year).filter(Boolean))} and the latest published year: ${parts.join(', ')}. These are trends during the term, not outcomes the leader produced.`
    : `The World Bank has published ${w.country} data only up to the year the term began. Nothing can be compared yet.`
  return { headline, summary }
}

export default function WatchSection({ leaderId }: { leaderId: string }) {
  const { data: w, isLoading } = useWatch(leaderId)
  if (isLoading) return <Skeleton lines={5} />
  if (!w || !w.series?.length) return <Redacted label={w?.reason || 'No World Bank data'} />

  const series = w.series
    .filter((s: any) => s.points.some((p: any) => p.indexed != null))
    .map((s: any) => ({
      key: s.indicator, label: s.indicator === 'NY.GDP.PCAP.KD' ? 'GDP/capita' : s.indicator === 'SP.DYN.LE00.IN' ? 'Life exp.' : s.label, highlight: s.indicator === 'NY.GDP.PCAP.KD',
      points: s.points.filter((p: any) => p.indexed != null).map((p: any) => ({ x: p.year, y: p.indexed })),
    }))
  const fetched = w.series[0]?.fetched_at

  return (
    <div>
      {series.length > 0 ? (
        <LineChart
          series={series}
          baseline={100}
          marker={w.base_year ? { x: w.base_year, label: 'took office' } : undefined}
          yFormat={v => `${Math.round(v)}`}
          ariaLabel={`Four World Bank indicators for ${w.country}, each indexed to 100 in ${w.base_year}: ${series.map((s: any) => s.label).join(', ')}.`}
          caption={`Each line is indexed to 100 in ${w.base_year || 'the first year shown'}, the year the term began, so they can share one axis. GDP per capita is highlighted. The chart shows what happened in ${w.country} during the term. It does not show that the leader caused any of it.`}
        />
      ) : <Redacted label="No data since the term began" />}

      <table className="datatable">
        <thead>
          <tr><th>Indicator</th><th className="num">{w.base_year ? `At start (${w.base_year})` : 'Start'}</th><th className="num">Latest</th><th className="num">Change</th></tr>
        </thead>
        <tbody>
          {w.series.map((s: any) => {
            const change = s.kind === 'rate'
              ? (s.base_value != null && s.latest_value != null ? `${signed(s.latest_value - s.base_value)} pts` : '—')
              : (() => { const p = pct(s.base_value, s.latest_value); return p == null ? '—' : `${signed(p)}%` })()
            return (
              <tr key={s.indicator}>
                <td>{s.label} <span className="dim tiny">({s.unit})</span></td>
                <td className="num">{fmt(s, s.base_value)}{s.base_year && s.base_year !== w.base_year ? <span className="dim tiny"> {s.base_year}</span> : null}</td>
                <td className="num">{fmt(s, s.latest_value)} <span className="dim tiny">{s.latest_year}</span></td>
                <td className="num">{change}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="section__caption">
        Source: <a href={w.series[0].source_url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>World Bank Open Data</a> (CC BY 4.0), fetched {fetched ? formatDate(fetched) : '—'}. Annual data; the latest year is usually one to two years behind.
      </p>
    </div>
  )
}
