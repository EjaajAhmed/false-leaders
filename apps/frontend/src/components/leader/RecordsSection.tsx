import { useQuery } from '@tanstack/react-query'
import { getLeaderRecords } from '../../api/politicians'
import { Redacted, Skeleton } from '../Redaction'
import { compact, formatDate } from '../../lib/format'

export function useRecords(leaderId: string) {
  return useQuery({ queryKey: ['records', leaderId], queryFn: () => getLeaderRecords(leaderId), staleTime: 60 * 60 * 1000 })
}

const KIND_LABEL: Record<string, string> = { votes: 'Votes', money: 'Money', courts: 'Courts' }
const money = (n: any) => (n == null ? '—' : `$${compact(n)}`)

export function recordsHeadline(r: any) {
  if (!r) return { headline: 'Votes, money, courts', summary: 'Loading country records.' }
  if (!r.has_adapters) {
    return { headline: `No adapter for ${r.country || 'this country'} yet`, summary: `Voting, money and court records are pulled per country from official sources. Adapters exist for ${r.adapters_built?.join(', ')}. Nothing here means it has not been built for ${r.country || 'this country'}, not that there is nothing to find.` }
  }
  const ok = r.coverage.filter((c: any) => c.record?.status === 'ok')
  const bits: string[] = []
  for (const c of ok) {
    const s = c.record.summary
    if (c.kind === 'votes') bits.push(`${s.total} recorded votes${s.on_winning_side_pct != null ? `, on the winning side ${s.on_winning_side_pct}%` : ''}`)
    if (c.kind === 'money') bits.push(s.role === 'donor' ? `gave ${money(s.total_itemised)} in itemised federal contributions` : `raised ${money(s.receipts)} for ${s.cycle}`)
    if (c.kind === 'courts') bits.push(`named in ${s.opinions_mentioning?.toLocaleString()} court opinions`)
  }
  const missing = r.coverage.filter((c: any) => !c.adapter).map((c: any) => KIND_LABEL[c.kind].toLowerCase())
  const headline = bits.length ? bits[0].charAt(0).toUpperCase() + bits[0].slice(1) : `${r.country}: no records matched`
  const summary = `${bits.slice(1).map((b: string) => b.charAt(0).toUpperCase() + b.slice(1)).join('. ')}${bits.length > 1 ? '. ' : ''}${missing.length ? `No ${missing.join(' or ')} adapter for ${r.country} yet. ` : ''}Records come from official sources named below.`
  return { headline, summary }
}

