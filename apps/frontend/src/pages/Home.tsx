import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStats, getFeed, getLeaderboard, getFeatured } from '../api/politicians'
import FeedList from '../components/FeedList'
import LeaderCard from '../components/LeaderCard'
import Reveal from '../components/Reveal'
import { Loading } from '../components/States'
import { scoreColor } from '../lib/format'

function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) return
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 4)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Hero({ leaders }: { leaders: number }) {
  const inner = useRef<HTMLDivElement>(null)
  const count = useCountUp(leaders)

  useEffect(() => {
    const el = inner.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        el.style.transform = `translateY(${y * 0.22}px)`
        el.style.opacity = String(Math.max(0, 1 - y / 700))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <section className="hero noise">
      <div className="hero__inner" ref={inner}>
        <div className="hero__rule" />
        <p className="eyebrow eyebrow--gold" style={{ marginTop: '1.25rem' }}>FalseLeaders · Civic intelligence</p>
        <h1 className="hero__title">The Proles are <em>watching.</em></h1>
        <p className="hero__counter">
          <strong>{count.toLocaleString()}</strong> leaders under watch
        </p>
        <p className="muted" style={{ maxWidth: '52ch', marginTop: '1.25rem', fontSize: '0.95rem' }}>
          Heads of state, executives, judges, moguls, clerics. Every score is earned, every verdict is public, and every leak is anonymous.
        </p>
        <div className="hero__actions">
          <Link to="/browse" className="btn btn--gold">Open the files</Link>
          <Link to="/feed" className="btn">Read the Wall</Link>
        </div>
      </div>
      <div className="hero__scroll" />
    </section>
  )
}

function Snapshot({ title, to, query, render }: { title: string; to: string; query: any; render: (row: any, i: number) => React.ReactNode }) {
  return (
    <div>
      <div className="section-title">
        <h2 style={{ fontSize: '1.1rem' }}>{title}</h2>
        <Link to={to} className="eyebrow" style={{ whiteSpace: 'nowrap' }}>Full board →</Link>
      </div>
      {query.isLoading && <Loading />}
      {query.data && query.data.length === 0 && <p className="dim small" style={{ padding: '0.5rem 0' }}>No movement recorded this week.</p>}
      {query.data?.slice(0, 5).map(render)}
    </div>
  )
}

export default function Home() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: getStats })
  const feed = useQuery({ queryKey: ['feed', 'home'], queryFn: () => getFeed({ limit: 12 }), refetchInterval: 30000 })
  const condemned = useQuery({ queryKey: ['leaderboard', 'condemned', 5], queryFn: () => getLeaderboard('condemned', 5) })
  const drop = useQuery({ queryKey: ['leaderboard', 'drop', 5], queryFn: () => getLeaderboard('drop', 5) })
  const featured = useQuery({ queryKey: ['featured'], queryFn: getFeatured })

  return (
    <div>
      <Hero leaders={stats.data?.leaders || 0} />

      <div className="page page--wide">
        <div className="home-grid">
          <Reveal>
            <div className="section-title">
              <div>
                <p className="eyebrow">Live</p>
                <h2>The Wall</h2>
              </div>
              <Link to="/feed" className="eyebrow">All events →</Link>
            </div>
            {feed.isLoading ? <Loading /> : <FeedList events={feed.data?.events || []} />}
          </Reveal>

          <Reveal delay={120}>
            <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Leaderboards</p>
            <div className="stack" style={{ gap: '2rem' }}>
              <Snapshot
                title="Most Condemned"
                to="/leaderboard?tab=condemned"
                query={condemned}
                render={(p, i) => (
                  <Link key={p.id} to={`/leaders/${p.id}`} className="lb-row">
                    <span className="lb-row__rank">{String(i + 1).padStart(2, '0')}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="lb-row__name truncate">{p.name}</div>
                      <div className="lb-row__meta truncate">{p.position}</div>
                    </div>
                    <div className="lb-row__value" style={{ color: scoreColor(Number(p.truth_score)) }}>{Math.round(Number(p.truth_score))}</div>
                  </Link>
                )}
              />
              <Snapshot
                title="Biggest Drop"
                to="/leaderboard?tab=drop"
                query={drop}
                render={(p, i) => (
                  <Link key={p.id} to={`/leaders/${p.id}`} className="lb-row">
                    <span className="lb-row__rank">{String(i + 1).padStart(2, '0')}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="lb-row__name truncate">{p.name}</div>
                      <div className="lb-row__meta truncate">{p.position}</div>
                    </div>
                    <div>
                      <div className="lb-row__value delta-down">{p.delta}</div>
                      <div className="lb-row__sub">7 days</div>
                    </div>
                  </Link>
                )}
              />
            </div>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: '3.5rem' }}>
          <div className="section-title">
            <div>
              <p className="eyebrow">Under watch</p>
              <h2>Featured leaders</h2>
            </div>
            <Link to="/browse" className="eyebrow">Browse all →</Link>
          </div>
          {featured.isLoading && <Loading />}
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {featured.data?.map((p: any) => <LeaderCard key={p.id} leader={p} />)}
          </div>
        </Reveal>

        <Reveal style={{ marginTop: '3.5rem' }}>
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {[
              ['Leaders', stats.data?.leaders],
              ['Controversies', stats.data?.controversies],
              ['Verdicts', stats.data?.verdicts],
              ['Leaks', stats.data?.leaks],
              ['Proles', stats.data?.proles],
            ].map(([label, v]) => (
              <div key={String(label)} className="stat">
                <div className="stat__value">{v == null ? '—' : Number(v).toLocaleString()}</div>
                <div className="stat__label eyebrow">{label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  )
}
