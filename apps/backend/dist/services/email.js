"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCommentReplyEmail = sendCommentReplyEmail;
exports.sendPoliticianUpdateEmail = sendPoliticianUpdateEmail;
exports.sendAppNewsEmail = sendAppNewsEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@falseleaders.com';
const APP_URL = process.env.FRONTEND_URL || 'https://falseleaders.com';
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
async function sendWelcomeEmail(to, username) {
    try {
        await resend.emails.send({
            from: FROM,
            to,
            subject: 'Welcome to FalseLeaders',
            html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; color: #1a1a1a;">
            <div style="text-align: center; margin-bottom: 2rem;">
              <h1 style="font-size: 1.4rem; color: #1a1a1a; margin: 0;">FalseLeaders</h1>
              <p style="color: #aaa; font-size: 0.8rem; margin: 0.25rem 0 0;">Hold them accountable.</p>
            </div>
  
            <h2 style="font-size: 1.1rem; margin: 0 0 0.5rem;">Welcome, @${username}</h2>
            <p style="color: #555; margin: 0 0 1.5rem;">Your account has been created. You can now comment on politicians, vote, save to grafts and track controversies.</p>
  
            <a href="${APP_URL}"
               style="display: inline-block; padding: 0.7rem 1.5rem; background: #1a1a1a; color: white; text-decoration: none; border-radius: 8px; font-size: 0.9rem;">
              Go to FalseLeaders
            </a>
  
            <hr style="border: none; border-top: 1px solid #eee; margin: 2rem 0;" />
            <p style="color: #bbb; font-size: 0.75rem; margin: 0;">
              You're receiving this because you just created an account.
            </p>
          </div>
        `
        });
    }
    catch (err) {
        console.error('Welcome email failed:', err);
    }
}
