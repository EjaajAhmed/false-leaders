"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUser = notifyUser;
exports.notifyCommentReply = notifyCommentReply;
exports.notifyPoliticianUpdate = notifyPoliticianUpdate;
exports.notifyAllUsers = notifyAllUsers;
const client_1 = require("../db/client");
const email_1 = require("./email");
const COMMENT_REPLY_THROTTLE_HOURS = 6;
async function shouldSendEmail(userId, type) {
    try {
        const { rows } = await client_1.db.query(`SELECT last_sent_at FROM email_throttle WHERE user_id = $1 AND type = $2`, [userId, type]);
        if (rows.length === 0)
            return true;
        const lastSent = new Date(rows[0].last_sent_at);
        const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
        if (type === 'comment_reply')
            return hoursSince >= COMMENT_REPLY_THROTTLE_HOURS;
        return true;
    }
    catch {
        return false;
    }
}
async function recordEmailSent(userId, type) {
    await client_1.db.query(`INSERT INTO email_throttle (user_id, type, last_sent_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, type)
     DO UPDATE SET last_sent_at = NOW()`, [userId, type]);
}
async function notifyUser(userId, type, message, link) {
    await client_1.db.query(`INSERT INTO notifications (user_id, type, message, link)
     VALUES ($1, $2, $3, $4)`, [userId, type, message, link || null]);
}
async function notifyCommentReply(commenterId, commenterUsername, politicianId, politicianName) {
    const { rows: otherCommenters } = await client_1.db.query(`SELECT DISTINCT c.user_id, u.email, u.username,
            u.notif_comment_replies, u.email_notifications, u.email_verified
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.politician_id = $1 AND c.user_id != $2`, [politicianId, commenterId]);
    for (const u of otherCommenters) {
        if (!u.notif_comment_replies)
            continue;
        await notifyUser(u.user_id, 'comment_reply', `@${commenterUsername} also commented on ${politicianName}`, `/politicians/${politicianId}`);
        if (!u.email_notifications || !u.email_verified)
            continue;
        const canEmail = await shouldSendEmail(u.user_id, 'comment_reply');
        if (!canEmail)
            continue;
        const { rows: recentComments } = await client_1.db.query(`SELECT u2.username, c.body, c.created_at
       FROM comments c
       JOIN users u2 ON u2.id = c.user_id
       WHERE c.politician_id = $1
       ORDER BY c.created_at DESC
       LIMIT 5`, [politicianId]);
        await (0, email_1.sendCommentReplyEmail)(u.email, u.username, politicianName, politicianId, recentComments);
        await recordEmailSent(u.user_id, 'comment_reply');
    }
}
async function notifyPoliticianUpdate(politicianId, politicianName, changes) {
    const { rows: bookmarkers } = await client_1.db.query(`SELECT DISTINCT b.user_id, u.email, u.username,
            u.notif_politician_updates, u.email_notifications, u.email_verified
     FROM bookmarks b
     JOIN users u ON u.id = b.user_id
     WHERE b.politician_id = $1`, [politicianId]);
    console.log(`Notifying ${bookmarkers.length} bookmarkers of update to ${politicianName}`);
    for (const u of bookmarkers) {
        if (!u.notif_politician_updates)
            continue;
        await notifyUser(u.user_id, 'politician_update', `${politicianName}: ${changes.join(', ')}`, `/politicians/${politicianId}`);
        if (!u.email_notifications || !u.email_verified)
            continue;
        const canEmail = await shouldSendEmail(u.user_id, 'politician_update');
        if (!canEmail)
            continue;
        await (0, email_1.sendPoliticianUpdateEmail)(u.email, u.username, politicianName, politicianId, changes);
        await recordEmailSent(u.user_id, 'politician_update');
    }
}
async function notifyAllUsers(type, subject, message) {
    const { rows: users } = await client_1.db.query(`SELECT id, email, username, notif_app_news, email_notifications, email_verified FROM users`);
    for (const u of users) {
        if (!u.notif_app_news)
            continue;
        await notifyUser(u.id, type, message);
        if (!u.email_notifications || !u.email_verified)
            continue;
        await (0, email_1.sendAppNewsEmail)(u.email, u.username, subject, message);
        await recordEmailSent(u.id, 'app_news');
    }
}
