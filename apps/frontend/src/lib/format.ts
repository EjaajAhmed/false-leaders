import type { Category, Level, VerdictKind, FeedEvent } from '../types'

export const CATEGORIES: { value: Category; label: string; plural: string }[] = [
  { value: 'world_leader', label: 'World leader', plural: 'World leaders' },
  { value: 'politician', label: 'Politician', plural: 'Politicians' },
  { value: 'business', label: 'Business', plural: 'Business' },
  { value: 'media', label: 'Media', plural: 'Media' },
  { value: 'judiciary', label: 'Judiciary', plural: 'Judiciary' },
  { value: 'religious', label: 'Religious', plural: 'Religious' },
  { value: 'international', label: 'International', plural: 'International' },
  { value: 'military', label: 'Military', plural: 'Military' },
  { value: 'other', label: 'Other', plural: 'Other' },
]

export function categoryLabel(c: string | null | undefined): string {
  return CATEGORIES.find(x => x.value === c)?.label ?? 'Figure'
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null || isNaN(Number(score))) return 'var(--dim)'
  const s = Number(score)
  if (s >= 75) return 'var(--score-clean)'
  if (s >= 50) return 'var(--score-watch)'
  if (s >= 25) return 'var(--score-warn)'
  return 'var(--score-condemned)'
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return 'Unrated'
  const s = Number(score)
  if (s >= 75) return 'Clean'
  if (s >= 50) return 'Watch list'
  if (s >= 25) return 'Warning'
  return 'Condemned'
}

export const LEVELS: { value: Level; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'likely', label: 'Likely' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'speculative', label: 'Speculative' },
]

export const VERDICTS: { value: VerdictKind; label: string; color: string }[] = [
  { value: 'guilty', label: 'Guilty', color: 'var(--v-guilty)' },
  { value: 'suspicious', label: 'Suspicious', color: 'var(--v-suspicious)' },
  { value: 'unclear', label: 'Unclear', color: '#4a4844' },
  { value: 'clean', label: 'Clean', color: 'var(--v-clean)' },
]

export function verdictLabel(v: VerdictKind | null | undefined): string {
  return VERDICTS.find(x => x.value === v)?.label ?? 'No verdict'
}

export function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(months / 12)}y`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: '2-digit' })
}

export function compact(n: number | string | null | undefined): string {
  const v = Number(n)
  if (!v || isNaN(v)) return '0'
  if (v >= 1e12) return `${(v / 1e12).toFixed(1).replace(/\.0$/, '')}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, '')}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`
  return String(Math.round(v))
}

export function formatMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-CA')
}

export function leaderMeta(l: { position?: string | null; party?: string | null; region?: string | null; country?: string | null }): string {
  const party = l.party && l.party !== 'Independent' && l.party !== 'Monarchy' ? l.party : null
  return [l.position, party, l.country].filter(Boolean).join(' · ')
}

export function proleTag(n: number | null | undefined): string {
  return n == null ? 'Prole' : `Prole #${n}`
}

export interface FeedText {
  before: string
  after: string
  label: string
  detail?: string
  deltaClass?: 'delta-down' | 'delta-up'
}

/** Sentence for a feed event, split around the leader name so it can be linked. */
export function feedText(e: FeedEvent): FeedText {
  const m = e.meta || {}
  switch (e.type) {
    case 'score_change': {
      const delta = Number(m.delta ?? 0)
      const dir = delta < 0 ? 'dropped' : 'rose'
      const pts = Math.abs(delta)
      return {
        before: 'TruthScore for ',
        after: ` ${dir} ${pts} point${pts === 1 ? '' : 's'}`,
        label: 'Score',
        detail: `${m.from} → ${m.to}`,
        deltaClass: delta < 0 ? 'delta-down' : 'delta-up',
      }
    }
    case 'leak':
      return { before: `${proleTag(m.prole_number)} submitted a new Leak on `, after: '', label: 'Leak' }
    case 'controversy': {
      const lvl = String(m.level || 'speculative')
      const head = lvl === 'confirmed' ? 'New controversy confirmed' : `New controversy logged (${lvl})`
      return { before: `${head}: ${m.title} — `, after: '', label: 'Controversy' }
    }
    case 'controversy_escalated':
      return { before: `Leak escalated to controversy: ${m.title} — `, after: '', label: 'Escalation' }
    case 'verdict_shift':
      return { before: 'Community verdict on ', after: ` shifted to ${verdictLabel(m.to)}`, label: 'Verdict' }
    default:
      return { before: '', after: '', label: e.type }
  }
}
