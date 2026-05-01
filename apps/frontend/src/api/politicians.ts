import client from './client'

export const getPoliticians = async (filters?: {
  search?: string
  country?: string
  party?: string
  min_age?: number
  max_age?: number
  min_truth?: number
  max_truth?: number
  page?: number
  limit?: number
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

export const getComments = async (politicianId: string) => {
  const res = await client.get(`/comments/${politicianId}`)
  return res.data
}

export const postComment = async (data: { politician_id: string; body: string }) => {
  const res = await client.post('/comments', data)
  return res.data
}

export const deleteComment = async (id: string) => {
  const res = await client.delete(`/comments/${id}`)
  return res.data
}

export const vote = async (data: { politician_id: string; type: 'up' | 'down' }) => {
  const res = await client.post('/votes', data)
  return res.data
}

export const getVotes = async (politicianId: string) => {
  const res = await client.get(`/votes/${politicianId}`)
  return res.data
}

export const getLeaderboard = async () => {
    const res = await client.get('/home/leaderboard')
    return res.data
  }
  
  export const getRecent = async () => {
    const res = await client.get('/home/recent')
    return res.data
  }

  export const getGrafts = async () => {
    const res = await client.get('/grafts')
    return res.data
  }
  
  export const createGraft = async (data: { name: string; description?: string }) => {
    const res = await client.post('/grafts', data)
    return res.data
  }
  
  export const deleteGraft = async (id: string) => {
    const res = await client.delete(`/grafts/${id}`)
    return res.data
  }
  
  export const getGraftPoliticians = async (graftId: string) => {
    const res = await client.get(`/grafts/${graftId}/politicians`)
    return res.data
  }
  
  export const getBookmarks = async () => {
    const res = await client.get('/bookmarks')
    return res.data
  }
  
  export const addBookmark = async (data: { politician_id: string; graft_id?: string }) => {
    const res = await client.post('/bookmarks', data)
    return res.data
  }
  
  export const moveBookmark = async ({ id, graft_id }: { id: string; graft_id: string | null }) => {
    const res = await client.patch(`/bookmarks/${id}/move`, { graft_id })
    return res.data
  }
  
  export const removeBookmark = async (id: string) => {
    const res = await client.delete(`/bookmarks/${id}`)
    return res.data
  }
  
  export const checkBookmark = async (politicianId: string) => {
    const res = await client.get(`/bookmarks/check/${politicianId}`)
    return res.data
  }

  export const getControversies = async (politicianId: string) => {
    const res = await client.get(`/controversies/${politicianId}`)
    return res.data
  }
  
  export const addControversy = async (data: {
    politician_id: string
    title: string
    description: string
    source_url?: string
    level: string
  }) => {
    const res = await client.post('/controversies', data)
    return res.data
  }
  
  export const updateControversy = async ({ id, ...data }: any) => {
    const res = await client.put(`/controversies/${id}`, data)
    return res.data
  }
  
  export const deleteControversy = async (id: string) => {
    const res = await client.delete(`/controversies/${id}`)
    return res.data
  }

  export const getNotifications = async () => {
    const res = await client.get('/notifications')
    return res.data
  }
  
  export const getUnreadCount = async () => {
    const res = await client.get('/notifications/unread-count')
    return res.data
  }
  
  export const markAllRead = async () => {
    const res = await client.patch('/notifications/read-all')
    return res.data
  }
  
  export const markRead = async (id: string) => {
    const res = await client.patch(`/notifications/${id}/read`)
    return res.data
  }
  
  export const clearNotifications = async () => {
    const res = await client.delete('/notifications/clear')
    return res.data
  }

  export const getFunding = async (politicianId: string) => {
    const res = await client.get(`/funding/${politicianId}`)
    return res.data
  }
  
  export const addFunding = async (data: { politician_id: string; source_name: string; source_type: string; amount: number }) => {
    const res = await client.post('/funding', data)
    return res.data
  }
  
  export const deleteFunding = async (id: string) => {
    const res = await client.delete(`/funding/${id}`)
    return res.data
  }
  
  export const getInfluence = async (politicianId: string) => {
    const res = await client.get(`/influence/${politicianId}`)
    return res.data
  }
  
  export const addInfluence = async (data: { politician_id: string; country: string; country_code?: string; influence_score: number; notes?: string }) => {
    const res = await client.post('/influence', data)
    return res.data
  }
  
  export const deleteInfluence = async (id: string) => {
    const res = await client.delete(`/influence/${id}`)
    return res.data
  }