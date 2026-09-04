import { useQuery } from '@tanstack/react-query'
import { getLeaderAttention } from '../../api/politicians'
import LineChart from '../LineChart'
import { Redacted, Skeleton } from '../Redaction'
import { compact, formatDate } from '../../lib/format'

export function useAttention(leaderId: string) {
  return useQuery({ queryKey: ['attention', leaderId], queryFn: () => getLeaderAttention(leaderId), staleTime: 60 * 60 * 1000 })
}

const dayNum = (d: string) => Math.round(new Date(d + 'T00:00:00Z').getTime() / 86400000)
const dayLabel = (n: number) => { const d = new Date(n * 86400000); return `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}` }

export function attentionHeadline(a: any) {
  if (!a || !a.languages?.length) return { headline: 'No page-view data', summary: 'The nightly Wikipedia page-view job has not reached this record yet.' }
  const total = a.total_30d
  const top = a.languages[0]
  const home = a.languages.find((l: any) => l.home)
  const share = (l: any) => (total ? Math.round((l.views_30d / total) * 100) : 0)
  const headline = `${compact(total)} Wikipedia views · 30 days · ${a.languages.length} language${a.languages.length === 1 ? '' : 's'}`
  const parts = [`${top.name} ${share(top)}%`]
  if (home && home !== top) parts.push(`${home.name} (home edition) ${share(home)}%`)
  else if (home && home === top) parts[0] = `${top.name} (home edition) ${share(top)}%`
  const summary = `${parts.join(', ')}. Page views measure curiosity, not approval. Editions counted: ${a.languages.map((l: any) => l.name).join(', ')}.`
  return { headline, summary }
}

export default function AttentionSection({ leaderId }: { leaderId: string }) {
  const { data: a, isLoading } = useAttention(leaderId)
  if (isLoading) return <Skeleton lines={4} />
  if (!a || !a.languages?.length) return <Redacted label="No page-view data yet" />
  const total = a.total_30d
  const series = a.languages.slice(0, 5).map((l: any, i: number) => ({
    key: l.lang, label: l.name, highlight: i === 0,
    points: l.points.map((p: any) => ({ x: dayNum(p.day), y: p.views })),
  }))
  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <LineChart
        series={series}
        xFormat={dayLabel}
        yFormat={v => compact(v)}
        ariaLabel={`Daily Wikipedia page views over 90 days for the top ${series.length} language editions.`}
        caption="Daily views of this person's Wikipedia article, by language edition, over 90 days. The largest edition is highlighted. Spikes usually follow news events; they do not indicate sentiment."
      />
      <table className="datatable" style={{ marginTop: 0 }}>
        <thead><tr><th>Edition</th><th className="num">Views · 30d</th><th className="num">Share</th><th className="num">90d</th></tr></thead>
        <tbody>
          {a.languages.map((l: any) => (
            <tr key={l.lang}>
              <td>{l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>{l.name}</a> : l.name}{l.home && <span className="mono tiny muted" style={{ marginLeft: '0.5rem', letterSpacing: '0.1em' }}>HOME</span>}</td>
              <td className="num">{l.views_30d.toLocaleString()}</td>
              <td className="num">{total ? Math.round((l.views_30d / total) * 100) : 0}%</td>
              <td className="num">{compact(l.views_90d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="section__caption">
        Source: Wikimedia Pageviews API (user traffic only, automated agents excluded), {a.synced_at ? `fetched ${formatDate(a.synced_at)}` : ''}. Editions are chosen from the largest Wikipedias in which an article exists ({a.editions_on_wikidata} on Wikidata in total), plus the home-country edition. "Home" is the main Wikipedia language of the leader's country.
      </p>
    </div>
  )
}
