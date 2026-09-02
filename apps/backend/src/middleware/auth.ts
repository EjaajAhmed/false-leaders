export async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Access denied.' })
  }
}

export async function requireVerified(request: any, reply: any) {
  try {
    await request.jwtVerify()
    if (!request.user?.email_verified) {
      return reply.status(403).send({ error: 'Verify your email first.' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Access denied.' })
  }
}

export async function requireAdmin(request: any, reply: any) {
  try {
    await request.jwtVerify()
    if (!request.user?.is_admin) {
      return reply.status(403).send({ error: 'Access denied.' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Access denied.' })
  }
}

// Attaches request.user when a valid token is present; never rejects.
export async function optionalAuth(request: any) {
  try {
    await request.jwtVerify()
  } catch {
    request.user = null
  }
}
