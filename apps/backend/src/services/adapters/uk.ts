import { fetchJson } from '../jobs'
import type { CountryAdapter, LeaderRef } from './types'

const UA = { 'User-Agent': 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)' }
const norm = (s: string) => s.toLowerCase().replace(/\b(sir|dame|rt hon|dr|mr|mrs|ms|lord|baroness)\b\.?/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

/** United Kingdom · House of Commons divisions, from the UK Parliament Members and Commons Votes APIs (no key needed). */
export const ukVotes: CountryAdapter = {
  country: 'GBR', kind: 'votes', name: 'UK Parliament (members-api and commonsvotes-api)',
  async fetch(leader: LeaderRef) {
    const search = await fetchJson(`https://members-api.parliament.uk/api/Members/Search?Name=${encodeURIComponent(leader.name)}&House=1&take=5`, { headers: UA, retries: 2 })
    const target = norm(leader.name)
    const hit = (search?.items || []).map((i: any) => i.value).find((m: any) => norm(m.nameDisplayAs) === target || norm(m.nameDisplayAs).split(' ').every((t: string) => target.includes(t)))
    const pageUrl = hit ? `https://members.parliament.uk/member/${hit.id}/voting` : 'https://members.parliament.uk/'
    if (!hit) return { summary: { reason: 'Not found among current or former Commons members.' }, items: [], source_name: this.name, source_url: pageUrl, license: 'Open Parliament Licence v3.0', status: 'no_match' }
    const divisions: any[] = (await fetchJson(`https://commonsvotes-api.parliament.uk/data/divisions.json/membervoting?queryParameters.memberId=${hit.id}&queryParameters.take=100`, { headers: UA, retries: 2 })) || []
    const items = divisions.map(d => ({
      date: String(d.PublishedDivision?.Date || '').slice(0, 10),
      subject: d.PublishedDivision?.Title,
      vote: d.MemberVotedAye ? 'Aye' : d.MemberVotedNo ? 'No' : d.MemberWasTeller ? 'Teller' : 'Absent',
      ayes: d.PublishedDivision?.AyeCount, noes: d.PublishedDivision?.NoCount,
      result: (d.PublishedDivision?.AyeCount || 0) > (d.PublishedDivision?.NoCount || 0) ? 'Ayes' : 'Noes',
      url: d.PublishedDivision?.DivisionId ? `https://votes.parliament.uk/Votes/Commons/Division/${d.PublishedDivision.DivisionId}` : null,
    }))
    const aye = items.filter(i => i.vote === 'Aye').length, no = items.filter(i => i.vote === 'No').length
    const decided = items.filter(i => i.vote === 'Aye' || i.vote === 'No')
    const winning = decided.filter(i => (i.vote === 'Aye') === (i.result === 'Ayes')).length
    return {
      external_id: String(hit.id),
      summary: { total: items.length, aye, no, on_winning_side_pct: decided.length ? Math.round((winning / decided.length) * 100) : null, party: hit.latestParty?.name, constituency: hit.latestHouseMembership?.membershipFrom, status: hit.latestHouseMembership?.membershipStatus?.statusDescription || null, window: 'most recent 100 divisions' },
      items: items.slice(0, 15),
      source_name: this.name, source_url: pageUrl, license: 'Open Parliament Licence v3.0',
    }
  },
}
