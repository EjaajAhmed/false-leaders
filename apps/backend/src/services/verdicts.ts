import { db } from '../db/client'

export type VerdictKind = 'guilty' | 'suspicious' | 'unclear' | 'clean'
export const VERDICT_KINDS: VerdictKind[] = ['guilty', 'suspicious', 'unclear', 'clean']

const WEIGHTS: Record<VerdictKind, number> = { guilty: 0, suspicious: 30, unclear: 50, clean: 100 }

export interface VerdictAggregate {
  total: number
  counts: Record<VerdictKind, number> & { total: number }
  percentages: Record<VerdictKind, number>
  dominant: VerdictKind | null
  score: number | null
}

export function aggregateFromCounts(counts: Record<VerdictKind, number>): VerdictAggregate {
  const total = VERDICT_KINDS.reduce((s, k) => s + (counts[k] || 0), 0)
  const percentages = { guilty: 0, suspicious: 0, unclear: 0, clean: 0 }
  let dominant: VerdictKind | null = null
  let score: number | null = null

  if (total > 0) {
    let weighted = 0
    let best = -1
    for (const k of VERDICT_KINDS) {
      const n = counts[k] || 0
      percentages[k] = Math.round((n / total) * 100)
      weighted += n * WEIGHTS[k]
      if (n > best) { best = n; dominant = k }
    }
    score = Math.round(weighted / total)
  }

  return { total, counts: { ...counts, total }, percentages, dominant, score }
}

export async function getVerdictAggregate(politicianId: string): Promise<VerdictAggregate> {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE verdict = 'guilty') AS guilty,
       COUNT(*) FILTER (WHERE verdict = 'suspicious') AS suspicious,
       COUNT(*) FILTER (WHERE verdict = 'unclear') AS unclear,
       COUNT(*) FILTER (WHERE verdict = 'clean') AS clean
     FROM verdicts WHERE politician_id = $1`,
    [politicianId]
  )
  const r = rows[0]
  return aggregateFromCounts({
    guilty: Number(r.guilty), suspicious: Number(r.suspicious),
    unclear: Number(r.unclear), clean: Number(r.clean),
  })
}
