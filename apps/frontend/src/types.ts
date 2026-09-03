export type Level = 'confirmed' | 'likely' | 'maybe' | 'speculative'
export type VerdictKind = 'guilty' | 'suspicious' | 'unclear' | 'clean'
export type Category = 'world_leader' | 'politician' | 'business' | 'media' | 'judiciary' | 'religious' | 'international' | 'military' | 'other'
export type FeedType = 'score_change' | 'leak' | 'controversy' | 'controversy_escalated' | 'verdict_shift'

export interface VerdictCounts {
  total: number
  guilty: number
  suspicious: number
  unclear: number
  clean: number
}

export interface VerdictAggregate extends Omit<VerdictCounts, 'total'> {
  total: number
  counts: VerdictCounts
  percentages: Record<VerdictKind, number>
  dominant: VerdictKind | null
  score: number | null
}

export interface ScorePoint { d: string; s: number }

export interface Leader {
  id: string
  name: string
  party?: string | null
  region?: string | null
  position?: string | null
  bio?: string | null
  photo_url?: string | null
  country?: string | null
  category?: Category | string | null
  prominence?: number
  attention?: number
  wiki_url?: string | null
  summary?: string | null
  born?: string | null
  net_worth?: number | string | null
  wikidata_id?: string | null
  country_code?: string | null
  current_office?: string | null
  term_start?: string | null
  term_end?: string | null
  age?: number | null
  aliases?: string[]
  truth_score?: number | string | null
  latitude?: number | string | null
  longitude?: number | string | null
  created_at?: string
  controversy_count?: number
  leak_count?: number
  verdict_counts?: VerdictCounts | null
  top_controversy?: { id?: string; title: string; level: Level } | null
}

export interface LeaderDetail extends Leader {
  truth_score: number
  score_history: ScorePoint[]
  verdicts: { total: number; counts: VerdictCounts; percentages: Record<VerdictKind, number>; dominant: VerdictKind | null; score: number | null }
  stats: { controversies: number; verdicts: number; leaks: number; comments: number }
}

export interface FeedEvent {
  id: string
  type: FeedType
  leader_id: string | null
  leader_name: string | null
  meta: Record<string, any>
  created_at: string
}
