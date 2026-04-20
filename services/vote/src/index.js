/**
 * Vote Service
 * -------------
 * Implements community moderation. Each vote is tied to a voter_token
 * (the opaque UUID from identity); one vote per (submission, voter).
 * If a user re-votes with a different value, the existing vote is
 * updated rather than a new row inserted.
 *
 * Threshold logic:
 *   net_score = (#UP - #DOWN)
 *   when net_score >= APPROVAL_THRESHOLD and status = PENDING
 *     -> status becomes APPROVED, approved_at = NOW()
 *
 * All writes are wrapped in a transaction so vote counting and status
 * flips happen atomically.
 */
const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 4003;
const DATABASE_URL = process.env.DATABASE_URL;
const APPROVAL_THRESHOLD = parseInt(process.env.APPROVAL_THRESHOLD || '3', 10);
if (!DATABASE_URL) { console.error('[vote] DATABASE_URL missing'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '10kb' }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'vote' }));

/**
 * POST /votes
 * Body: { submissionId, voterToken, value: 'UP' | 'DOWN' }
 * BFF enforces auth; this service trusts voterToken from the JWT sub.
 */
app.post('/votes', async (req, res) => {
  const { submissionId, voterToken, value } = req.body || {};
  if (!submissionId || !UUID_RE.test(submissionId)) return res.status(400).json({ error: 'submissionId invalid' });
  if (!voterToken || !UUID_RE.test(voterToken))    return res.status(400).json({ error: 'voterToken invalid' });
  if (value !== 'UP' && value !== 'DOWN')          return res.status(400).json({ error: "value must be 'UP' or 'DOWN'" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Confirm the submission exists + lock it for the status check later.
    const subRow = await client.query(
      `SELECT id, status FROM salary.submissions WHERE id = $1 FOR UPDATE`,
      [submissionId],
    );
    if (!subRow.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'submission not found' });
    }

    // Upsert the vote (one per voter per submission).
    await client.query(
      `INSERT INTO community.votes (submission_id, voter_token, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (submission_id, voter_token)
       DO UPDATE SET value = EXCLUDED.value, created_at = NOW()`,
      [submissionId, voterToken, value],
    );

    // Recalculate net score.
    const agg = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE value = 'UP')   AS ups,
         COUNT(*) FILTER (WHERE value = 'DOWN') AS downs
       FROM community.votes WHERE submission_id = $1`,
      [submissionId],
    );
    const ups = parseInt(agg.rows[0].ups, 10);
    const downs = parseInt(agg.rows[0].downs, 10);
    const netScore = ups - downs;

    // Promote if threshold crossed and still PENDING.
    const currentStatus = subRow.rows[0].status;
    let newStatus = currentStatus;
    if (currentStatus === 'PENDING' && netScore >= APPROVAL_THRESHOLD) {
      newStatus = 'APPROVED';
      await client.query(
        `UPDATE salary.submissions
            SET status = 'APPROVED', approved_at = NOW(), vote_score = $2
          WHERE id = $1`,
        [submissionId, netScore],
      );
    } else {
      await client.query(
        `UPDATE salary.submissions SET vote_score = $2 WHERE id = $1`,
        [submissionId, netScore],
      );
    }

    await client.query('COMMIT');
    return res.json({
      submissionId,
      ups, downs, netScore,
      status: newStatus,
      approved: newStatus === 'APPROVED',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[vote] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

/** GET /votes/submission/:id  — vote summary */
app.get('/votes/submission/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'bad id' });
  try {
    const r = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE value = 'UP')   AS ups,
         COUNT(*) FILTER (WHERE value = 'DOWN') AS downs
         FROM community.votes WHERE submission_id = $1`,
      [req.params.id],
    );
    const ups = parseInt(r.rows[0].ups, 10);
    const downs = parseInt(r.rows[0].downs, 10);
    return res.json({ ups, downs, netScore: ups - downs });
  } catch (err) {
    console.error('[vote] summary error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => console.log(`[vote] listening on ${PORT} (threshold=${APPROVAL_THRESHOLD})`));
