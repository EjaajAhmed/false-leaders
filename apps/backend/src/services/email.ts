const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export async function sendCommentReplyEmail(
  to: string,
  username: string,
  politicianName: string,
  politicianId: string,
  recentComments: { username: string; body: string; created_at: string }[]
) {
  console.log(`[EMAIL] Comment reply to ${to} (@${username}) re: ${politicianName}`)
  console.log(`[EMAIL] Link: ${APP_URL}/politicians/${politicianId}`)
  console.log(`[EMAIL] Recent comments:`, recentComments.map(c => `@${c.username}: ${c.body}`))
}

export async function sendPoliticianUpdateEmail(
  to: string,
  username: string,
  politicianName: string,
  politicianId: string,
  changes: string[]
) {
  console.log(`[EMAIL] Politician update to ${to} (@${username}): ${politicianName}`)
  console.log(`[EMAIL] Changes:`, changes)
  console.log(`[EMAIL] Link: ${APP_URL}/politicians/${politicianId}`)
}

export async function sendAppNewsEmail(
  to: string,
  username: string,
  subject: string,
  message: string
) {
  console.log(`[EMAIL] App news to ${to} (@${username}): ${subject}`)
  console.log(`[EMAIL] Message:`, message)
}