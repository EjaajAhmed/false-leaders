import { db } from '../db/client'

export interface Source {
  name: string
  url: string
  license?: string | null
  fetchedAt?: Date
}

export const LICENSES = {
  wikidata: 'CC0 1.0',
  wikipedia: 'CC BY-SA 4.0',
  worldbank: 'CC BY 4.0',
  gdelt: 'GDELT Terms of Use',
  internal: 'FalseLeaders community content',
} as const

/** Record where a displayed field came from. One row per (leader, field); re-recording replaces it. */
export async function recordSource(politicianId: string, field: string, value: unknown, source: Source): Promise<void> {
  if (!source.url || !source.url.trim()) throw new Error(`Refusing to record field "${field}" without a source URL`)
  await db.query(
    `INSERT INTO field_sources (politician_id, field, value, source_name, source_url, license, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (politician_id, field) DO UPDATE
       SET value = EXCLUDED.value, source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url,
           license = EXCLUDED.license, fetched_at = EXCLUDED.fetched_at`,
    [politicianId, field, JSON.stringify(value ?? null), source.name, source.url, source.license ?? null, source.fetchedAt ?? new Date()]
  )
}

export async function getSources(politicianId: string) {
  const { rows } = await db.query(
    `SELECT field, value, source_name, source_url, license, fetched_at
     FROM field_sources WHERE politician_id = $1 ORDER BY source_name, field`,
    [politicianId]
  )
  return rows
}

/**
 * Append a score event. The database also refuses rows without a source URL;
 * this check exists so the failure is loud and early.
 */
export async function recordScoreEvent(
  politicianId: string,
  kind: string,
  points: number,
  sourceUrl: string,
  detail: Record<string, unknown> = {},
  scores?: { before: number | null; after: number }
): Promise<void> {
  if (!sourceUrl || !sourceUrl.trim()) throw new Error(`Score event "${kind}" has no source URL and must not fire`)
  await db.query(
    `INSERT INTO score_events (politician_id, kind, points, score_before, score_after, source_url, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [politicianId, kind, points, scores?.before ?? null, scores?.after ?? null, sourceUrl, JSON.stringify(detail)]
  )
}

export async function getScoreEvents(politicianId: string, limit = 100) {
  const { rows } = await db.query(
    `SELECT id, kind, points, score_before, score_after, source_url, detail, created_at
     FROM score_events WHERE politician_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [politicianId, limit]
  )
  return rows
}
