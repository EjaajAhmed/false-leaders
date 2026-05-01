import { useState, useEffect } from 'react'

const ARTICLES = [
  { id: 1, title: 'Mark Carney wins federal election', source: 'CBC News', url: 'https://cbc.ca', date: 'Apr 28, 2026' },
  { id: 2, title: 'Conservative party debates future direction', source: 'Globe and Mail', url: 'https://theglobeandmail.com', date: 'Apr 27, 2026' },
  { id: 3, title: 'New housing policy announced by Liberal government', source: 'National Post', url: 'https://nationalpost.com', date: 'Apr 26, 2026' },
]

export default function ArticleCarousel() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % ARTICLES.length)
        setAnimating(false)
      }, 300)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const goTo = (i: number) => {
    setAnimating(true)
    setTimeout(() => {
      setCurrent(i)
      setAnimating(false)
    }, 300)
  }

  const article = ARTICLES[current]

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '2px solid #1a1a1a', paddingBottom: '0.5rem' }}>
        Latest articles
      </h2>

      <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{
          padding: '1.25rem',
          border: '1px solid #eee',
          borderRadius: '10px',
          minHeight: '100px',
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          cursor: 'pointer'
        }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 500, fontSize: '1rem', lineHeight: '1.4' }}>
            {article.title}
          </p>
          <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>{article.source}</p>
          <p style={{ margin: '0.25rem 0 0', color: '#bbb', fontSize: '0.8rem' }}>{article.date}</p>
        </div>
      </a>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '0.75rem' }}>
        {ARTICLES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === current ? '20px' : '8px',
              height: '8px',
              borderRadius: '4px',
              border: 'none',
              background: i === current ? '#1a1a1a' : '#ddd',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>

      <p style={{ color: '#bbb', fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'center' }}>
        Live news integration coming soon
      </p>
    </div>
  )
}