"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("./client");
async function migrate() {
    const migrationsDir = path_1.default.join(__dirname, 'migrations');
    const files = fs_1.default.readdirSync(migrationsDir).sort();
    await client_1.db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      run_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    for (const file of files) {
        const { rows } = await client_1.db.query('SELECT name FROM migrations WHERE name = $1', [file]);
        if (rows.length > 0) {
            console.log(`Skipping ${file} — already run`);
            continue;
        }
        const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf8');
        await client_1.db.query(sql);
        await client_1.db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        console.log(`Ran migration: ${file}`);
    }
    await client_1.db.end();
    console.log('All migrations complete');
}
migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
