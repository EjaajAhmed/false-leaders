import { useQuery } from '@tanstack/react-query'
import { getApproval } from '../../api/politicians'
import { formatDate } from '../../lib/format'

export function useApproval(leaderId: string) {
  return useQuery({ queryKey: ['approval', leaderId], queryFn: () => getApproval(leaderId), staleTime: 5 * 60 * 1000 })
}

/**
 * External approval polling, shown as its own labelled stat with its source.
 * It is never blended into the community rating.
 */
export default function ApprovalStat({ leaderId }: { leaderId: string }) {
  const { data, isLoading } = useApproval(leaderId)
  const latest = data?.latest
  return (
    <div className="approval" aria-label="External approval polling">
      <div className="approval__label">
        <span className="eyebrow">Approval polling</span>
        <span className="mono tiny dim">external · not part of the community rating</span>
      </div>
      {isLoading ? (
        <span className="mono tiny dim">…</span>
      ) : latest ? (
        <div className="approval__body">
          <span className="approval__value">{Math.round(Number(latest.approve))}<span className="approval__unit">% approve</span></span>
          {latest.disapprove != null && <span className="approval__value approval__value--muted">{Math.round(Number(latest.disapprove))}<span className="approval__unit">% disapprove</span></span>}
          <span className="approval__meta">
            {latest.pollster} · fieldwork to {formatDate(latest.fieldwork_end)}{latest.sample_size ? ` · n=${Number(latest.sample_size).toLocaleString()}` : ''} · <a href={latest.source_url} target="_blank" rel="noopener noreferrer">Source</a>
            {data.polls?.length > 1 ? ` · ${data.polls.length} polls in 12 months` : ''}
          </span>
        </div>
      ) : (
        <span className="approval__empty">No approval polling on file.</span>
      )}
    </div>
  )
}
