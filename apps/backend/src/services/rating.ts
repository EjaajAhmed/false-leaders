import { db } from '../db/client'
import { emitFeedEvent } from './feed'

/** Ratings needed before the average is shown. Below this the leader reads as unrated. */
export const RATING_MIN_VOTES = 5

export interface RatingAggregate {
  n: number
  /** Floored whole-number average, or null while n < RATING_MIN_VOTES. */
  average: number | null
  bins: [number, number, number, number]
  min_votes: number
}

export async function ratingAggregate(politicianId: string): Promise<RatingAggregate> {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n, FLOOR(AVG(score))::int AS average,
            COUNT(*) FILTER (WHERE score < 25)::int AS b0, COUNT(*) FILTER (WHERE score >= 25 AND score < 50)::int AS b1,
            COUNT(*) FILTER (WHERE score >= 50 AND score < 75)::int AS b2, COUNT(*) FILTER (WHERE score >= 75)::int AS b3
     FROM ratings WHERE politician_id = $1`, [politicianId]
  )
  const r = rows[0]
  return { n: r.n, average: r.n >= RATING_MIN_VOTES ? r.average : null, bins: [r.b0, r.b1, r.b2, r.b3], min_votes: RATING_MIN_VOTES }
}

/** Recompute the denormalised rating columns after a rating changes. */
export async function refreshRating(politicianId: string): Promise<RatingAggregate> {
  const agg = await ratingAggregate(politicianId)
  const { rows } = await db.query(
    `UPDATE politicians SET rating_count = $2, rating_avg = $3 WHERE id = $1
     RETURNING name, (SELECT rating_avg FROM politicians WHERE id = $1) AS previous_avg`,
    [politicianId, agg.n, agg.average]
  )
  // The subquery above runs before the update, so previous_avg is the old value.
  if (rows[0] && rows[0].previous_avg == null && agg.average != null) {
    await emitFeedEvent('rating_public', politicianId, rows[0].name, { average: agg.average, count: agg.n })
  }
  return agg
}
