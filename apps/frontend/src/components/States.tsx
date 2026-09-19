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

/** A failed request, said plainly, so an outage never reads as "nothing on file". */
export function ErrorBox({ message = 'Could not reach the server.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <span>{message}</span>
      {onRetry && <button type="button" className="btn btn--sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}
