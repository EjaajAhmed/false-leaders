import { db } from '../db/client'
import { generateText } from './gemini'
import { recalculateScore } from './score'

const SITE = process.env.FRONTEND_URL || 'https://falseleaders.com'

export async function fetchDocumentText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FalseLeaders/1.0; +https://falseleaders.com)' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching document`)
  const html = await res.text()
  const body = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  const main = body.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || body
  const text = main.replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
  if (text.length < 200) throw new Error('Could not extract readable text from that page')
  return text.slice(0, 60000)
}

function parseJson(raw: string | null): any {
  if (!raw) return null
  const clean = raw.replace(/```json|```/g, '').trim()
  try { return JSON.parse(clean) } catch { const m = clean.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) } catch { return null } } return null }
}

/** Extract promises and key claims from one document. Returns counts; rows are drafts. */
export async function extractFromDocument(documentId: string): Promise<{ promises: number; claims: number }> {
  const { rows } = await db.query(`SELECT d.*, p.name FROM documents d JOIN politicians p ON p.id = d.politician_id WHERE d.id = $1`, [documentId])
  const doc = rows[0]
  if (!doc) throw new Error('No such document')
  const prompt = `You are an archivist extracting verifiable commitments and clear positions from a document attributed to ${doc.name}${doc.spoken_on ? ` (dated ${String(doc.spoken_on).slice(0, 10)})` : ''}.

Return ONLY a JSON object, no markdown, in this shape:
{
  "promises": [ { "promise": "<one-sentence restatement of a specific, checkable commitment>", "quote": "<the exact supporting words from the document, verbatim, under 60 words>", "topic": "<2-4 word topic>" } ],
  "claims": [ { "quote": "<exact verbatim statement of a position or factual claim, under 50 words>", "topic": "<2-4 word topic>", "stance": "<one short neutral phrase describing the position taken>" } ]
}

Rules:
- Only include commitments the speaker makes on their own or their government's behalf; not descriptions of others, not hypotheticals, not vague aspirations ("we will do better").
- The "quote" must be copied verbatim from the document. If you cannot find exact words, leave the item out.
- Prefer specific, checkable promises (numbers, dates, named actions). Maximum 12 promises and 15 claims.
- Do not add judgement, context or adjectives of opinion. Empty arrays are fine.

DOCUMENT:
${String(doc.text).slice(0, 40000)}`
  const parsed = parseJson(await generateText(prompt, { maxTokens: 3000, temperature: 0.1 }))
  if (!parsed) return { promises: 0, claims: 0 }
  const sourceUrl = doc.url || `${SITE}/leaders/${doc.politician_id}?tab=promises`
  const text: string = doc.text
  let n = 0
  for (const p of (parsed.promises || []).slice(0, 12)) {
    if (!p?.promise || !p?.quote) continue
    // Verbatim check: the quote must appear in the document (whitespace-insensitive).
    const q = String(p.quote).replace(/\s+/g, ' ').trim()
    if (!text.replace(/\s+/g, ' ').toLowerCase().includes(q.toLowerCase().slice(0, Math.min(q.length, 80)))) continue
    await db.query(
      `INSERT INTO promises (politician_id, document_id, text, quote, topic, promised_on, status, review_status, source_url) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'draft', $7)`,
      [doc.politician_id, documentId, String(p.promise).slice(0, 500), q.slice(0, 600), p.topic ? String(p.topic).slice(0, 80) : null, doc.spoken_on || null, sourceUrl]
    )
    n++
  }
  const claims = (parsed.claims || []).slice(0, 15).filter((c: any) => c?.quote).map((c: any) => ({ quote: String(c.quote).slice(0, 500), topic: c.topic ? String(c.topic).slice(0, 80) : null, stance: c.stance ? String(c.stance).slice(0, 200) : null }))
  await db.query('UPDATE documents SET claims = $1 WHERE id = $2', [JSON.stringify(claims), documentId])
  return { promises: n, claims: claims.length }
}

