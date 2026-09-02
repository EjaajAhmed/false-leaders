export default function LevelBadge({ level }: { level: string }) {
  const known = ['confirmed', 'likely', 'maybe', 'speculative'].includes(level) ? level : 'speculative'
  return <span className={`badge badge--${known}`}>{known}</span>
}
