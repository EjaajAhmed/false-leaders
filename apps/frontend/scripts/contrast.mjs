// WCAG 2.x contrast audit for each theme's token pairs. Run: node contrast.mjs
const themes = {
  '1984 Classic': { surface:'#14120F', panel:'#1A1713', elevated:'#211D18', text:'#F0E3BE', heading:'#F0E3BE', muted:'#A89D83', dim:'#6E6656', onAccent:'#F0E3BE', accent:'#8E2020', bar:'#8E2020', warn:'#D08A76', border:'#2B2621', borderStrong:'#3B342C', r4:'#F0E3BE', r3:'#C9B98F', r2:'#B5533C', r1:'#8E2020' },
  'Samizdat':     { surface:'#F2EDE0', panel:'#E4DAC4', elevated:'#EBE3D0', text:'#17140F', heading:'#17140F', muted:'#6B6355', dim:'#726A5B', onAccent:'#F2EDE0', accent:'#A8321E', bar:'#17140F', warn:'#A8321E', border:'#D6CCB2', borderStrong:'#B9AD90', r4:'#17140F', r3:'#6B6355', r2:'#B04A25', r1:'#A8321E' },
  'Echelon':      { surface:'#05090A', panel:'#0A1214', elevated:'#0F1B1E', text:'#5FCF8A', heading:'#6FE39A', muted:'#3E8A5C', dim:'#3D8B5A', onAccent:'#05090A', accent:'#E0A32E', bar:'#E0A32E', warn:'#E0A32E', border:'#143324', borderStrong:'#1F4D36', r4:'#6FE39A', r3:'#3E8A5C', r2:'#E0A32E', r1:'#C47A18' },
  "Blackout '77": { surface:'#000000', panel:'#0A0A0A', elevated:'#161616', text:'#FFFFFF', heading:'#FFFFFF', muted:'#9A9A9A', dim:'#777777', onAccent:'#000000', accent:'#F5D547', bar:'#FFFFFF', warn:'#F5D547', border:'#2E2E2E', borderStrong:'#4A4A4A', r4:'#FFFFFF', r3:'#C8C8C8', r2:'#9A9A9A', r1:'#F5D547' },
}
const lum = h => { const c = h.replace('#',''); const [r,g,b] = [0,2,4].map(i => parseInt(c.slice(i,i+2),16)/255).map(v => v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*r+0.7152*g+0.0722*b }
const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05) }
// [label, fg, bg, minimum]  4.5 body text, 3 large text / UI parts, 1.5 informational only
const checks = t => [
  ['body text on page', t.text, t.surface, 4.5], ['body text on card', t.text, t.panel, 4.5], ['body text on elevated', t.text, t.elevated, 4.5],
  ['heading on page', t.heading, t.surface, 3], ['muted text on page', t.muted, t.surface, 4.5], ['muted text on card', t.muted, t.panel, 4.5],
  ['dim hints on page (small)', t.dim, t.surface, 4.5], ['dim hints as large/UI', t.dim, t.surface, 3],
  ['accent as text (stamp marks) on page', t.accent, t.surface, 3], ['warn text on page', t.warn, t.surface, 4.5], ['warn text on card', t.warn, t.panel, 4.5],
  ['bar vs page (non-text)', t.bar, t.surface, 3], ['bar vs card (non-text)', t.bar, t.panel, 3],
  ['strong border vs page (non-text)', t.borderStrong, t.surface, 3], ['border vs page (decorative)', t.border, t.surface, 1.2],
  ['page text on primary button (bg = text)', t.surface, t.text, 4.5], ['on-accent text on accent (badges, unread count)', t.onAccent, t.accent, 4.5],
  ['rating trusted number', t.r4, t.surface, 4.5], ['rating divided number', t.r3, t.surface, 4.5], ['rating distrusted number', t.r2, t.surface, 4.5], ['rating condemned number', t.r1, t.surface, 4.5],
]
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n== ${name}`)
  for (const [label, fg, bg, min] of checks(t)) { const r = ratio(fg,bg); const ok = r >= min; if (!ok || process.argv.includes('--all')) console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2)} (min ${min})  ${label}  ${fg} on ${bg}`) }
}
