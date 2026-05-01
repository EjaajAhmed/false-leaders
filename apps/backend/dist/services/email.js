"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCommentReplyEmail = sendCommentReplyEmail;
exports.sendPoliticianUpdateEmail = sendPoliticianUpdateEmail;
exports.sendAppNewsEmail = sendAppNewsEmail;
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
async function sendCommentReplyEmail(to, username, politicianName, politicianId, recentComments) {
    console.log(`[EMAIL] Comment reply to ${to} (@${username}) re: ${politicianName}`);
    console.log(`[EMAIL] Link: ${APP_URL}/politicians/${politicianId}`);
    console.log(`[EMAIL] Recent comments:`, recentComments.map(c => `@${c.username}: ${c.body}`));
}
async function sendPoliticianUpdateEmail(to, username, politicianName, politicianId, changes) {
    console.log(`[EMAIL] Politician update to ${to} (@${username}): ${politicianName}`);
    console.log(`[EMAIL] Changes:`, changes);
    console.log(`[EMAIL] Link: ${APP_URL}/politicians/${politicianId}`);
}
async function sendAppNewsEmail(to, username, subject, message) {
    console.log(`[EMAIL] App news to ${to} (@${username}): ${subject}`);
    console.log(`[EMAIL] Message:`, message);
}
