/** Data that is missing or withheld. Names the gap instead of hiding it. */
export function Redacted({ label }: { label: string }) {
  return <span className="redacted-note" role="note">{label}</span>
}

export function RedactRule({ thin = false }: { thin?: boolean }) {
  return <hr className={`redact-rule${thin ? ' redact-rule--thin' : ''}`} aria-hidden="true" />
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => <span key={i} />)}
    </div>
  )
}
