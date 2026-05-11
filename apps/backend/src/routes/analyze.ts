import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { authenticate } from '../middleware/auth'

async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FalseLeaders/1.0)' },
      signal: AbortSignal.timeout(10000)
    })
    const html = await res.text()
    const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.slice(0, 8000)
  } catch {
    return ''
  }
}

export async function analyzeRoutes(server: FastifyInstance) {

  // Analyze articles and return extracted data for review
  server.post('/:id/analyze', { onRequest: [authenticate] }, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    const { urls = [], rawText = '' } = request.body as { urls?: string[]; rawText?: string }

    const { rows } = await db.query('SELECT name FROM politicians WHERE id = $1', [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })
    const name = rows[0].name

    // Fetch article content
    let combined = rawText || ''
    for (const url of urls.slice(0, 10)) {
      const text = await fetchArticleText(url)
      if (text) combined += `\n\n--- Source: ${url} ---\n${text}`
    }

    if (!combined.trim()) return reply.status(400).send({ error: 'No content to analyze' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return reply.status(500).send({ error: 'GEMINI_API_KEY not configured in Railway env vars' })

    const prompt = `You are a political research analyst. Analyze these articles about the Canadian politician "${name}" and extract structured data.

Return ONLY a valid JSON object with no markdown, no explanation, nothing else. Use this exact structure:

{
  "funding_sources": [
    {
      "source_name": "Donor or organization name",
      "source_type": "Corporate | Individual | Government | Foreign | PAC | Union | Unknown",
      "amount": 0,
      "currency": "CAD",
      "notes": "Brief context about this donation"
    }
  ],
  "foreign_influence": [
    {
      "country": "Country name",
      "influence_type": "Donation | Meeting | Travel | Lobbying | Contract | Other",
      "influence_score": 50,
      "notes": "Brief description of the foreign connection"
    }
  ],
  "controversies": [
    {
      "title": "Short title under 10 words",
      "description": "1-2 sentence factual description",
      "level": "confirmed | likely | maybe | speculative",
      "source_url": ""
    }
  ]
}

Scoring guide for influence_score (0-100):
- 80-100: Direct foreign government funding, active foreign lobbying
- 60-79: Significant foreign donations, frequent foreign government meetings
- 40-59: Foreign travel funded by foreign entity, occasional foreign meetings
- 20-39: Minor foreign connections, attended foreign-sponsored events
- 0-19: Tangential or very indirect foreign connection

Controversy level guide:
- confirmed: Proven by court, official investigation, or admission
- likely: Strong evidence but not officially confirmed
- maybe: Credible allegations with some supporting evidence
- speculative: Rumours or very weak evidence

Only include items clearly supported by the text. Empty arrays are fine if nothing found.

ARTICLES TO ANALYZE:
${combined.slice(0, 50000)}`

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
          })
        }
      )

      const data = await geminiRes.json() as any
      if (!geminiRes.ok) return reply.status(500).send({ error: data?.error?.message || 'Gemini API error' })

      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      return parsed
    } catch (err: any) {
      return reply.status(500).send({ error: `Failed to parse Gemini response: ${err.message}` })
    }
  })

  // Save selected items to DB and recalculate score
  server.post('/:id/analyze/save', { onRequest: [authenticate] }, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    const { funding_sources = [], foreign_influence = [], controversies = [] } = request.body as any

    for (const f of funding_sources) {
      await db.query(
        `INSERT INTO funding_sources (politician_id, source_name, source_type, amount, currency, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, f.source_name, f.source_type, Number(f.amount) || 0, f.currency || 'CAD', f.notes || null]
      )
    }

    for (const inf of foreign_influence) {
      await db.query(
        `INSERT INTO foreign_influence (politician_id, country, influence_type, influence_score, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, inf.country, inf.influence_type || 'Other', Number(inf.influence_score) || 50, inf.notes || null]
      )
    }

    for (const c of controversies) {
      await db.query(
        `INSERT INTO controversies (politician_id, title, description, level, source_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, c.title, c.description, c.level || 'speculative', c.source_url || null]
      )
    }

    // Recalculate truth score
    const { rows: config } = await db.query('SELECT key, value FROM truth_score_config')
    const cfg: Record<string, number> = {}
    for (const c of config) cfg[c.key] = Number(c.value)

    const { rows: allControversies } = await db.query('SELECT level FROM controversies WHERE politician_id = $1', [id])
    const { rows: allFunding } = await db.query('SELECT source_type, amount FROM funding_sources WHERE politician_id = $1', [id])
    const { rows: allInfluence } = await db.query('SELECT influence_score FROM foreign_influence WHERE politician_id = $1', [id])

    let score = cfg.base_score ?? 90
    for (const c of allControversies) score -= cfg[`weight_${c.level}`] ?? 0
    if (allFunding.length > 0) {
      const total = allFunding.reduce((s: number, f: any) => s + Number(f.amount), 0)
      const corp = allFunding.filter((f: any) => ['Corporate', 'PAC'].includes(f.source_type))
        .reduce((s: number, f: any) => s + Number(f.amount), 0)
      if (total > 0 && (corp / total) * 100 > (cfg.funding_corporate_threshold ?? 60)) {
        score -= cfg.funding_corporate_penalty ?? 10
      }
    }
    for (const inf of allInfluence) {
      if (Number(inf.influence_score) > (cfg.funding_foreign_threshold ?? 60)) {
        score -= cfg.funding_foreign_penalty ?? 10
      }
    }
    score = Math.max(1, Math.min(100, Math.round(score)))
    await db.query('UPDATE politicians SET truth_score = $1 WHERE id = $2', [score, id])

    return { success: true, new_truth_score: score }
  })
}