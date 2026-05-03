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
        return rows[0];
    });
    server.post('/', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { name, party, region, position, bio, country, age, truth_score, latitude, longitude } = request.body;
        const { rows } = await client_1.db.query(`INSERT INTO politicians (name, party, region, position, bio, country, age, truth_score, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, [
            name, party, region, position, bio || null,
            country || 'Canada',
            age ? Number(age) : null,
            truth_score ? Number(truth_score) : 50.0,
            latitude ? Number(latitude) : null,
            longitude ? Number(longitude) : null
        ]);
        return reply.status(201).send(rows[0]);
    });
    server.put('/:id', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { id } = request.params;
        const { name, party, region, position, bio, country, age, truth_score, latitude, longitude, photo_url } = request.body;
        const { rows: existing } = await client_1.db.query('SELECT * FROM politicians WHERE id = $1', [id]);
        const prev = existing[0];
        const { rows } = await client_1.db.query(`UPDATE politicians SET
        name=$1, party=$2, region=$3, position=$4, bio=$5,
        country=$6, age=$7, truth_score=$8, latitude=$9, longitude=$10, photo_url=$11
       WHERE id=$12 RETURNING *`, [
            name, party, region, position, bio || null,
            country || 'Canada',
            age ? Number(age) : null,
            truth_score ? Number(truth_score) : 50.0,
            latitude ? Number(latitude) : null,
            longitude ? Number(longitude) : null,
            photo_url || null,
            id
        ]);
        const updated = rows[0];
        const changes = [];
        if (Number(prev.truth_score) !== Number(truth_score))
            changes.push(`TruthScore changed to ${updated.truth_score}`);
        if (prev.position !== updated.position)
            changes.push(`position updated to "${updated.position}"`);
        if (prev.party !== updated.party)
            changes.push(`party changed to ${updated.party}`);
        console.log('Changes detected:', changes);
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
