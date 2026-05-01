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