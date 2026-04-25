/**
 * Search Service
 * ---------------
 * Read-only, filtered lookups over APPROVED submissions. Uses
 * parameterised queries exclusively (SQL injection safe) and builds
 * a WHERE clause dynamically based on the filters supplied.
 */
const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 4004;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('[search] DATABASE_URL missing'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'search' }));

/**
 * GET /search
 * Query params: company, role, level, location, minSalary, maxSalary,
 *               minExp, maxExp, currency, limit, offset, includePending
 * All optional. Returns { total, rows }.
 */
app.get('/search', async (req, res) => {
  const {
    company, role, level, location,
    minSalary, maxSalary, minExp, maxExp, currency,
    limit = 50, offset = 0, includePending,
  } = req.query;

  // const includePendingFlag = String(includePending).toLowerCase() === 'true';
  const includePendingFlag = ['1', 'true', 'yes'].includes(String(includePending).toLowerCase());
  const parseNum = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : null;
  };

  const conditions = [];
  const params = [];
  const push = (sql, value) => { params.push(value); conditions.push(sql.replace('?', `$${params.length}`)); };

  if (!includePendingFlag) {
    conditions.push(`status = 'APPROVED'`);
  }
  if (company) push(`LOWER(company) LIKE ?`, `%${company.toLowerCase()}%`);
  if (role) push(`LOWER(role_title) LIKE ?`, `%${role.toLowerCase()}%`);
  if (level) push(`level = ?`, level);
  if (location) push(`LOWER(location) LIKE ?`, `%${location.toLowerCase()}%`);
  if (currency) push(`currency = ?`, currency.toUpperCase());
  const minSalaryValue = parseNum(minSalary);
  const maxSalaryValue = parseNum(maxSalary);
  const minExpValue = parseNum(minExp);
  const maxExpValue = parseNum(maxExp);
  if (minSalaryValue !== null) push(`base_salary >= ?`, minSalaryValue);
  if (maxSalaryValue !== null) push(`base_salary <= ?`, maxSalaryValue);
  if (minExpValue !== null) push(`years_experience >= ?`, minExpValue);
  if (maxExpValue !== null) push(`years_experience <= ?`, maxExpValue);

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  try {
    const rowsQ = pool.query(
      `SELECT id, company, role_title, level, location,
              years_experience, base_salary, bonus, equity,
              currency, status, vote_score, anonymize, created_at
         FROM salary.submissions
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params,
    );
    const countQ = pool.query(
      `SELECT COUNT(*) AS total FROM salary.submissions ${whereSql}`,
      params,
    );
    const [rows, count] = await Promise.all([rowsQ, countQ]);
    return res.json({
      total: parseInt(count.rows[0].total, 10),
      limit: safeLimit,
      offset: safeOffset,
      rows: rows.rows,
    });
  } catch (err) {
    console.error('[search] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/** GET /search/facets — used by the UI dropdowns. */
app.get('/search/facets', async (_req, res) => {
  try {
    const [companies, roles, levels] = await Promise.all([
      pool.query(`SELECT DISTINCT company FROM salary.submissions WHERE status='APPROVED' ORDER BY company`),
      pool.query(`SELECT DISTINCT role_title FROM salary.submissions WHERE status='APPROVED' ORDER BY role_title`),
      pool.query(`SELECT DISTINCT level FROM salary.submissions WHERE status='APPROVED' ORDER BY level`),
    ]);
    return res.json({
      companies: companies.rows.map(r => r.company),
      roles: roles.rows.map(r => r.role_title),
      levels: levels.rows.map(r => r.level),
    });
  } catch (err) {
    console.error('[search] facets error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => console.log(`[search] listening on ${PORT}`));
