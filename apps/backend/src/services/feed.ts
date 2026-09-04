import { db } from '../db/client'

export type FeedEventType =
  | 'score_change'
  | 'leak'
  | 'controversy'
  | 'controversy_escalated'
  | 'verdict_shift'
  | 'thread'

export async function emitFeedEvent(
  type: FeedEventType,
  leaderId: string,
  leaderName: string,
  meta: Record<string, unknown> = {}
) {
  try {
    await db.query(
      `INSERT INTO feed_events (type, leader_id, leader_name, meta) VALUES ($1, $2, $3, $4)`,
      [type, leaderId, leaderName, JSON.stringify(meta)]
    )
  } catch (err) {
    console.error('feed_events insert failed:', err)
  }
}
