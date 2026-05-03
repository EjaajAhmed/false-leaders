export async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function requireVerified(request: any, reply: any) {
  try {
    await request.jwtVerify()
    if (!request.user?.email_verified) {
      return reply.status(403).send({ error: 'Please verify your email to continue.' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}
