interface Props {
  count: number
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
}

export default function Upvote({ count, active, disabled, onClick, title }: Props) {
  return (
    <button type="button" className={`upvote${active ? ' is-on' : ''}`} onClick={onClick} disabled={disabled} title={title || (disabled ? 'Sign in and verify to upvote' : 'Upvote')}>
      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1 9.5 8h-9z" /></svg>
      <span>{Number(count) || 0}</span>
    </button>
  )
}
