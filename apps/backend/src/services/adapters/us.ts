import { fetchJson } from '../jobs'
import type { CountryAdapter, LeaderRef } from './types'

const UA = { 'User-Agent': 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)' }
const fecKey = () => process.env.FEC_API_KEY || 'DEMO_KEY'
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

/** United States · federal campaign finance from the FEC's OpenFEC API. */
export const usMoney: CountryAdapter = {
  country: 'USA', kind: 'money', name: 'Federal Election Commission (OpenFEC)',
  async fetch(leader: LeaderRef) {
    const q = leader.name.replace(/\b(jr|sr|ii|iii)\.?$/i, '').trim()
    const search = await fetchJson(`https://api.open.fec.gov/v1/candidates/search/?q=${encodeURIComponent(q)}&api_key=${fecKey()}&sort=-election_years&per_page=10`, { headers: UA, retries: 2 })
    if (search === null) throw new Error(`OpenFEC unavailable or rate-limited${process.env.FEC_API_KEY ? '' : ' (DEMO_KEY allows 40 calls per hour; set FEC_API_KEY)'}`)
    const tokens = norm(leader.name).split(' ').filter(t => t.length > 1)
    const cand = (search?.results || []).find((c: any) => { const n = norm(c.name); return tokens.every(t => n.includes(t)) && c.has_raised_funds })
    const pageUrl = cand ? `https://www.fec.gov/data/candidate/${cand.candidate_id}/` : 'https://www.fec.gov/data/'
    if (!cand) {
      // Not a candidate: look at what they gave. Individual contributions are itemised above $200.
      const last = leader.name.split(' ').slice(-1)[0], first = leader.name.split(' ')[0]
      const donorName = `${last}, ${first}`.toUpperCase()
      const thisYear = new Date().getUTCFullYear()
      const cycles = [thisYear % 2 === 0 ? thisYear : thisYear + 1, (thisYear % 2 === 0 ? thisYear : thisYear + 1) - 2]
      const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(donorName)}&two_year_transaction_period=${cycles[0]}&two_year_transaction_period=${cycles[1]}&sort=-contribution_receipt_amount&per_page=100&api_key=${fecKey()}`
      const data = await fetchJson(url, { headers: UA, retries: 2 })
      if (data === null) throw new Error(`OpenFEC unavailable or rate-limited${process.env.FEC_API_KEY ? '' : ' (DEMO_KEY allows 40 calls per hour; set FEC_API_KEY)'}`)
      const results: any[] = (data?.results || []).filter((r: any) => norm(r.contributor_name || '').includes(norm(last)) && norm(r.contributor_name || '').includes(norm(first)))
      const byCommittee = new Map<string, { committee: string; committee_id: string; total: number; count: number; latest: string }>()
      for (const r of results) {
        const key = r.committee?.committee_id || r.committee_id || 'unknown'
        const cur = byCommittee.get(key) || { committee: r.committee?.name || key, committee_id: key, total: 0, count: 0, latest: '' }
        cur.total += Number(r.contribution_receipt_amount) || 0; cur.count++
        if ((r.contribution_receipt_date || '') > cur.latest) cur.latest = String(r.contribution_receipt_date || '').slice(0, 10)
        byCommittee.set(key, cur)
      }
      const items = [...byCommittee.values()].sort((a, b) => b.total - a.total).slice(0, 8).map(c => ({ ...c, total: Math.round(c.total), url: `https://www.fec.gov/data/committee/${c.committee_id}/` }))
      const total = items.reduce((s, c) => s + c.total, 0)
      const donorUrl = `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(donorName)}`
      if (results.length === 0) return { summary: { reason: 'No federal candidate record and no itemised contributions under this name in the last two cycles.', role: 'none', api_count: data?.pagination?.count ?? null, api_results: (data?.results || []).length, sample_names: [...new Set((data?.results || []).slice(0, 5).map((r: any) => r.contributor_name))], candidates_seen: (search?.results || []).slice(0, 3).map((c: any) => `${c.name} (${c.office}, funds:${c.has_raised_funds})`) }, items: [], source_name: this.name, source_url: donorUrl, license: 'Public domain (US federal data)', status: 'no_match' }
      return {
        external_id: donorName,
        summary: { role: 'donor', cycles, contributions: results.length, total_itemised: Math.round(total), truncated: (data?.pagination?.count || 0) > results.length },
        items, source_name: this.name, source_url: donorUrl, license: 'Public domain (US federal data)',
      }
    }
    const totals = await fetchJson(`https://api.open.fec.gov/v1/candidate/${cand.candidate_id}/totals/?api_key=${fecKey()}&election_full=true&sort=-cycle&per_page=10`, { headers: UA, retries: 2 })
    const rows: any[] = (totals?.results || []).filter((r: any) => r.receipts != null)
    const latest = rows.sort((a: any, b: any) => (b.candidate_election_year || 0) - (a.candidate_election_year || 0) || (b.receipts || 0) - (a.receipts || 0))[0]
    const cycle = latest?.candidate_election_year || cand.election_years?.slice(-1)[0]
    const byEmployer = cycle ? await fetchJson(`https://api.open.fec.gov/v1/schedules/schedule_a/by_employer/?candidate_id=${cand.candidate_id}&cycle=${cycle}&api_key=${fecKey()}&sort=-total&per_page=8`, { headers: UA, retries: 1 }) : null
    const employers = (byEmployer?.results || []).map((e: any) => ({ employer: e.employer, total: Math.round(e.total), count: e.count }))
    return {
      external_id: cand.candidate_id,
      summary: {
        role: 'candidate', candidate: cand.name, office: cand.office_full, party: cand.party_full, cycle,
        receipts: latest?.receipts ?? null, disbursements: latest?.disbursements ?? null, individual_contributions: latest?.individual_contributions ?? null,
        unitemized: latest?.individual_unitemized_contributions ?? null, cash_on_hand: latest?.last_cash_on_hand_end_period ?? null, debts: latest?.last_debts_owed_by_committee ?? null,
        coverage_end: latest?.coverage_end_date ? String(latest.coverage_end_date).slice(0, 10) : null,
      },
      items: employers,
      source_name: this.name, source_url: pageUrl, license: 'Public domain (US federal data)',
    }
  },
}

