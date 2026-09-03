import 'dotenv/config'
import dns from 'dns'
dns.setDefaultResultOrder('ipv4first')
import { db } from './client'
import { syncMedia, getMedia } from '../services/gdelt'
;(async () => {
  for (const name of ['Keir Starmer', 'Donald Trump']) {
    const { rows } = await db.query('SELECT id FROM politicians WHERE name = $1', [name])
    const t0 = Date.now()
    console.log(name, 'sync', JSON.stringify(await syncMedia(rows[0].id)), `${Math.round((Date.now() - t0) / 1000)}s`)
    const m: any = await getMedia(rows[0].id, true)
    const { source_countries, ...rest } = m.summary || {}
    console.log('  days', m.daily.length, JSON.stringify(rest), JSON.stringify(source_countries?.slice(0, 4)))
    console.log('  spikes', m.spikes.map((s: any) => `${s.day} x${s.ratio} (${s.articles}) :: ${s.summary}`).join(' || '))
  }
  await db.end()
})()
