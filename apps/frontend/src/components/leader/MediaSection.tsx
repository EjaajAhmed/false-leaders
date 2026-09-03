import { useQuery } from '@tanstack/react-query'
import { getLeaderMedia } from '../../api/politicians'
import LineChart from '../LineChart'
import { Redacted, Skeleton } from '../Redaction'
import { formatDate } from '../../lib/format'

export function useMedia(leaderId: string) {
  return useQuery({ queryKey: ['media', leaderId], queryFn: () => getLeaderMedia(leaderId), staleTime: 30 * 60 * 1000 })
}

const dayNum = (d: string) => Math.round(new Date(d + 'T00:00:00Z').getTime() / 86400000)
const dayLabel = (n: number) => { const d = new Date(n * 86400000); return `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}` }
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)

export function mediaHeadline(m: any) {
  const s = m?.summary
  if (!s) return { headline: 'No coverage data', summary: 'GDELT has not been queried for this record yet, or the index was unavailable. The nightly job covers world leaders and the top figures first.' }
  const negShare = pct(s.negative_30d, s.articles_30d)
  const headline = `${Number(s.articles_30d).toLocaleString()} articles · ${negShare == null ? 'no tone data' : `${negShare}% negative`} · 30 days`
  const home = s.home_articles != null && s.home_articles > 0 ? pct(s.home_negative, s.home_articles) : null
  const abroad = s.abroad_articles != null && s.abroad_articles > 0 ? pct(s.abroad_negative, s.abroad_articles) : null
  const spikes: any[] = m.spikes || []
  const parts = []
  if (home != null && abroad != null) parts.push(`${home}% of ${s.home_country} coverage was markedly negative against ${abroad}% elsewhere`)
  if (spikes.length) parts.push(`coverage spiked to ${spikes[0].ratio}× normal on ${formatDate(spikes[0].day)}`)
  const summary = `${parts.length ? parts.join('; ') + '. ' : ''}"Negative" means GDELT scored the article's language below −2 on its tone scale. Tone measures wording, not truth or wrongdoing.`
  return { headline, summary }
}

export default function MediaSection({ leaderId, isAdmin }: { leaderId: string; isAdmin?: boolean }) {
  const { data: m, isLoading } = useMedia(leaderId)
  if (isLoading) return <Skeleton lines={5} />
  if (!m?.summary) return <Redacted label="Not yet queried" />
  const s = m.summary
  const daily: any[] = m.daily || []
  const volume = daily.map(d => ({ x: dayNum(d.day), y: Number(d.articles) }))
  const negShare = daily.filter(d => Number(d.articles) >= 5).map(d => ({ x: dayNum(d.day), y: Math.round((Number(d.negative) / Number(d.articles)) * 100) }))
  const spikes: any[] = m.spikes || []
  const spikeDays = spikes.map(sp => dayNum(sp.day))
  const home = s.home_articles != null && s.home_articles > 0 ? pct(s.home_negative, s.home_articles) : null
  const abroad = s.abroad_articles != null && s.abroad_articles > 0 ? pct(s.abroad_negative, s.abroad_articles) : null

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Coverage volume · 90 days · articles per day</div>
        <LineChart
          series={[{ key: 'vol', label: 'Articles', points: volume, highlight: true }]}
          marks={spikeDays}
          xFormat={dayLabel}
          ariaLabel={`Daily article count mentioning this person over the last 90 days, ${spikes.length} spike${spikes.length === 1 ? '' : 's'} flagged.`}
          caption="English-language articles per day in GDELT's monitored sources. Red squares mark days at least three times the median of the previous two weeks. Volume shows attention, not approval or blame."
        />
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Negative-tone share · % of articles below −2 on GDELT's tone scale</div>
        {negShare.length > 1 ? (
          <LineChart
            series={[{ key: 'neg', label: 'Negative %', points: negShare, highlight: true }]}
            xFormat={dayLabel}
            yFormat={v => `${Math.round(v)}%`}
            ariaLabel="Daily share of coverage with markedly negative tone."
            caption="GDELT tone scores the emotional wording of an article, not its accuracy. Days with fewer than five articles are omitted. Most political coverage sits below zero."
          />
        ) : <Redacted label="Too little coverage for a tone series" />}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Home vs abroad · 30 days</div>
          {home != null || abroad != null ? (
            <table className="datatable" style={{ marginTop: 0 }}>
              <thead><tr><th>Sources</th><th className="num">Articles</th><th className="num">Negative</th></tr></thead>
              <tbody>
                <tr><td>{s.home_country}</td><td className="num">{s.home_articles ?? '—'}</td><td className="num">{home == null ? '—' : `${home}%`}</td></tr>
                <tr><td>Everywhere else</td><td className="num">{s.abroad_articles ?? '—'}</td><td className="num">{abroad == null ? '—' : `${abroad}%`}</td></tr>
              </tbody>
            </table>
          ) : <Redacted label="No home-country breakdown" />}
          <p className="section__caption">Source country is where the outlet is based, as classified by GDELT.</p>
        </div>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Where coverage comes from · sample of {s.sample_size} recent articles</div>
          {s.source_countries?.length ? (
            <table className="datatable" style={{ marginTop: 0 }}>
              <thead><tr><th>Country</th><th className="num">Share</th></tr></thead>
              <tbody>{s.source_countries.map((c: any) => <tr key={c.country}><td>{c.country}</td><td className="num">{c.share}%</td></tr>)}</tbody>
            </table>
          ) : <Redacted label="No sample" />}
        </div>
      </div>

      {spikes.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Coverage spikes{isAdmin ? ' · drafts visible to admins' : ''}</div>
          <div className="stack">
            {spikes.map((sp: any) => (
              <div key={sp.id} className="post">
                <div className="post__head">
                  <div className="post__who">
                    <span className="post__prole">{formatDate(sp.day)}</span>
                    <span className="mono tiny muted">{sp.articles} articles · {sp.ratio}× the two-week median</span>
                  </div>
                  {sp.status !== 'published' && <span className="badge badge--outline">{sp.status}</span>}
                </div>
                {sp.summary ? <p className="post__body">{sp.summary}</p> : <p className="post__body dim">No caption.</p>}
                <div className="stack" style={{ gap: '0.3rem', marginTop: '0.6rem' }}>
                  {(sp.headlines || []).slice(0, 5).map((h: any, i: number) => (
                    <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="small" style={{ color: 'var(--muted)' }}>{h.title} <span className="dim">· {h.source}</span></a>
                  ))}
                </div>
                <p className="section__caption">Caption drafted from that day's headlines and reviewed by a person before publication. It describes what was written about, not what happened.</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="section__caption">
        Source: <a href={s.source_url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>GDELT 2.0 DOC API</a>, fetched {formatDate(s.fetched_at)}. GDELT monitors online news in many languages; only English-language sources are counted here.
      </p>
    </div>
  )
}