/** United States · court opinions naming the person, from CourtListener's search API. */
export const usCourts: CountryAdapter = {
  country: 'USA', kind: 'courts', name: 'CourtListener (Free Law Project)',
  async fetch(leader: LeaderRef) {
    const headers: Record<string, string> = { ...UA }
    if (process.env.COURTLISTENER_API_KEY) headers.Authorization = `Token ${process.env.COURTLISTENER_API_KEY}`
    const q = `"${leader.name.replace(/\b(jr|sr|ii|iii)\.?$/i, '').trim()}"`
    const url = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=o&order_by=dateFiled%20desc`
    const data = await fetchJson(url, { headers, retries: 2 })
    const pageUrl = `https://www.courtlistener.com/?q=${encodeURIComponent(q)}&type=o&order_by=dateFiled%20desc`
    if (!data) throw new Error('CourtListener unavailable or rate-limited')
    const items = (data.results || []).slice(0, 12).map((r: any) => ({
      case: r.caseName, court: r.court, date: r.dateFiled, url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : null,
      party: /\bv\.?\s/i.test(r.caseName || '') && new RegExp(leader.name.split(' ').slice(-1)[0], 'i').test(r.caseName || ''),
    }))
    return {
      summary: { opinions_mentioning: data.count, as_named_party: items.filter((i: any) => i.party).length, window: 'all years, newest first' },
      items, source_name: this.name, source_url: pageUrl, license: 'CourtListener, CC0 metadata',
    }
  },
}
