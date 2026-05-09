"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.politiciansRoutes = politiciansRoutes;
const auth_1 = require("../middleware/auth");
const client_1 = require("../db/client");
const notify_1 = require("../services/notify");
async function politiciansRoutes(server) {
    const auth = { onRequest: [auth_1.authenticate] };
    server.get('/', async (request) => {
        const { search, country, party, min_age, max_age, min_truth, max_truth, page, limit } = request.query;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        const offset = (pageNum - 1) * limitNum;
        let baseQuery = `FROM politicians WHERE 1=1`;
        const params = [];
        let i = 1;
        if (search) {
            baseQuery += ` AND (name ILIKE $${i} OR party ILIKE $${i} OR region ILIKE $${i} OR position ILIKE $${i})`;
            params.push(`%${search}%`);
            i++;
        }
        if (country) {
            baseQuery += ` AND country ILIKE $${i}`;
            params.push(`%${country}%`);
            i++;
        }
        if (party) {
            baseQuery += ` AND party ILIKE $${i}`;
            params.push(`%${party}%`);
            i++;
        }
        if (min_age) {
            baseQuery += ` AND age >= $${i}`;
            params.push(Number(min_age));
            i++;
        }
        if (max_age) {
            baseQuery += ` AND age <= $${i}`;
            params.push(Number(max_age));
            i++;
        }
        if (min_truth) {
            baseQuery += ` AND truth_score >= $${i}`;
            params.push(Number(min_truth));
            i++;
        }
        if (max_truth) {
            baseQuery += ` AND truth_score <= $${i}`;
            params.push(Number(max_truth));
            i++;
        }
        const countResult = await client_1.db.query(`SELECT COUNT(*) ${baseQuery}`, params);
        const total = Number(countResult.rows[0].count);
        const dataParams = [...params, limitNum, offset];
        const { rows } = await client_1.db.query(`SELECT * ${baseQuery} ORDER BY name ASC LIMIT $${i} OFFSET $${i + 1}`, dataParams);
        return {
            politicians: rows,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            hasMore: offset + rows.length < total
        };
    });
    server.get('/meta', async () => {
        const { rows: countries } = await client_1.db.query(`SELECT DISTINCT country FROM politicians WHERE country IS NOT NULL ORDER BY country`);
        const { rows: parties } = await client_1.db.query(`SELECT DISTINCT party FROM politicians WHERE party IS NOT NULL ORDER BY party`);
        return {
            countries: countries.map(r => r.country),
            parties: parties.map(r => r.party)
        };
    });
    server.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const { rows } = await client_1.db.query('SELECT * FROM politicians WHERE id = $1', [id]);
        if (rows.length === 0)
            return reply.status(404).send({ error: 'Not found' });
        const politician = rows[0];
        // Get config
        const { rows: config } = await client_1.db.query('SELECT key, value FROM truth_score_config');
        const cfg = {};
        for (const c of config)
            cfg[c.key] = Number(c.value);
        // Get controversies
        const { rows: controversies } = await client_1.db.query('SELECT level FROM controversies WHERE politician_id = $1', [id]);
        // Get funding
        const { rows: funding } = await client_1.db.query('SELECT source_type, amount FROM funding_sources WHERE politician_id = $1', [id]);
        // Get foreign influence
        const { rows: influence } = await client_1.db.query('SELECT influence_score FROM foreign_influence WHERE politician_id = $1', [id]);
        // Calculate score
        const baseScore = cfg.base_score ?? 90;
        let score = baseScore;
        // Deduct for controversies
        for (const c of controversies) {
            const weight = cfg[`weight_${c.level}`] ?? 0;
            score -= weight;
        }
        // Deduct for corporate funding
        if (funding.length > 0) {
            const totalFunding = funding.reduce((sum, f) => sum + Number(f.amount), 0);
            const corporate = funding
                .filter((f) => ['Corporate', 'PAC'].includes(f.source_type))
                .reduce((sum, f) => sum + Number(f.amount), 0);
            const corporatePct = totalFunding > 0 ? (corporate / totalFunding) * 100 : 0;
            if (corporatePct > (cfg.funding_corporate_threshold ?? 60)) {
                score -= cfg.funding_corporate_penalty ?? 10;
            }
        }
        // Deduct for foreign influence
        for (const inf of influence) {
            if (Number(inf.influence_score) > (cfg.funding_foreign_threshold ?? 60)) {
                score -= cfg.funding_foreign_penalty ?? 10;
            }
        }
        score = Math.max(1, Math.min(100, Math.round(score)));
        // Update stored truth_score
        await client_1.db.query('UPDATE politicians SET truth_score = $1 WHERE id = $2', [score, id]);
        return { ...politician, truth_score: score };
    });
    server.post('/recalculate-all', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { rows: allPoliticians } = await client_1.db.query('SELECT id FROM politicians');
        const { rows: config } = await client_1.db.query('SELECT key, value FROM truth_score_config');
        const cfg = {};
        for (const c of config)
            cfg[c.key] = Number(c.value);
        let updated = 0;
        for (const p of allPoliticians) {
            const { rows: controversies } = await client_1.db.query('SELECT level FROM controversies WHERE politician_id = $1', [p.id]);
            const { rows: funding } = await client_1.db.query('SELECT source_type, amount FROM funding_sources WHERE politician_id = $1', [p.id]);
            const { rows: influence } = await client_1.db.query('SELECT influence_score FROM foreign_influence WHERE politician_id = $1', [p.id]);
            const baseScore = cfg.base_score ?? 90;
            let score = baseScore;
            for (const c of controversies) {
                score -= cfg[`weight_${c.level}`] ?? 0;
            }
            if (funding.length > 0) {
                const total = funding.reduce((sum, f) => sum + Number(f.amount), 0);
                const corporate = funding.filter((f) => ['Corporate', 'PAC'].includes(f.source_type)).reduce((sum, f) => sum + Number(f.amount), 0);
                if (total > 0 && (corporate / total) * 100 > (cfg.funding_corporate_threshold ?? 60)) {
                    score -= cfg.funding_corporate_penalty ?? 10;
                }
            }
            for (const inf of influence) {
                if (Number(inf.influence_score) > (cfg.funding_foreign_threshold ?? 60)) {
                    score -= cfg.funding_foreign_penalty ?? 10;
                }
            }
            score = Math.max(1, Math.min(100, Math.round(score)));
            await client_1.db.query('UPDATE politicians SET truth_score = $1 WHERE id = $2', [score, p.id]);
            updated++;
        }
        return { success: true, updated };
    });
    server.put('/:id', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { id } = request.params;
        const { name, party, region, position, bio, country, age, latitude, longitude, photo_url } = request.body;
        const { rows: existing } = await client_1.db.query('SELECT * FROM politicians WHERE id = $1', [id]);
        const prev = existing[0];
        const { rows } = await client_1.db.query(`UPDATE politicians SET
        name=$1, party=$2, region=$3, position=$4, bio=$5,
        country=$6, age=$7, latitude=$8, longitude=$9, photo_url=$10
       WHERE id=$11 RETURNING *`, [
            name, party, region, position, bio || null,
            country || 'Canada',
            age ? Number(age) : null,
            latitude ? Number(latitude) : null,
            longitude ? Number(longitude) : null,
            photo_url || null,
            id
        ]);
        const updated = rows[0];
        const changes = [];
        if (prev.position !== updated.position)
            changes.push(`position updated to "${updated.position}"`);
        if (prev.party !== updated.party)
            changes.push(`party changed to ${updated.party}`);
        if (changes.length > 0) {
            await (0, notify_1.notifyPoliticianUpdate)(id, updated.name, changes);
        }
        return updated;
    });
    server.delete('/:id', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { id } = request.params;
        await client_1.db.query('DELETE FROM politicians WHERE id = $1', [id]);
        return { success: true };
    });
}
