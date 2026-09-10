import client from './client'

export const getLegalInfo = async () => (await client.get('/legal/info')).data as { abuse_email: string; takedown_response_days: number; terms_version: string }
export const submitTakedown = async (data: { name: string; email: string; url: string; reason: string; detail?: string }) => (await client.post('/legal/takedown', data)).data as { id: string; received_at: string; response_days: number; abuse_email: string }
export const reportContent = async (data: { target_type: 'thread' | 'post'; target_id: string; reason: string; detail?: string }) => (await client.post('/forum/report', data)).data as { id: string }

// ── Admin moderation ──
export const getReports = async (status = 'open') => (await client.get('/admin/reports', { params: { status } })).data
export const updateReport = async ({ id, ...data }: { id: string; status: string; note?: string }) => (await client.patch(`/admin/reports/${id}`, data)).data
export const getTakedowns = async (status = 'all') => (await client.get('/admin/takedowns', { params: { status } })).data
export const updateTakedown = async ({ id, ...data }: { id: string; status?: string; notes?: string }) => (await client.patch(`/admin/takedowns/${id}`, data)).data
export const getModerationLog = async (limit = 100) => (await client.get('/admin/moderation-log', { params: { limit } })).data
