import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getLeaderboard, getRecent } from '../api/politicians'
import ArticleCarousel from '../components/ArticleCarousel'

function ScoreBadge({ score }: { score: number }) {
  const positive = score >= 0
  return (
    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, background: positive ? '#e6f4ea' : '#fce8e8', color: positive ? '#1e7e34' : '#c0392b' }}>
      {positive ? '+' : ''}{score}
    </span>
  )
}

export default function Home() {
  const { data: leaderboard } = useQuery({ queryKey: ['leaderboard'], queryFn: getLeaderboard })
  const { data: recent } = useQuery({ queryKey: ['recent'], queryFn: getRecent })

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>

      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '4rem', margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '0.05em', lineHeight: 1 }}>
          FalseLeaders
        </h1>
        <p style={{ color: '#888', marginTop: '0.5rem', fontFamily: 'var(--font-body)', fontSize: '1rem' }}>
          Track, rate, and comment on politicians. Hold them accountable.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <Link to="/browse" style={{ padding: '0.6rem 1.5rem', background: '#1a1a1a', color: '#f5f0e8', borderRadius: '8px', textDecoration: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
            Browse politicians
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>

        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '1rem', borderBottom: '2px solid #1a1a1a', paddingBottom: '0.5rem', letterSpacing: '0.05em' }}>
            Leaderboard
          </h2>
          {!leaderboard && <p style={{ color: '#aaa' }}>Loading...</p>}
          {leaderboard?.length === 0 && <p style={{ color: '#aaa' }}>No votes yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {leaderboard?.map((p: any, i: number) => (
              <Link key={p.id} to={`/politicians/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', border: '1px solid #ddd8cf', borderRadius: '8px', background: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ width: '24px', textAlign: 'center', fontWeight: 500, color: i < 3 ? '#1a1a1a' : '#aaa', fontFamily: 'var(--font-display)', fontSize: '1.1rem', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-body)' }}>{p.name}</p>
                    <p style={{ margin: 0, color: '#888', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>{p.party}</p>
                  </div>
                  <ScoreBadge score={Number(p.score)} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '1rem', borderBottom: '2px solid #1a1a1a', paddingBottom: '0.5rem', letterSpacing: '0.05em' }}>
            Recently added
          </h2>
          {!recent && <p style={{ color: '#aaa' }}>Loading...</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recent?.map((p: any) => (
              <Link key={p.id} to={`/politicians/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ padding: '0.65rem 0.75rem', border: '1px solid #ddd8cf', borderRadius: '8px', background: 'rgba(255,255,255,0.5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', fontFamily: 'var(--font-body)' }}>{p.name}</p>
                    <span style={{ fontSize: '0.75rem', color: '#aaa', fontFamily: 'var(--font-body)' }}>{p.comment_count} comments</span>
                  </div>
                  <p style={{ margin: '0.1rem 0 0', color: '#888', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>{p.party} — {p.region}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '1rem', borderBottom: '2px solid #1a1a1a', paddingBottom: '0.5rem', letterSpacing: '0.05em' }}>
        Latest articles
      </h2>
      <ArticleCarousel />
    </div>
  )
}