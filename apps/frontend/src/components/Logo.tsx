/** Figure at a lectern with a bar across the eyes. Figure and lectern take the current text colour; the bar takes the theme's bar colour. */
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="FalseLeaders" style={{ color: 'var(--heading)' }}>
      <circle cx="20" cy="11" r="6.5" fill="currentColor" />
      <path d="M12 21h16l1.5 4H10.5z" fill="currentColor" />
      <rect x="18.5" y="16.5" width="3" height="5" fill="currentColor" />
      <path d="M8 27h24l-2 11H10z" fill="currentColor" />
      <rect x="9" y="9" width="22" height="4.6" style={{ fill: 'var(--bar)', stroke: 'var(--surface)', strokeWidth: 1 }} />
    </svg>
  )
}
