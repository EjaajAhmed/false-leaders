import 'dotenv/config'
import { db } from './client'
import { GOV_DATASETS, importAllGovernance, importGovernance } from '../services/governance'

// Usage: npm run import -- all
//        npm run import -- TI_CPI                    (from the dataset's URL)
//        npm run import -- RSF_PRESS ./rsf-2026.csv  (from a downloaded CSV in OWID layout)
const [which, source] = process.argv.slice(2)
;(async () => {
  if (!which || which === 'all') {
    const r = await importAllGovernance(m => console.log(m))
    console.log(JSON.stringify(r))
  } else if (GOV_DATASETS.some(d => d.code === which)) {
    console.log(JSON.stringify(await importGovernance(which, source)))
  } else {
    console.log('Datasets:', GOV_DATASETS.map(d => d.code).join(', '))
  }
  await db.end()
})().catch(err => { console.error(err); process.exit(1) })
