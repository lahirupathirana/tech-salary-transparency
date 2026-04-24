/**
 * Notification Service
 * --------------------
 * Handles all event-driven notifications for the PayFloor platform.
 *
 * Responsibilities:
 *   - Receive notification events from other services
 *   - Store notifications in the database
 *   - Send email alerts to users
 *   - Provide notification history endpoints
 *
 * Architecture:
 *   - Event API: POST /notify accepts notification events
 *   - Persistence: stores every notification in community.notifications table
 *   - Email Driver: uses nodemailer for SMTP delivery (configurable)
 *   - Stateless: horizontally scalable
 */
const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 4006;
const DATABASE_URL = process.env.DATABASE_URL;
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@payfloor.dev';

if (!DATABASE_URL) {
  console.error('[notification] Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '100kb' }));

// ---- Email transporter setup ----------------------------------------
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

// ---- Helper: send email -----------------------------------------------
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('[notification] email error:', err.message);
    return { success: false, error: err.message };
  }
}

// ---- Routes ---------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification' }));

/**
 * POST /notify — Send a notification
 * Body: { type, recipientEmail, recipientToken, data: {...} }
 */
app.post('/notify', async (req, res) => {
  const { type, recipientEmail, recipientToken, data } = req.body || {};

  if (!type || !recipientToken) {
    return res.status(400).json({ error: 'Missing type or recipientToken' });
  }

  let subject = 'PayFloor Notification';
  let html = '<p>You have a new notification on PayFloor.</p>';

  // Build email content based on notification type
  switch (type) {
    case 'submission_approved':
      subject = '✓ Your Submission Was Approved!';
      html = `<h2>Your salary submission was approved!</h2>
        <p>Your submission for <strong>${data?.role}</strong> 
           at <strong>${data?.company}</strong> is now visible to the community.</p>`;
      break;
    case 'vote_threshold_reached':
      subject = '📊 Submission Approved by Community!';
      html = `<h2>Community consensus reached!</h2>
        <p>A submission received <strong>${data?.netScore}</strong> net upvotes 
           and was automatically approved.</p>`;
      break;
    default:
      html = `<p>${JSON.stringify(data)}</p>`;
  }

  try {
    // Store notification in database
    await pool.query(
      `INSERT INTO community.notifications (recipient_token, type, email, data, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [recipientToken, type, recipientEmail || null, JSON.stringify(data || {})]
    );

    // Send email if provided
    let emailResult = { success: true };
    if (recipientEmail) {
      emailResult = await sendEmail(recipientEmail, subject, html);
    }

    return res.json({ type, status: emailResult.success ? 'sent' : 'failed' });
  } catch (err) {
    console.error('[notification] error:', err);
    return res.status(500).json({ error: 'Failed to process notification' });
  }
});

/**
 * GET /notifications/:recipientToken — Get notification history
 */
app.get('/notifications/:recipientToken', async (req, res) => {
  const { recipientToken } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);

  try {
    const result = await pool.query(
      `SELECT id, type, data, status, created_at FROM community.notifications
       WHERE recipient_token = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [recipientToken, limit, offset]
    );
    return res.json({
      notifications: result.rows.map(r => ({
        id: r.id,
        type: r.type,
        status: r.status,
        createdAt: r.created_at,
        data: r.data ? JSON.parse(r.data) : null,
      })),
    });
  } catch (err) {
    console.error('[notification] error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /notifications-count/:recipientToken — Get unread count
 */
app.get('/notifications-count/:recipientToken', async (req, res) => {
  const { recipientToken } = req.params;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM community.notifications
       WHERE recipient_token = $1 AND status = 'pending'`,
      [recipientToken]
    );
    return res.json({ unread: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('[notification] error:', err);
    return res.status(500).json({ error: 'Failed to count notifications' });
  }
});

app.listen(PORT, () => console.log(`[notification] listening on ${PORT}`));

