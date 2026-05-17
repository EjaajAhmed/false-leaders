import { Resend } from 'resend'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const FROM = process.env.FROM_EMAIL || 'noreply@falseleaders.com'
const APP_URL = process.env.FRONTEND_URL || 'https://falseleaders.com'

export async function sendCommentReplyEmail(
  to: string,
  username: string,
  politicianName: string,
  politicianId: string,
  recentComments: { username: string; body: string; created_at: string }[]
) {
  const resend = getResend()
  if (!resend) {
    console.log(`[EMAIL] Comment reply skipped — no API key`)
    return
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `New activity on ${politicianName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; color: #1a1a1a;">
          <h2 style="font-size: 1.1rem; margin: 0 0 0.5rem;">Hey @${username},</h2>
          <p style="color: #555; margin: 0 0 1rem;">There's new activity on <strong>${politicianName}</strong>.</p>
          <a href="${APP_URL}/politicians/${politicianId}"
             style="display: inline-block; padding: 0.7rem 1.5rem; background: #1a1a1a; color: white; text-decoration: none; border-radius: 8px; font-size: 0.9rem;">
            View discussion
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;" />
          <p style="color: #bbb; font-size: 0.75rem; margin: 0;">
            <a href="${APP_URL}/profile" style="color: #c9a84c;">Manage notification preferences</a>
          </p>
        </div>
      `
    })
  } catch (err) {
    console.error('Comment reply email failed:', err)
  }
}

export async function sendPoliticianUpdateEmail(
  to: string,
  username: string,
  politicianName: string,
  politicianId: string,
  changes: string[]
) {
  const resend = getResend()
  if (!resend) {
    console.log(`[EMAIL] Politician update email skipped — no API key`)
    return
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Update: ${politicianName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; color: #1a1a1a;">
          <h2 style="font-size: 1.1rem; margin: 0 0 0.5rem;">Hey @${username},</h2>
          <p style="color: #555; margin: 0 0 1rem;"><strong>${politicianName}</strong> has been updated:</p>
          <ul style="color: #555; padding-left: 1.25rem; margin: 0 0 1.5rem;">
            ${changes.map(c => `<li style="margin-bottom: 0.3rem;">${c}</li>`).join('')}
          </ul>
          <a href="${APP_URL}/politicians/${politicianId}"
             style="display: inline-block; padding: 0.7rem 1.5rem; background: #1a1a1a; color: white; text-decoration: none; border-radius: 8px; font-size: 0.9rem;">
            View profile
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;" />
          <p style="color: #bbb; font-size: 0.75rem; margin: 0;">
            <a href="${APP_URL}/profile" style="color: #c9a84c;">Manage notification preferences</a>
          </p>
        </div>
      `
    })
  } catch (err) {
    console.error('Politician update email failed:', err)
  }
}

export async function sendAppNewsEmail(
  to: string,
  username: string,
  subject: string,
  message: string
) {
  const resend = getResend()
  if (!resend) {
    console.log(`[EMAIL] App news email skipped — no API key`)
    return
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="font-size: 1.4rem; color: #1a1a1a; margin: 0;">FalseLeaders</h1>
            <p style="color: #aaa; font-size: 0.8rem; margin: 0.25rem 0 0;">Hold them accountable.</p>
          </div>
          <h2 style="font-size: 1.1rem; margin: 0 0 0.5rem;">Hey @${username},</h2>
          <p style="color: #555; margin: 0 0 1.5rem; white-space: pre-line;">${message}</p>
          <a href="${APP_URL}"
             style="display: inline-block; padding: 0.7rem 1.5rem; background: #1a1a1a; color: white; text-decoration: none; border-radius: 8px; font-size: 0.9rem;">
            Open FalseLeaders
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;" />
          <p style="color: #bbb; font-size: 0.75rem; margin: 0;">
            <a href="${APP_URL}/profile" style="color: #c9a84c;">Manage notification preferences</a>
          </p>
        </div>
      `
    })
  } catch (err) {
    console.error('App news email failed:', err)
  }
}

export async function sendWelcomeEmail(to: string, username: string, verificationToken: string) {
  const resend = getResend()
  if (!resend) {
    console.log(`[EMAIL] Welcome email to ${to} skipped — no API key`)
    return
  }
  const verifyUrl = `${process.env.BACKEND_URL || 'https://false-leaders-backend-production.up.railway.app'}/auth/verify/${verificationToken}`
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Verify your FalseLeaders account',
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 2rem;">
            <h1 style="font-size: 1.4rem; color: #1a1a1a; margin: 0;">FalseLeaders</h1>
            <p style="color: #aaa; font-size: 0.8rem; margin: 0.25rem 0 0;">Hold them accountable.</p>
          </div>
          <h2 style="font-size: 1.1rem; margin: 0 0 0.5rem;">Welcome, @${username}</h2>
          <p style="color: #555; margin: 0 0 1.5rem;">Please verify your email address to unlock commenting and voting.</p>
          <a href="${verifyUrl}"
             style="display: inline-block; padding: 0.7rem 1.5rem; background: #1a1a1a; color: white; text-decoration: none; border-radius: 8px; font-size: 0.9rem;">
            Verify my email
          </a>
          <p style="color: #aaa; font-size: 0.8rem; margin-top: 1.5rem;">
            This link expires in 24 hours. If you didn't create an account, ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;" />
          <p style="color: #bbb; font-size: 0.75rem; margin: 0;">
            <a href="${APP_URL}/profile" style="color: #c9a84c;">Manage preferences</a>
          </p>
        </div>
      `
    })
  } catch (err) {
    console.error('Welcome email failed:', err)
  }
}