// Feature archive. These features are kept in the codebase and database but hidden
// from the product until they can be properly evidenced or resourced.
export const ARCHIVED = {
  controversies: true,
  funding: true,
  influence: true,
  /** Promise tracker and contradiction finder (Gemini draft-first). Archived 2026-09-10. */
  promises: true,
} as const

export type ViewKey = 'main' | 'world_leader' | 'figures' | 'politician' | 'all'
export const VIEWS: { key: ViewKey; label: string; blurb: string }[] = [
  { key: 'main', label: 'Main', blurb: 'Every world leader plus the 50 most consequential figures outside elected office.' },
  { key: 'world_leader', label: 'World leaders', blurb: 'Heads of state and government.' },
  { key: 'figures', label: 'Figures', blurb: 'Business, media, judiciary, religious, international and military.' },
  { key: 'politician', label: 'Politicians', blurb: 'Every politician on file, from heads of state to backbenchers.' },
  { key: 'all', label: 'All', blurb: 'Everyone on file.' },
]
