/**
 * Salary Submission Service
 * --------------------------
 * Validates and persists salary records. Crucially, this service has
 * NO access to the identity schema and never sees emails. It accepts
 * only an opaque `submitterToken` (or nothing, if the submission is
 * anonymous). New records are PENDING until community votes approve.
 */
const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 4002;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('[salary-submission] DATABASE_URL missing'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '100kb' }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateSubmission(body) {
  const errors = [];
  const required = ['company', 'roleTitle', 'level', 'yearsExperience', 'baseSalary'];
  for (const f of required) {
    if (body[f] === undefined || body[f] === null || body[f] === '') errors.push(`${f} is required`);
  }
  if (body.company && body.company.length > 120) errors.push('company too long');
  if (body.roleTitle && body.roleTitle.length > 120) errors.push('roleTitle too long');
  if (body.yearsExperience !== undefined && (isNaN(body.yearsExperience) || body.yearsExperience < 0 || body.yearsExperience > 60)) {
    errors.push('yearsExperience out of range');
  }
  if (body.baseSalary !== undefined && (isNaN(body.baseSalary) || body.baseSalary < 0 || body.baseSalary > 10_000_000)) {
    errors.push('baseSalary out of range');
  }
  if (body.currency && !/^[A-Z]{3}$/.test(body.currency)) errors.push('currency must be ISO 4217');
  if (body.submitterToken && !UUID_RE.test(body.submitterToken)) errors.push('submitterToken must be a UUID');
  return errors;
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'salary-submission' }));

/**
 * POST /submissions
 * If anonymize=true OR no token is supplied, the record is saved with
 * submitter_token = NULL so there is no way to trace it back. The
 * `anonymize` flag itself is also persisted as a boolean column so
 * the choice is auditable independently of the token value.
 */
app.post('/submissions', async (req, res) => {
  const errors = validateSubmission(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const {
    company, roleTitle, level, location,
    yearsExperience, baseSalary, bonus = 0, equity = 0,
    currency = 'USD', anonymize = false, submitterToken = null,
  } = req.body;

  // If the caller asked for anonymity OR sent no token, force anonymous.
  const effectiveAnonymize = !!anonymize || !submitterToken;
  const tokenToStore = effectiveAnonymize ? null : submitterToken;

  try {
    const result = await pool.query(
      `INSERT INTO salary.submissions
         (submitter_token, anonymize, company, role_title, level, location,
          years_experience, base_salary, bonus, equity, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, company, role_title, level, location,
                 years_experience, base_salary, bonus, equity,
                 currency, status, vote_score, anonymize, created_at`,
      [
        tokenToStore, effectiveAnonymize,
        company.trim(), roleTitle.trim(), level.trim(),
        location ? location.trim() : null,
        yearsExperience, baseSalary, bonus, equity, currency,
      ],
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[salary-submission] insert error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/** GET /submissions/:id */
app.get('/submissions/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'bad id' });
  try {
    const r = await pool.query(
      `SELECT id, company, role_title, level, location,
              years_experience, base_salary, bonus, equity,
              currency, status, vote_score, anonymize, created_at
         FROM salary.submissions WHERE id = $1`,
      [req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error('[salary-submission] get error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/** GET /submissions/pending  — used by the UI moderation list */
app.get('/submissions/status/pending', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, company, role_title, level, location,
              years_experience, base_salary, bonus, equity,
              currency, status, vote_score, anonymize, created_at
         FROM salary.submissions
        WHERE status = 'PENDING'
        ORDER BY created_at DESC
        LIMIT 100`,
    );
    return res.json(r.rows);
  } catch (err) {
    console.error('[salary-submission] pending error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => console.log(`[salary-submission] listening on ${PORT}`));
