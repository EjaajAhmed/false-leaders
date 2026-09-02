import { db } from '../db/client'
import { emitFeedEvent } from './feed'

type Config = Record<string, number>

export async function loadScoreConfig(): Promise<Config> {
  const { rows } = await db.query('SELECT key, value FROM truth_score_config')
  const cfg: Config = {}
  for (const c of rows) cfg[c.key] = Number(c.value)
  return cfg
}

export function computeScore(
  cfg: Config,
  controversies: { level: string }[],
  funding: { source_type: string; amount: number | string }[],
  influence: { influence_score: number | string }[]
): number {
  let score = cfg.base_score ?? 90

  for (const c of controversies) {
    score -= cfg[`weight_${c.level}`] ?? 0
  }

  if (funding.length > 0) {
    const total = funding.reduce((s, f) => s + Number(f.amount), 0)
    const corporate = funding
      .filter(f => ['Corporate', 'PAC'].includes(f.source_type))
      .reduce((s, f) => s + Number(f.amount), 0)
    if (total > 0 && (corporate / total) * 100 > (cfg.funding_corporate_threshold ?? 60)) {
      score -= cfg.funding_corporate_penalty ?? 10
    }
  }

  for (const inf of influence) {
    if (Number(inf.influence_score) > (cfg.funding_foreign_threshold ?? 60)) {
      score -= cfg.funding_foreign_penalty ?? 10
    }
  }

  // Floor at 1. Never zero.
  return Math.max(1, Math.min(100, Math.round(score)))
}

export interface ScoreHistoryPoint { d: string; s: number }

const HISTORY_LIMIT = 120

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Recalculates a leader's TruthScore, persists it, appends to score_history
 * (one point per day) and emits a feed event when the score moves.
 */
export async function recalculateScore(
  politicianId: string,
  cfg?: Config
): Promise<{ score: number; previous: number | null; changed: boolean } | null> {
  const config = cfg ?? await loadScoreConfig()

  const { rows } = await db.query(
    'SELECT id, name, truth_score, score_history FROM politicians WHERE id = $1',
    [politicianId]
  )
  if (rows.length === 0) return null
  const leader = rows[0]

  const [{ rows: controversies }, { rows: funding }, { rows: influence }] = await Promise.all([
    db.query('SELECT level FROM controversies WHERE politician_id = $1', [politicianId]),
    db.query('SELECT source_type, amount FROM funding_sources WHERE politician_id = $1', [politicianId]),
    db.query('SELECT influence_score FROM foreign_influence WHERE politician_id = $1', [politicianId]),
  ])

  const score = computeScore(config, controversies, funding, influence)
  const previous = leader.truth_score == null ? null : Math.round(Number(leader.truth_score))
  const changed = previous !== score

  const history: ScoreHistoryPoint[] = Array.isArray(leader.score_history) ? leader.score_history : []
  const last = history[history.length - 1]
  const day = today()
  let nextHistory = history

  if (!last) {
    nextHistory = [{ d: day, s: score }]
  } else if (last.d === day) {
    if (last.s !== score) nextHistory = [...history.slice(0, -1), { d: day, s: score }]
  } else {
    nextHistory = [...history, { d: day, s: score }]
  }
  if (nextHistory.length > HISTORY_LIMIT) nextHistory = nextHistory.slice(-HISTORY_LIMIT)

  const historyChanged = nextHistory !== history

  if (changed || historyChanged) {
    await db.query(
      'UPDATE politicians SET truth_score = $1, score_history = $2 WHERE id = $3',
      [score, JSON.stringify(nextHistory), politicianId]
    )
  }

  if (changed && previous !== null) {
    await emitFeedEvent('score_change', politicianId, leader.name, {
      from: previous,
      to: score,
      delta: score - previous,
    })
  }

  return { score, previous, changed }
}

/** Score N days ago according to history; null when there is no data that old. */
export function scoreDaysAgo(history: ScoreHistoryPoint[], days: number): number | null {
  if (!Array.isArray(history) || history.length === 0) return null
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  let candidate: ScoreHistoryPoint | null = null
  for (const p of history) {
    if (p.d <= cutoff) candidate = p
    else break
  }
  return candidate ? candidate.s : history[0].s
}
