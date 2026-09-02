import client from './client'
import type { FeedType, Level, VerdictKind } from '../types'

// ── Leaders ──
export const getPoliticians = async (filters?: {
  search?: string; country?: string; party?: string; position?: string
  min_age?: number; max_age?: number; min_truth?: number; max_truth?: number
  page?: number; limit?: number; sort?: 'name' | 'score_asc' | 'score_desc' | 'newest'
}) => {
  const res = await client.get('/politicians', { params: filters })
  return res.data
}

export const getPoliticiansMeta = async () => {
  const res = await client.get('/politicians/meta')
  return res.data
}

export const getPolitician = async (id: string) => {
  const res = await client.get(`/politicians/${id}`)
  return res.data
}

// ── Home / feed / leaderboard ──
export const getStats = async () => (await client.get('/home/stats')).data
export const getFeatured = async () => (await client.get('/home/featured')).data

export const getFeed = async (params?: { type?: FeedType | 'controversy'; before?: string; limit?: number }) => {
  const res = await client.get('/feed/recent', { params })
  return res.data as { events: any[]; hasMore: boolean }
}

export type LeaderboardTab = 'condemned' | 'drop' | 'discussed' | 'leaked'
export const getLeaderboard = async (tab: LeaderboardTab, limit = 25) => {
  const res = await client.get(`/leaderboard/${tab}`, { params: { limit } })
  return res.data
}

// ── Comments (Discussion) ──
export const getComments = async (politicianId: string) => (await client.get(`/comments/${politicianId}`)).data
export const postComment = async (data: { politician_id: string; body: string; is_anonymous: boolean }) =>
  (await client.post('/comments', data)).data
export const deleteComment = async (id: string) => (await client.delete(`/comments/${id}`)).data

// ── Verdicts ──
export const getVerdicts = async (politicianId: string) => (await client.get(`/politicians/${politicianId}/verdicts`)).data
export const submitVerdict = async ({ politician_id, ...data }: { politician_id: string; verdict: VerdictKind; body?: string; is_anonymous: boolean }) =>
  (await client.post(`/politicians/${politician_id}/verdicts`, data)).data
export const upvoteVerdict = async (id: string) => (await client.post(`/verdicts/${id}/upvote`)).data
export const deleteVerdict = async (id: string) => (await client.delete(`/verdicts/${id}`)).data

// ── Leaks ──
export const getLeaks = async (politicianId: string) => (await client.get(`/politicians/${politicianId}/leaks`)).data
export const submitLeak = async ({ politician_id, body }: { politician_id: string; body: string }) =>
  (await client.post(`/politicians/${politician_id}/leaks`, { body })).data
export const upvoteLeak = async (id: string) => (await client.post(`/leaks/${id}/upvote`)).data
export const getLeakQueue = async (status?: string) => (await client.get('/leaks/queue', { params: { status } })).data
export const setLeakStatus = async ({ id, ...data }: { id: string; status: string; title?: string; level?: Level }) =>
  (await client.patch(`/leaks/${id}/status`, data)).data

// ── Controversies ──
export const getControversies = async (politicianId: string) => (await client.get(`/controversies/${politicianId}`)).data
export const addControversy = async (data: { politician_id: string; title: string; description: string; source_url?: string; level: string }) =>
  (await client.post('/controversies', data)).data
export const updateControversy = async ({ id, ...data }: any) => (await client.put(`/controversies/${id}`, data)).data
export const deleteControversy = async (id: string) => (await client.delete(`/controversies/${id}`)).data
export const upvoteControversy = async (id: string) => (await client.post(`/controversies/${id}/upvote`)).data

// ── Controversy proposals ──
export const proposeControversy = async ({ politician_id, ...data }: { politician_id: string; title: string; description: string; level: Level; source_url?: string }) =>
  (await client.post(`/politicians/${politician_id}/controversy-proposals`, data)).data
export const getMyProposals = async (politicianId: string) => (await client.get(`/politicians/${politicianId}/controversy-proposals/mine`)).data
export const getProposalQueue = async (status = 'pending') => (await client.get('/controversy-proposals', { params: { status } })).data
export const reviewProposal = async ({ id, ...data }: { id: string; action: 'approve' | 'reject'; title?: string; description?: string; level?: Level; source_url?: string }) =>
  (await client.patch(`/controversy-proposals/${id}`, data)).data

// ── Grafts / bookmarks ──
export const getGrafts = async () => (await client.get('/grafts')).data
export const createGraft = async (data: { name: string; description?: string }) => (await client.post('/grafts', data)).data
export const deleteGraft = async (id: string) => (await client.delete(`/grafts/${id}`)).data
export const getGraftPoliticians = async (graftId: string) => (await client.get(`/grafts/${graftId}/politicians`)).data
export const getBookmarks = async () => (await client.get('/bookmarks')).data
export const addBookmark = async (data: { politician_id: string; graft_id?: string }) => (await client.post('/bookmarks', data)).data
export const moveBookmark = async ({ id, graft_id }: { id: string; graft_id: string | null }) => (await client.patch(`/bookmarks/${id}/move`, { graft_id })).data
export const removeBookmark = async (id: string) => (await client.delete(`/bookmarks/${id}`)).data
export const checkBookmark = async (politicianId: string) => (await client.get(`/bookmarks/check/${politicianId}`)).data

// ── Notifications ──
export const getNotifications = async () => (await client.get('/notifications')).data
export const getUnreadCount = async () => (await client.get('/notifications/unread-count')).data
export const markAllRead = async () => (await client.patch('/notifications/read-all')).data
export const markRead = async (id: string) => (await client.patch(`/notifications/${id}/read`)).data
export const clearNotifications = async () => (await client.delete('/notifications/clear')).data

// ── Funding / influence ──
export const getFunding = async (politicianId: string) => (await client.get(`/funding/${politicianId}`)).data
export const addFunding = async (data: { politician_id: string; source_name: string; source_type: string; amount: number }) => (await client.post('/funding', data)).data
export const deleteFunding = async (id: string) => (await client.delete(`/funding/${id}`)).data
export const getInfluence = async (politicianId: string) => (await client.get(`/influence/${politicianId}`)).data
export const addInfluence = async (data: { politician_id: string; country: string; country_code?: string; influence_score: number; notes?: string }) => (await client.post('/influence', data)).data
export const deleteInfluence = async (id: string) => (await client.delete(`/influence/${id}`)).data
