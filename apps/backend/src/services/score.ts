import { db } from '../db/client'
import { emitFeedEvent } from './feed'
import { recordScoreEvent } from './provenance'

const SITE = process.env.FRONTEND_URL || 'https://falseleaders.com'
type Config = Record<string, number>

// Keys from earlier formulas kept in the table but no longer used.
export const ARCHIVED_CONFIG_KEYS = [
  'weight_confirmed', 'weight_likely', 'weight_maybe', 'weight_speculative',
  'funding_corporate_threshold', 'funding_corporate_penalty', 'funding_foreign_threshold', 'funding_foreign_penalty',
  'verdict_min_count', 'verdict_confidence_n', 'verdict_guilty_weight', 'verdict_suspicious_weight',
  'leak_upvote_threshold', 'leak_weight', 'leak_max_penalty', 'promise_broken_weight', 'promise_max_penalty', 'base_score',
]

export async function loadScoreConfig(): Promise<Config> {
  const { rows } = await db.query('SELECT key, value FROM truth_score_config')
  const cfg: Config = {}
  for (const c of rows) cfg[c.key] = Number(c.value)
  return cfg
}

export interface RatingTally { n: number; sum: number }
export type MediaTally = { articles: number; negative: number } | null
export interface SanctionTally { authorities: number }
export interface ScoreComponents { community: number | null; external: number | null }

/**
 * TruthScore = weight_community × members' rating + weight_external × outside signal.
 * Members' rating: mean of 0–100 ratings, shrunk toward 50 until rating_prior_weight ratings exist.
 * Outside signal: (1 − share of markedly negative coverage) × 100 from GDELT over 30 days, minus a
 * sanctions penalty for listings by scored authorities. A part with no data is left null and the
 * other part carries the score alone; with neither, the score is null ("unrated").
 */
export function computeComponents(cfg: Config, rating: RatingTally, media: MediaTally, sanctions: SanctionTally): ScoreComponents {
  const k = cfg.rating_prior_weight ?? 5
  const community = rating.n > 0 ? (rating.sum + 50 * k) / (rating.n + k) : null
  const penalty = Math.min(cfg.sanction_max_penalty ?? 30, sanctions.authorities * (cfg.sanction_weight ?? 15))
  let external: number | null = null
  if (media && media.articles >= (cfg.external_min_articles ?? 20)) external = Math.max(0, (1 - media.negative / media.articles) * 100 - penalty)
  else if (sanctions.authorities > 0) external = Math.max(0, 50 - penalty)
  return { community: community == null ? null : Math.round(community * 10) / 10, external: external == null ? null : Math.round(external * 10) / 10 }
}

export function combine(cfg: Config, c: ScoreComponents): number | null {
  const wc = (cfg.weight_community ?? 60) / 100, we = (cfg.weight_external ?? 40) / 100
  if (c.community != null && c.external != null) return Math.max(1, Math.min(100, Math.round(wc * c.community + we * c.external)))
  if (c.community != null) return Math.max(1, Math.min(100, Math.round(c.community)))
  if (c.external != null) return Math.max(1, Math.min(100, Math.round(c.external)))
  return null
}

export interface ScoreHistoryPoint { d: string; s: number }
const HISTORY_LIMIT = 120
const today = () => new Date().toISOString().slice(0, 10)

export async function recalculateScore(politicianId: string, cfg?: Config): Promise<{ score: number | null; previous: number | null; changed: boolean } | null> {
  const config = cfg ?? await loadScoreConfig()
  const { rows } = await db.query('SELECT id, name, truth_score, score_history, score_components FROM politicians WHERE id = $1', [politicianId])
  if (rows.length === 0) return null
  const leader = rows[0]

  const [{ rows: r }, { rows: m }, { rows: sx }] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS n, COALESCE(SUM(score), 0)::int AS sum FROM ratings WHERE politician_id = $1', [politicianId]),
    db.query('SELECT articles_30d AS articles, negative_30d AS negative, source_url FROM media_summary WHERE politician_id = $1', [politicianId]),
    db.query(`SELECT COUNT(DISTINCT COALESCE(authority, dataset, entity_id))::int AS authorities, MIN(entity_id) AS entity_id FROM flags WHERE politician_id = $1 AND kind = 'sanction' AND scored`, [politicianId]),
  ])
  const media = m[0] ? { articles: Number(m[0].articles), negative: Number(m[0].negative) } : null
  const components = computeComponents(config, r[0], media, sx[0])
  const score = combine(config, components)
  const previous = leader.truth_score == null ? null : Math.round(Number(leader.truth_score))
  const changed = previous !== score

  // Ledger: one event per part that moved, with the source it was computed from.
  const prev: Partial<ScoreComponents> = leader.score_components || {}
  const wc = (config.weight_community ?? 60) / 100, we = (config.weight_external ?? 40) / 100
  const parts: { key: keyof ScoreComponents; weight: number; source: string; detail: Record<string, unknown> }[] = [
    { key: 'community', weight: wc, source: `${SITE}/leaders/${politicianId}?tab=rating`, detail: { ratings: r[0].n, average: components.community } },
    { key: 'external', weight: we, source: sx[0].entity_id && !media ? `https://www.opensanctions.org/entities/${encodeURIComponent(sx[0].entity_id)}/` : (m[0]?.source_url || `${SITE}/leaders/${politicianId}?tab=media`),
      detail: { articles_30d: media?.articles ?? null, negative_30d: media?.negative ?? null, negative_share: media && media.articles ? Math.round((media.negative / media.articles) * 1000) / 10 : null, sanction_authorities: sx[0].authorities, external: components.external } },
  ]
  for (const p of parts) {
    const before = prev[p.key] ?? null, after = components[p.key]
    if (before === after || (before != null && after != null && Math.abs(before - after) < 0.05)) continue
    const points = Math.round(((after ?? 0) - (before ?? 0)) * p.weight * 100) / 100
    await recordScoreEvent(politicianId, p.key, points, p.source, { before, after, weight: p.weight, ...p.detail }, { before: previous, after: score ?? 0 })
  }

  const history: ScoreHistoryPoint[] = Array.isArray(leader.score_history) ? leader.score_history : []
  let nextHistory = history
  if (score != null) {
    const last = history[history.length - 1], day = today()
    if (!last) nextHistory = [{ d: day, s: score }]
    else if (last.d === day) { if (last.s !== score) nextHistory = [...history.slice(0, -1), { d: day, s: score }] }
    else nextHistory = [...history, { d: day, s: score }]
    if (nextHistory.length > HISTORY_LIMIT) nextHistory = nextHistory.slice(-HISTORY_LIMIT)
  }
  if (changed || nextHistory !== history || JSON.stringify(prev) !== JSON.stringify(components)) {
    await db.query('UPDATE politicians SET truth_score = $1, score_history = $2, score_components = $3 WHERE id = $4', [score, JSON.stringify(nextHistory), JSON.stringify(components), politicianId])
  }
  if (changed && previous !== null && score !== null) {
    await emitFeedEvent('score_change', politicianId, leader.name, { from: previous, to: score, delta: score - previous })
  }
  return { score, previous, changed }
}

/** Score N days ago according to history; null when there is no data that old. */
export function scoreDaysAgo(history: ScoreHistoryPoint[], days: number): number | null {
  if (!Array.isArray(history) || history.length === 0) return null
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  let candidate: ScoreHistoryPoint | null = null
  for (const p of history) { if (p.d <= cutoff) candidate = p; else break }
  return candidate ? candidate.s : history[0].s
}
