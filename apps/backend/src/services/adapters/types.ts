export type RecordKind = 'votes' | 'money' | 'courts'

export interface LeaderRef { id: string; name: string; country_code: string | null; born: string | null; party: string | null; category: string }

export interface AdapterResult {
  external_id?: string | null
  summary: Record<string, unknown>
  items: Record<string, unknown>[]
  source_name: string
  source_url: string
  license?: string
  status?: 'ok' | 'no_match'
}

/** One adapter provides one kind of record for one country. */
export interface CountryAdapter {
  country: string           // ISO3
  kind: RecordKind
  name: string              // human-readable source, shown on the page
  fetch(leader: LeaderRef): Promise<AdapterResult>
}
