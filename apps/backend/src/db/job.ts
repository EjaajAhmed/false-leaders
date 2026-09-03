import 'dotenv/config'
import '../services/nightly'
import { db } from './client'
import { runJob } from '../services/jobs'

// Usage: npm run job -- wikidata | worldbank | wikipedia
const name = process.argv[2]
runJob(name).then(async r => { console.log(JSON.stringify(r.detail).slice(0, 2000)); await db.end(); process.exit(r.ok ? 0 : 1) })
