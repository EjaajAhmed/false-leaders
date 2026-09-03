/** Minimal Gemini text call. Returns null when the key is missing or the call fails. */
export async function generateText(prompt: string, opts: { maxTokens?: number; temperature?: number } = {}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: opts.temperature ?? 0.2, maxOutputTokens: opts.maxTokens ?? 400 } }),
        signal: AbortSignal.timeout(45000),
      }
    )
    const data: any = await res.json()
    if (!res.ok) return null
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
  } catch {
    return null
  }
}
