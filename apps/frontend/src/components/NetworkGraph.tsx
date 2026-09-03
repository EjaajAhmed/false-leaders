interface Edge { relation: string; role?: string | null; other_id: string; other_name: string; other_schema?: string | null; other_topics?: string[] }

const REL_LABEL: Record<string, string> = { family: 'Family', associate: 'Associate', ownership: 'Owns / owned by', directorship: 'Director', membership: 'Member', employment: 'Employment', unknownlink: 'Linked', representation: 'Represents' }

/** Radial graph: the leader at the centre, connected entities around them, grouped by relation. */
export default function NetworkGraph({ name, edges, entityUrl }: { name: string; edges: Edge[]; entityUrl: (id: string) => string }) {
  const shown = edges.slice(0, 24)
  const W = 640, H = 420, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38
  const nodes = shown.map((e, i) => {
    const a = (i / shown.length) * Math.PI * 2 - Math.PI / 2
    return { ...e, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, i }
  })
  const short = (s: string) => (s.length > 26 ? s.slice(0, 24) + '…' : s)
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} and ${shown.length} connected entities from OpenSanctions.`}>
        {nodes.map(n => (
          <line key={`l${n.i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={n.relation === 'family' ? '#8E2020' : 'rgba(240,227,190,0.35)'} strokeWidth={n.relation === 'family' ? 1.6 : 1} />
        ))}
        {nodes.map(n => {
          const sanctioned = (n.other_topics || []).includes('sanction')
          const left = n.x < cx - 10, right = n.x > cx + 10
          return (
            <a key={n.i} href={entityUrl(n.other_id)} target="_blank" rel="noopener noreferrer">
              <rect x={n.x - 5} y={n.y - 5} width={10} height={10} fill={sanctioned ? '#8E2020' : n.other_schema === 'Person' ? '#F0E3BE' : '#A89D83'} />
              <text x={left ? n.x - 9 : right ? n.x + 9 : n.x} y={n.y < cy - 10 ? n.y - 9 : n.y > cy + 10 ? n.y + 14 : n.y + 4} fontSize="9.5" fill="#F0E3BE" textAnchor={left ? 'end' : right ? 'start' : 'middle'} fontFamily="Inter, sans-serif">{short(n.other_name)}</text>
              <text x={left ? n.x - 9 : right ? n.x + 9 : n.x} y={n.y < cy - 10 ? n.y - 20 : n.y > cy + 10 ? n.y + 25 : n.y + 15} fontSize="7.5" fill="#A89D83" textAnchor={left ? 'end' : right ? 'start' : 'middle'} fontFamily="JetBrains Mono, monospace" letterSpacing="0.6">{(REL_LABEL[n.relation] || n.relation).toUpperCase()}{n.role ? ` · ${n.role.toUpperCase()}` : ''}</text>
            </a>
          )
        })}
        <rect x={cx - 9} y={cy - 9} width={18} height={18} fill="#0B0A08" stroke="#F0E3BE" strokeWidth="1.5" />
        <text x={cx} y={cy + 30} fontSize="11" fill="#F0E3BE" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="600" letterSpacing="0.5">{name.toUpperCase()}</text>
      </svg>
      <figcaption className="section__caption">Connections recorded in OpenSanctions source documents. Red squares are themselves sanctioned; red lines are family. A connection is not evidence of wrongdoing by either party. {edges.length > shown.length ? `${edges.length - shown.length} further connections not drawn.` : ''}</figcaption>
    </figure>
  )
}
