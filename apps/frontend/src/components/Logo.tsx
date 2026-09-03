/** Figure at a lectern with a bar across the eyes. */
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="FalseLeaders">
      <circle cx="20" cy="11" r="6.5" fill="#F0E3BE" />
      <rect x="9" y="9" width="22" height="4.6" fill="#0B0A08" />
      <path d="M12 21h16l1.5 4H10.5z" fill="#F0E3BE" />
      <path d="M8 27h24l-2 11H10z" fill="#8E2020" />
      <rect x="18.5" y="16.5" width="3" height="5" fill="#F0E3BE" />
    </svg>
  )
}
