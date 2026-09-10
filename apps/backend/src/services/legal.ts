/** Legal surface configuration. The text itself lives in the frontend as a marked draft. */
export const TERMS_VERSION = process.env.TERMS_VERSION || 'draft-2026-09-10'
export const ABUSE_EMAIL = process.env.ABUSE_EMAIL || 'abuse@falseleaders.com'
/** Stated response window for takedown notices, in days. Placeholder until counsel sets it. */
export const TAKEDOWN_RESPONSE_DAYS = Number(process.env.TAKEDOWN_RESPONSE_DAYS || 7)