function Votes({ rec }: { rec: any }) {
  const s = rec.summary
  const items: any[] = rec.items || []
  return (
    <div>
      <div className="grid-3" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div className="stat"><div className="stat__value">{s.total}</div><div className="stat__label eyebrow">Recorded votes</div></div>
        <div className="stat"><div className="stat__value">{s.yea ?? s.aye} / {s.nay ?? s.no}</div><div className="stat__label eyebrow">For / against</div></div>
        <div className="stat"><div className="stat__value">{s.on_winning_side_pct == null ? '—' : `${s.on_winning_side_pct}%`}</div><div className="stat__label eyebrow">On winning side</div></div>
      </div>
      <table className="datatable" style={{ marginTop: 0 }}>
        <thead><tr><th>Date</th><th>Division</th><th className="num">Vote</th><th className="num">Result</th></tr></thead>
        <tbody>
          {items.map((v, i) => (
            <tr key={i}>
              <td className="mono small" style={{ whiteSpace: 'nowrap' }}>{v.date}</td>
              <td className="small">{v.url ? <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>{v.subject}</a> : v.subject}</td>
              <td className="num mono small">{v.vote}</td>
              <td className="num small muted">{v.result}{v.yeas != null ? ` ${v.yeas}–${v.nays}` : v.ayes != null ? ` ${v.ayes}–${v.noes}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="section__caption">{s.window ? `${s.window}. ` : ''}"On winning side" is the share of recorded votes where the member's side prevailed; a low share usually means opposition, not dissent. {s.riding || s.constituency ? `Seat: ${s.riding || s.constituency}.` : ''}</p>
    </div>
  )
}

function Money({ rec }: { rec: any }) {
  const s = rec.summary
  const items: any[] = rec.items || []
  if (s.role === 'donor') {
    return (
      <div>
        <div className="grid-3" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div className="stat"><div className="stat__value">{money(s.total_itemised)}</div><div className="stat__label eyebrow">Itemised contributions</div></div>
          <div className="stat"><div className="stat__value">{s.contributions}</div><div className="stat__label eyebrow">Transactions</div></div>
          <div className="stat"><div className="stat__value">{s.cycles?.join(' · ')}</div><div className="stat__label eyebrow">Cycles</div></div>
        </div>
        <table className="datatable" style={{ marginTop: 0 }}>
          <thead><tr><th>Recipient committee</th><th className="num">Total</th><th className="num">Latest</th></tr></thead>
          <tbody>{items.map((c, i) => <tr key={i}><td className="small"><a href={c.url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>{c.committee}</a></td><td className="num mono small">{money(c.total)}</td><td className="num mono small">{c.latest}</td></tr>)}</tbody>
        </table>
        <p className="section__caption">Individual contributions itemised by the FEC (over $200), matched by contributor name. {s.truncated ? 'Only the largest 100 transactions were examined. ' : ''}Giving to a committee is a matter of public record, not a finding about the donor.</p>
      </div>
    )
  }
  return (
    <div>
      <div className="grid-3" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div className="stat"><div className="stat__value">{money(s.receipts)}</div><div className="stat__label eyebrow">Receipts · {s.cycle}</div></div>
        <div className="stat"><div className="stat__value">{money(s.disbursements)}</div><div className="stat__label eyebrow">Spent</div></div>
        <div className="stat"><div className="stat__value">{money(s.cash_on_hand)}</div><div className="stat__label eyebrow">Cash on hand</div></div>
      </div>
      {items.length > 0 && (
        <table className="datatable" style={{ marginTop: 0 }}>
          <thead><tr><th>Contributors' employer</th><th className="num">Total</th></tr></thead>
          <tbody>{items.map((e, i) => <tr key={i}><td className="small">{e.employer}</td><td className="num mono small">{money(e.total)}</td></tr>)}</tbody>
        </table>
      )}
      <p className="section__caption">Candidate committee totals as filed with the FEC for the {s.cycle} election ({s.candidate}, {s.office}){s.coverage_end ? `, reports through ${s.coverage_end}` : ''}. Joint fundraising committees, party committees and outside groups are not included, so this understates money raised around a candidate.</p>
    </div>
  )
}

function Courts({ rec }: { rec: any }) {
  const s = rec.summary
  const items: any[] = rec.items || []
  return (
    <div>
      <div className="grid-2" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div className="stat"><div className="stat__value">{s.opinions_mentioning?.toLocaleString()}</div><div className="stat__label eyebrow">Opinions mentioning the name</div></div>
        <div className="stat"><div className="stat__value">{s.as_named_party}</div><div className="stat__label eyebrow">Named party · recent 12</div></div>
      </div>
      <table className="datatable" style={{ marginTop: 0 }}>
        <thead><tr><th>Filed</th><th>Case</th><th>Court</th></tr></thead>
        <tbody>{items.map((c, i) => <tr key={i}><td className="mono small" style={{ whiteSpace: 'nowrap' }}>{c.date}</td><td className="small">{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>{c.case}</a> : c.case}</td><td className="small muted">{c.court}</td></tr>)}</tbody>
      </table>
      <p className="section__caption">Court opinions in CourtListener's database that mention this person's name, newest first. Officials are routinely named in their official capacity; a mention is not an accusation.</p>
    </div>
  )
}

export default function RecordsSection({ leaderId }: { leaderId: string }) {
  const { data: r, isLoading } = useRecords(leaderId)
  if (isLoading) return <Skeleton lines={4} />
  if (!r) return <Redacted label="Records unavailable" />
  if (!r.has_adapters) return <Redacted label={`No adapter built for ${r.country || 'this country'}`} />
  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      {r.coverage.map((c: any) => (
        <div key={c.kind}>
          <div className="row row--between" style={{ marginBottom: '0.6rem' }}>
            <span className="eyebrow">{KIND_LABEL[c.kind]}{c.adapter ? ` · ${c.adapter}` : ''}</span>
            {c.record?.status === 'ok' && <a href={c.record.source_url} target="_blank" rel="noopener noreferrer" className="mono tiny muted" style={{ borderBottom: '1px solid var(--border-strong)' }}>Source · {formatDate(c.record.fetched_at)}</a>}
          </div>
          {!c.adapter && <Redacted label={`No ${c.kind} adapter for ${r.country} yet`} />}
          {c.adapter && !c.record && <Redacted label="Not yet fetched" />}
          {c.record?.status === 'no_match' && <Redacted label={c.record.summary?.reason || 'No matching record'} />}
          {c.record?.status === 'error' && <Redacted label={`Source unavailable: ${c.record.summary?.reason || 'error'}`} />}
          {c.record?.status === 'ok' && c.kind === 'votes' && <Votes rec={c.record} />}
          {c.record?.status === 'ok' && c.kind === 'money' && <Money rec={c.record} />}
          {c.record?.status === 'ok' && c.kind === 'courts' && <Courts rec={c.record} />}
        </div>
      ))}
    </div>
  )
}
