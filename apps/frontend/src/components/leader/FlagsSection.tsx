import { useQuery } from '@tanstack/react-query'
import { getLeaderFlags } from '../../api/politicians'
import NetworkGraph from '../NetworkGraph'
import { Redacted, Skeleton } from '../Redaction'
import { formatDate } from '../../lib/format'

export function useFlags(leaderId: string) {
  return useQuery({ queryKey: ['flags', leaderId], queryFn: () => getLeaderFlags(leaderId), staleTime: 60 * 60 * 1000 })
}

const entityUrl = (id: string) => `https://www.opensanctions.org/entities/${encodeURIComponent(id)}/`

export function flagsHeadline(f: any) {
  if (!f) return { headline: 'Not yet checked', summary: 'OpenSanctions has not been checked for this record.' }
  const flags: any[] = f.flags || []
  const sanctions = flags.filter(x => x.kind === 'sanction')
  const crime = flags.filter(x => x.kind === 'crime')
  const pep = flags.some(x => x.kind === 'pep')
  const authorities = new Set(sanctions.map(x => x.authority || x.dataset).filter(Boolean))
  const checked = f.checked_at ? `checked ${formatDate(f.checked_at)}` : 'not yet checked'
  if (sanctions.length) {
    return {
      headline: `Sanctioned · ${authorities.size} authorit${authorities.size === 1 ? 'y' : 'ies'}`,
      summary: `${sanctions.length} sanctions listing${sanctions.length === 1 ? '' : 's'} in OpenSanctions (${[...authorities].slice(0, 4).join(', ')}${authorities.size > 4 ? '…' : ''}). ${f.edges?.length ? `${f.edges.length} connected entities on record. ` : ''}Listings are decisions of the issuing governments; they are not court findings. OpenSanctions ${checked}.`,
    }
  }
  if (crime.length) return { headline: 'Flagged in crime-related lists', summary: `${crime.length} record${crime.length === 1 ? '' : 's'} with a crime-related topic in OpenSanctions. Details and sources below. OpenSanctions ${checked}.` }
  if (!f.checked_at) return { headline: 'Not yet checked', summary: 'The weekly OpenSanctions check has not run for this record yet.' }
  return {
    headline: pep ? 'No sanctions · politically exposed person' : 'No sanctions listings',
    summary: `${pep ? 'Listed as a politically exposed person, which is expected for anyone holding public office and is not a finding. ' : ''}Not found in OpenSanctions' consolidated sanctions data, ${checked}. Absence from a list is not a clean bill.`,
  }
}

export default function FlagsSection({ leaderId, name }: { leaderId: string; name: string }) {
  const { data: f, isLoading } = useFlags(leaderId)
  if (isLoading) return <Skeleton lines={4} />
  if (!f) return <Redacted label="OpenSanctions unavailable" />
  const flags: any[] = f.flags || []
  const sanctions = flags.filter(x => x.kind === 'sanction')
  const others = flags.filter(x => x.kind !== 'sanction')
  const edges: any[] = f.edges || []

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      {sanctions.length === 0 && others.length === 0 && (
        <p className="small muted">No records. {f.checked_at ? `Checked against OpenSanctions on ${formatDate(f.checked_at)}.` : ''}</p>
      )}
      {sanctions.length > 0 && (
        <table className="datatable" style={{ marginTop: 0 }}>
          <thead><tr><th>Authority</th><th>Programme</th><th>Listed</th><th>Source</th></tr></thead>
          <tbody>
            {sanctions.map((s, i) => (
              <tr key={i}>
                <td>{s.authority || s.dataset || '—'}{s.reason ? <div className="tiny muted" style={{ marginTop: '0.2rem', maxWidth: '40ch' }}>{s.reason.slice(0, 220)}{s.reason.length > 220 ? '…' : ''}</div> : null}</td>
                <td className="small">{s.program || '—'}</td>
                <td className="mono small">{s.listing_date || s.start_date || '—'}</td>
                <td><a href={s.source_url} target="_blank" rel="noopener noreferrer" className="mono tiny" style={{ borderBottom: '1px solid var(--border-strong)' }}>Open</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {others.length > 0 && (
        <div className="stack" style={{ gap: '0.4rem' }}>
          {others.map((o, i) => (
            <div key={i} className="row row--between card card--tight">
              <span className="small"><span className={`badge ${o.kind === 'crime' ? 'badge--confirmed' : 'badge--outline'}`} style={{ marginRight: '0.6rem' }}>{o.kind === 'pep' ? 'PEP' : o.kind}</span>{o.program || o.dataset}</span>
              <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="mono tiny muted" style={{ borderBottom: '1px solid var(--border-strong)' }}>Open</a>
            </div>
          ))}
        </div>
      )}
      {edges.length > 0 && <NetworkGraph name={name} edges={edges} entityUrl={entityUrl} />}
      <p className="section__caption">
        Source: <a href={f.opensanctions_id ? entityUrl(f.opensanctions_id) : 'https://www.opensanctions.org/'} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>OpenSanctions</a> (CC BY-NC 4.0, aggregating official sanctions lists and PEP data), {f.checked_at ? `checked ${formatDate(f.checked_at)}` : 'not yet checked'}. Matches are by Wikidata identifier where available, otherwise by name and birth date; the match tier is recorded with each flag.
      </p>
    </div>
  )
}
