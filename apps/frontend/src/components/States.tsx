export function Loading({ label = 'Decrypting' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      <span>{label}<span className="blink">_</span></span>
    </div>
  )
}

export function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {sub && <div className="eyebrow">{sub}</div>}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error">{message}</div>
}