/** Compare claims across all of a leader's documents and draft contradiction pairs. */
export async function scanContradictions(politicianId: string): Promise<{ found: number; documents: number }> {
  const { rows } = await db.query(`SELECT d.id, d.title, d.url, d.spoken_on::text, d.claims, p.name FROM documents d JOIN politicians p ON p.id = d.politician_id WHERE d.politician_id = $1 ORDER BY d.spoken_on NULLS LAST`, [politicianId])
  const docs = rows.filter(d => Array.isArray(d.claims) && d.claims.length)
  if (docs.length < 2) return { found: 0, documents: docs.length }
  const name = rows[0].name
  const listing = docs.map((d, i) => `DOC ${i + 1} — "${d.title}"${d.spoken_on ? `, ${d.spoken_on}` : ''}${d.url ? `, ${d.url}` : ''}\n` + d.claims.map((c: any, j: number) => `  [${i + 1}.${j + 1}] (${c.topic || 'general'}) "${c.quote}"`).join('\n')).join('\n\n')
  const prompt = `Below are verbatim statements by ${name}, grouped by source document. Identify pairs of statements where the same person takes opposing positions on the same specific question.

Return ONLY a JSON object: { "pairs": [ { "a": "<ref like 1.2>", "b": "<ref like 3.1>", "topic": "<2-5 words>", "explanation": "<one neutral sentence stating what differs, without judgement>" } ] }

Rules: only genuine opposition on the same question, not a change of emphasis, not different topics, not a later statement that merely adds detail. Maximum 8 pairs. Empty list is fine.

${listing}`
  const parsed = parseJson(await generateText(prompt, { maxTokens: 1500, temperature: 0.1 }))
  const pairs: any[] = parsed?.pairs || []
  let found = 0
  const ref = (r: string) => { const m = String(r).match(/(\d+)\.(\d+)/); if (!m) return null; const d = docs[Number(m[1]) - 1]; const c = d?.claims?.[Number(m[2]) - 1]; return d && c ? { d, c } : null }
  for (const p of pairs.slice(0, 8)) {
    const a = ref(p.a), b = ref(p.b)
    if (!a || !b || a.d.id === b.d.id) continue
    const src = (d: any) => d.url || `${SITE}/leaders/${politicianId}?tab=contradictions`
    const { rows: dup } = await db.query('SELECT 1 FROM contradictions WHERE politician_id = $1 AND quote_a = $2 AND quote_b = $3', [politicianId, a.c.quote, b.c.quote])
    if (dup.length) continue
    await db.query(
      `INSERT INTO contradictions (politician_id, topic, quote_a, date_a, source_a, quote_b, date_b, source_b, explanation, review_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')`,
      [politicianId, p.topic ? String(p.topic).slice(0, 80) : null, a.c.quote, a.d.spoken_on || null, src(a.d), b.c.quote, b.d.spoken_on || null, src(b.d), p.explanation ? String(p.explanation).slice(0, 400) : null]
    )
    found++
  }
  return { found, documents: docs.length }
}

export async function getPromises(politicianId: string, includeDrafts = false) {
  const { rows } = await db.query(
    `SELECT pr.id, pr.text, pr.quote, pr.topic, pr.promised_on::text, pr.status, pr.evidence_url, pr.evidence_note, pr.review_status, pr.source_url, pr.created_at, pr.reviewed_at, d.title AS document_title
     FROM promises pr LEFT JOIN documents d ON d.id = pr.document_id
     WHERE pr.politician_id = $1 AND ${includeDrafts ? "pr.review_status <> 'rejected'" : "pr.review_status = 'published'"}
     ORDER BY pr.promised_on DESC NULLS LAST, pr.created_at DESC`,
    [politicianId]
  )
  return rows
}

export async function getContradictions(politicianId: string, includeDrafts = false) {
  const { rows } = await db.query(
    `SELECT id, topic, quote_a, date_a::text, source_a, quote_b, date_b::text, source_b, explanation, review_status, created_at
     FROM contradictions WHERE politician_id = $1 AND ${includeDrafts ? "review_status <> 'rejected'" : "review_status = 'published'"} ORDER BY created_at DESC`,
    [politicianId]
  )
  return rows
}

export async function afterPromiseReview(politicianId: string) {
  await recalculateScore(politicianId)
}
