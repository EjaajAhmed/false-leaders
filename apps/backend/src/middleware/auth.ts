import { db } from '../db/client'

/**
 * Verifies the token, then loads the account so admin, verification and suspension are read from the
 * database rather than trusted from the token. A token is rejected when it has no expiry (issued before
 * sessions expired), when the account is gone or suspended, or when its token_version has moved on.
 */
async function loadSession(request: any): Promise<boolean> {
  await request.jwtVerify()
  const claims = request.user
  if (!claims?.id || !claims.exp) return false
  const { rows } = await db.query('SELECT username, prole_number, is_admin, email_verified, token_version, suspended_at, is_system FROM users WHERE id = $1', [claims.id])
  const u = rows[0]
  if (!u || u.is_system || u.suspended_at || u.token_version !== (claims.tv ?? 0)) return false
  request.user = { ...claims, username: u.username, prole_number: u.prole_number, is_admin: !!u.is_admin, email_verified: !!u.email_verified }
  return true
}

const deny = (reply: any) => reply.status(401).send({ error: 'Access denied.' })

export async function authenticate(request: any, reply: any) {
  try { if (!(await loadSession(request))) return deny(reply) } catch { return deny(reply) }
}

export async function requireVerified(request: any, reply: any) {
  try {
    if (!(await loadSession(request))) return deny(reply)
    if (!request.user.email_verified) return reply.status(403).send({ error: 'Verify your email first.' })
  } catch { return deny(reply) }
}

export async function requireAdmin(request: any, reply: any) {
  try {
    if (!(await loadSession(request))) return deny(reply)
    if (!request.user.is_admin) return reply.status(403).send({ error: 'Access denied.' })
  } catch { return deny(reply) }
}

// Attaches request.user when a valid session is present; never rejects.
export async function optionalAuth(request: any) {
  try { if (!(await loadSession(request))) request.user = null } catch { request.user = null }
}
