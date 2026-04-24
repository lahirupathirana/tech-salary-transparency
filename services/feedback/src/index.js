const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 4006;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[feedback] DATABASE_URL missing');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '100kb' }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_VALUES = ['BUG', 'FEATURE', 'GENERAL'];

function validateFeedback(body) {
  const errors = [];
  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    errors.push('Message is required');
  } else if (body.message.length > 2000) {
    errors.push('Message must be 2000 characters or fewer');
  }
  if (body.category && !CATEGORY_VALUES.includes(body.category.toUpperCase())) {
    errors.push(`category must be one of ${CATEGORY_VALUES.join(', ')}`);
  }
  if (body.submitterToken && !UUID_RE.test(body.submitterToken)) {
    errors.push('submitterToken must be a UUID');
  }
  return errors;
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'feedback' }));

app.post('/feedback', async (req, res) => {
  const errors = validateFeedback(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const {
    message,
    category = 'GENERAL',
    submitterToken = null,
  } = req.body;
  const normalizedCategory = category.toUpperCase();

  try {
    const result = await pool.query(
      `INSERT INTO feedback.messages
         (submitter_token, category, message)
       VALUES ($1, $2, $3)
       RETURNING id, submitter_token AS submitterToken,
                 category, message, created_at`,
      [submitterToken, normalizedCategory, message.trim()],
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[feedback] insert error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/feedback', async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const submitterToken = req.query.submitterToken || null;

  if (submitterToken && !UUID_RE.test(submitterToken)) {
    return res.status(400).json({ error: 'submitterToken invalid' });
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const conditions = [];
  const params = [];
  if (submitterToken) {
    params.push(submitterToken);
    conditions.push(`submitter_token = $${params.length}`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT id,
                        submitter_token AS submitterToken,
                        category,
                        message,
                        created_at
                   FROM feedback.messages
                   ${whereSql}
                   ORDER BY created_at DESC
                   LIMIT $${params.length + 1}
                   OFFSET $${params.length + 2}`;

  try {
    const result = await pool.query(query, [...params, safeLimit, safeOffset]);
    return res.json({ limit: safeLimit, offset: safeOffset, rows: result.rows });
  } catch (err) {
    console.error('[feedback] list error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => console.log(`[feedback] listening on ${PORT}`));
