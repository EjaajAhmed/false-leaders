import { db } from '../db/client'
import { emitFeedEvent } from './feed'
import { recordScoreEvent } from './provenance'

const SITE = process.env.FRONTEND_URL || 'https://falseleaders.com'

type Config = Record<string, number>

// Config keys that belong to the archived controversy/funding/influence formula.
export const ARCHIVED_CONFIG_KEYS = [
  'weight_confirmed', 'weight_likely', 'weight_maybe', 'weight_speculative',
  'funding_corporate_threshold', 'funding_corporate_penalty',
  'funding_foreign_threshold', 'funding_foreign_penalty',
]

export async function loadScoreConfig(): Promise<Config> {
  const { rows } = await db.query('SELECT key, value FROM truth_score_config')
  const cfg: Config = {}
  for (const c of rows) cfg[c.key] = Number(c.value)
  return cfg
}

export interface VerdictTally { total: number; guilty: number; suspicious: number; unclear: number; clean: number }
export interface LeakTally { counted: number }

/**
 * Community-driven TruthScore.
 *
 * Starts at base_score (90). Verdicts deduct once there are at least
 * verdict_min_count of them: the Guilty share deducts up to verdict_guilty_weight
 * and the Suspicious share up to verdict_suspicious_weight, scaled by a confidence
 * factor that reaches 1 at verdict_confidence_n verdicts. Leaks with at least
 * leak_upvote_threshold upvotes deduct leak_weight each, capped at leak_max_penalty.
 * Floor 1. Never zero.
 */
export interface ScoreComponents { verdicts: number; leaks: number }

/** Deductions by component, each rounded to two decimals so the ledger is stable. */
export function computeComponents(cfg: Config, verdicts: VerdictTally, leaks: LeakTally): ScoreComponents {
  let verdictDeduction = 0
  const minCount = cfg.verdict_min_count ?? 3
  if (verdicts.total >= minCount && verdicts.total > 0) {
    const confidence = Math.min(1, verdicts.total / Math.max(1, cfg.verdict_confidence_n ?? 25))
    const guiltyShare = verdicts.guilty / verdicts.total
    const suspiciousShare = verdicts.suspicious / verdicts.total
    verdictDeduction = (guiltyShare * (cfg.verdict_guilty_weight ?? 60) + suspiciousShare * (cfg.verdict_suspicious_weight ?? 30)) * confidence
  }
  const leakDeduction = Math.min(cfg.leak_max_penalty ?? 20, leaks.counted * (cfg.leak_weight ?? 2))
  return { verdicts: Math.round(verdictDeduction * 100) / 100, leaks: Math.round(leakDeduction * 100) / 100 }
}

export function computeScore(cfg: Config, verdicts: VerdictTally, leaks: LeakTally): number {
  const c = computeComponents(cfg, verdicts, leaks)
  const score = (cfg.base_score ?? 90) - c.verdicts - c.leaks
  return Math.max(1, Math.min(100, Math.round(score)))
}

/** Archived formula (controversy levels, corporate funding, foreign influence). Kept for reference. */
export function computeArchivedScore(
  cfg: Config,
  controversies: { level: string }[],
  funding: { source_type: string; amount: number | string }[],
  influence: { influence_score: number | string }[]
): number {
  let score = cfg.base_score ?? 90
  for (const c of controversies) score -= cfg[`weight_${c.level}`] ?? 0
  if (funding.length > 0) {
    const total = funding.reduce((s, f) => s + Number(f.amount), 0)
    const corporate = funding.filter(f => ['Corporate', 'PAC'].includes(f.source_type)).reduce((s, f) => s + Number(f.amount), 0)
    if (total > 0 && (corporate / total) * 100 > (cfg.funding_corporate_threshold ?? 60)) score -= cfg.funding_corporate_penalty ?? 10
  }
  for (const inf of influence) {
    if (Number(inf.influence_score) > (cfg.funding_foreign_threshold ?? 60)) score -= cfg.funding_foreign_penalty ?? 10
  }
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
    'SELECT id, name, truth_score, score_history, score_components FROM politicians WHERE id = $1',
    [politicianId]
  )
  if (rows.length === 0) return null
  const leader = rows[0]

  const [{ rows: v }, { rows: l }] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE verdict = 'guilty')::int AS guilty,
              COUNT(*) FILTER (WHERE verdict = 'suspicious')::int AS suspicious,
              COUNT(*) FILTER (WHERE verdict = 'unclear')::int AS unclear,
              COUNT(*) FILTER (WHERE verdict = 'clean')::int AS clean
       FROM verdicts WHERE politician_id = $1`,
      [politicianId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS counted FROM leaks
       WHERE politician_id = $1 AND status IN ('visible', 'escalated') AND upvotes >= $2`,
      [politicianId, config.leak_upvote_threshold ?? 3]
    ),
  ])

  const components = computeComponents(config, v[0], l[0])
  const score = Math.max(1, Math.min(100, Math.round((config.base_score ?? 90) - components.verdicts - components.leaks)))
  const previous = leader.truth_score == null ? null : Math.round(Number(leader.truth_score))
  const changed = previous !== score

  // Ledger: one event per component whose deduction moved. Every event carries the source it was computed from.
  const prevComponents: Partial<ScoreComponents> = leader.score_components || {}
  const sources: Record<keyof ScoreComponents, string> = {
    verdicts: `${SITE}/leaders/${politicianId}?tab=verdicts`,
    leaks: `${SITE}/leaders/${politicianId}?tab=leaks`,
  }
  const details: Record<keyof ScoreComponents, Record<string, unknown>> = {
    verdicts: { total: v[0].total, guilty: v[0].guilty, suspicious: v[0].suspicious, unclear: v[0].unclear, clean: v[0].clean },
    leaks: { counted_leaks: l[0].counted, upvote_threshold: config.leak_upvote_threshold ?? 3 },
  }
  for (const key of ['verdicts', 'leaks'] as (keyof ScoreComponents)[]) {
    const before = Number(prevComponents[key] ?? 0)
    const after = components[key]
    if (Math.abs(after - before) < 0.005) continue
    await recordScoreEvent(politicianId, key, Math.round((before - after) * 100) / 100, sources[key],
      { deduction_before: before, deduction_after: after, ...details[key] }, { before: previous, after: score })
  }

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

  if (changed || historyChanged || JSON.stringify(prevComponents) !== JSON.stringify(components)) {
    await db.query(
      'UPDATE politicians SET truth_score = $1, score_history = $2, score_components = $3 WHERE id = $4',
      [score, JSON.stringify(nextHistory), JSON.stringify(components), politicianId]
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
