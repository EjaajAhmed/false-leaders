import client from './client'

export const register = async (data: { email: string; username: string; password: string }) => {
  const res = await client.post('/auth/register', data)
  return res.data
}

export const login = async (data: { email: string; password: string }) => {
  const res = await client.post('/auth/login', data)
  return res.data
}

export const changeUsername = async (username: string) => {
  const res = await client.patch('/auth/username', { username })
  return res.data
}

export const getMe = async () => {
  const res = await client.get('/auth/me')
  return res.data
}

export const getMyActivity = async () => {
  const res = await client.get('/auth/me/activity')
  return res.data
}

export const updateNotifPrefs = async (prefs: Record<string, boolean>) => {
  const res = await client.patch('/auth/notif-prefs', prefs)
  return res.data
}

export const resendVerification = async () => {
  const res = await client.post('/auth/resend-verification')
  return res.data
}
