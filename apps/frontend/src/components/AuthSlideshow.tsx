import { useState, useEffect } from 'react'
import loginImage2 from '../assets/loginImage2.jpg'
import registerImage1 from '../assets/registerImage1.jpg'

// Add more images here later and they'll automatically join the rotation
const IMAGES = [loginImage2, registerImage1]

interface Props {
  children?: React.ReactNode
  style?: React.CSSProperties
}

export default function AuthSlideshow({ children, style }: Props) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % IMAGES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      {IMAGES.map((img, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: i === current ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        />
      ))}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.75) 100%)',
        pointerEvents: 'none'
      }} />
      {children && (
        <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          {children}
        </div>
      )}
    </div>
  )
}