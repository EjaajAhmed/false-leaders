import { db } from '../db/client'
import { sendCommentReplyEmail, sendPoliticianUpdateEmail, sendAppNewsEmail } from './email'

const COMMENT_REPLY_THROTTLE_HOURS = 6

async function shouldSendEmail(userId: string, type: string): Promise<boolean> {
  try {
    const { rows } = await db.query(
      `SELECT last_sent_at FROM email_throttle WHERE user_id = $1 AND type = $2`,
      [userId, type]
    )
    if (rows.length === 0) return true
    const lastSent = new Date(rows[0].last_sent_at)
    const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60)
    if (type === 'comment_reply') return hoursSince >= COMMENT_REPLY_THROTTLE_HOURS
    return true
  } catch {
    return false
  }
}

async function recordEmailSent(userId: string, type: string): Promise<void> {
  await db.query(
    `INSERT INTO email_throttle (user_id, type, last_sent_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, type)
     DO UPDATE SET last_sent_at = NOW()`,
    [userId, type]
  )
}

export async function notifyUser(
  userId: string,
  type: 'comment_reply' | 'politician_update' | 'app_news',
  message: string,
  link?: string
) {
  await db.query(
    `INSERT INTO notifications (user_id, type, message, link)
     VALUES ($1, $2, $3, $4)`,
    [userId, type, message, link || null]
  )
}

export async function notifyCommentReply(
  commenterId: string,
  commenterDisplayName: string,
  politicianId: string,
  politicianName: string
) {
  const { rows: otherCommenters } = await db.query(
    `SELECT DISTINCT c.user_id, u.email, u.username,
            u.notif_comment_replies, u.email_notifications, u.email_verified
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.politician_id = $1 AND c.user_id != $2`,
    [politicianId, commenterId]
  )

  for (const u of otherCommenters) {
    if (!u.notif_comment_replies) continue

    await notifyUser(
      u.user_id,
      'comment_reply',
      `${commenterDisplayName} also commented on ${politicianName}`,
      `/leaders/${politicianId}`
    )

    if (!u.email_notifications || !u.email_verified) continue
    const canEmail = await shouldSendEmail(u.user_id, 'comment_reply')
    if (!canEmail) continue

    const { rows: recentComments } = await db.query(
      `SELECT u2.username, c.body, c.created_at
       FROM comments c
       JOIN users u2 ON u2.id = c.user_id
       WHERE c.politician_id = $1
       ORDER BY c.created_at DESC
       LIMIT 5`,
      [politicianId]
    )

    await sendCommentReplyEmail(u.email, u.username, politicianName, politicianId, recentComments)
    await recordEmailSent(u.user_id, 'comment_reply')
  }
}

export async function notifyPoliticianUpdate(
  politicianId: string,
  politicianName: string,
  changes: string[]
) {
  const { rows: bookmarkers } = await db.query(
    `SELECT DISTINCT b.user_id, u.email, u.username,
            u.notif_politician_updates, u.email_notifications, u.email_verified
     FROM bookmarks b
     JOIN users u ON u.id = b.user_id
     WHERE b.politician_id = $1`,
    [politicianId]
  )

  console.log(`Notifying ${bookmarkers.length} bookmarkers of update to ${politicianName}`)

  for (const u of bookmarkers) {
    if (!u.notif_politician_updates) continue

    await notifyUser(
      u.user_id,
      'politician_update',
      `${politicianName}: ${changes.join(', ')}`,
      `/leaders/${politicianId}`
    )

    if (!u.email_notifications || !u.email_verified) continue
    const canEmail = await shouldSendEmail(u.user_id, 'politician_update')
    if (!canEmail) continue

    await sendPoliticianUpdateEmail(u.email, u.username, politicianName, politicianId, changes)
    await recordEmailSent(u.user_id, 'politician_update')
  }
}

export async function notifyAllUsers(
  type: 'app_news',
  subject: string,
  message: string
) {
  const { rows: users } = await db.query(
    `SELECT id, email, username, notif_app_news, email_notifications, email_verified FROM users`
  )

  for (const u of users) {
    if (!u.notif_app_news) continue
    await notifyUser(u.id, type, message)
    if (!u.email_notifications || !u.email_verified) continue
    await sendAppNewsEmail(u.email, u.username, subject, message)
    await recordEmailSent(u.id, 'app_news')
  }
}