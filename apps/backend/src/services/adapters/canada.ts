import { fetchJson } from '../jobs'
import type { CountryAdapter, LeaderRef } from './types'

const UA = 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)'
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`)); return m ? m[1] : '' }

let membersCache: { at: number; list: { id: string; first: string; last: string; party: string; riding: string }[] } | null = null

async function members() {
  if (membersCache && Date.now() - membersCache.at < 12 * 3600000) return membersCache.list
  const res = await fetch('https://www.ourcommons.ca/Members/en/search/xml', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
  const xml = await res.text()
  const list = [...xml.matchAll(/<MemberOfParliament>([\s\S]*?)<\/MemberOfParliament>/g)].map(m => ({
    id: tag(m[1], 'PersonId'), first: tag(m[1], 'PersonOfficialFirstName'), last: tag(m[1], 'PersonOfficialLastName'),
    party: tag(m[1], 'CaucusShortName'), riding: tag(m[1], 'ConstituencyName'),
  }))
  membersCache = { at: Date.now(), list }
  return list
}

/** Canada · House of Commons recorded divisions, from the OurCommons XML feeds. */
export const canadaVotes: CountryAdapter = {
  country: 'CAN', kind: 'votes', name: 'House of Commons of Canada (ourcommons.ca)',
  async fetch(leader: LeaderRef) {
    const list = await members()
    const target = norm(leader.name)
    const mp = list.find(m => norm(`${m.first} ${m.last}`) === target) || list.find(m => target.endsWith(norm(m.last)) && target.startsWith(norm(m.first).split(' ')[0]))
    const pageUrl = mp ? `https://www.ourcommons.ca/Members/en/${mp.first}-${mp.last}(${mp.id})/votes`.replace(/\s+/g, '-') : 'https://www.ourcommons.ca/Members/en/search'
    if (!mp) return { summary: { reason: 'Not a sitting member of the House of Commons.' }, items: [], source_name: this.name, source_url: pageUrl, license: 'Open Government Licence – Canada', status: 'no_match' }
    const res = await fetch(`https://www.ourcommons.ca/Members/en/member(${mp.id})/votes/xml`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
    const xml = await res.text()
    const votes = [...xml.matchAll(/<MemberVote>([\s\S]*?)<\/MemberVote>/g)].map(m => ({
      date: tag(m[1], 'DecisionEventDateTime').slice(0, 10),
      subject: tag(m[1], 'DecisionDivisionSubject').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
      bill: tag(m[1], 'BillNumberCode') || null,
      result: tag(m[1], 'DecisionResultName'),
      yeas: Number(tag(m[1], 'DecisionDivisionNumberOfYeas')), nays: Number(tag(m[1], 'DecisionDivisionNumberOfNays')),
      vote: tag(m[1], 'VoteValueName') || (tag(m[1], 'IsVoteYea') === 'true' ? 'Yea' : tag(m[1], 'IsVoteNay') === 'true' ? 'Nay' : tag(m[1], 'IsVotePaired') === 'true' ? 'Paired' : ''),
      parliament: tag(m[1], 'ParliamentNumber'), session: tag(m[1], 'SessionNumber'),
    }))
    const yea = votes.filter(v => v.vote === 'Yea').length, nay = votes.filter(v => v.vote === 'Nay').length, paired = votes.filter(v => v.vote === 'Paired').length
    const withMajority = votes.filter(v => v.vote === 'Yea' || v.vote === 'Nay')
    const withResult = withMajority.filter(v => (v.vote === 'Yea') === (v.result === 'Agreed To')).length
    return {
      external_id: mp.id,
      summary: { total: votes.length, yea, nay, paired, on_winning_side_pct: withMajority.length ? Math.round((withResult / withMajority.length) * 100) : null, party: mp.party, riding: mp.riding, since: votes.length ? votes[votes.length - 1].date : null },
      items: votes.slice(0, 15),
      source_name: this.name, source_url: pageUrl, license: 'Open Government Licence – Canada',
    }
  },
}

export const _canadaHelpers = { fetchJson }
