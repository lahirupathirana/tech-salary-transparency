/**
 * Stats Service
 * --------------
 * Aggregate analytics over APPROVED submissions:
 *   GET /stats/overview                -> global summary
 *   GET /stats/by-company              -> top N companies by avg TC
 *   GET /stats/by-level?company=X      -> level breakdown, optional company filter
 *   GET /stats/distribution?bucket=25k -> salary histogram
 *   GET /stats/percentiles?role=X      -> p25 / p50 / p75 / p90
 *
 * Uses PostgreSQL's PERCENTILE_CONT for accurate percentiles.
 */
const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 4005;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('[stats] DATABASE_URL missing'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '10kb' }));

// Total compensation expression reused everywhere.
const TC = `(base_salary + COALESCE(bonus,0) + COALESCE(equity,0))`;

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'stats' }));

/** GET /stats/overview */
app.get('/stats/overview', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT
         COUNT(*)                             AS total_submissions,
         COUNT(DISTINCT company)              AS total_companies,
         COUNT(DISTINCT role_title)           AS total_roles,
         ROUND(AVG(${TC}))::bigint            AS avg_total_comp,
         ROUND(AVG(base_salary))::bigint      AS avg_base,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${TC})::bigint AS median_total_comp
         FROM salary.submissions
        WHERE status = 'APPROVED'`,
    );
    return res.json(r.rows[0]);
  } catch (err) {
    console.error('[stats] overview error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/** GET /stats/by-company?limit=10 */
app.get('/stats/by-company', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  try {
    const r = await pool.query(
      `SELECT company,
              COUNT(*)                                                 AS n,
              ROUND(AVG(${TC}))::bigint                                AS avg_total_comp,
              ROUND(AVG(base_salary))::bigint                          AS avg_base,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${TC})::bigint AS median_total_comp
         FROM salary.submissions
        WHERE status = 'APPROVED'
        GROUP BY company
       HAVING COUNT(*) >= 1
        ORDER BY avg_total_comp DESC
        LIMIT $1`,
      [limit],
    );
    return res.json(r.rows);
  } catch (err) {
    console.error('[stats] by-company error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/** GET /stats/by-level?company=Google */
app.get('/stats/by-level', async (req, res) => {
  const { company } = req.query;
  const params = [];
  let filter = `WHERE status = 'APPROVED'`;
  if (company) { params.push(company.toLowerCase()); filter += ` AND LOWER(company) = $${params.length}`; }
  try {
    const r = await pool.query(
      `SELECT level,
              COUNT(*)                           AS n,
              ROUND(AVG(${TC}))::bigint          AS avg_total_comp,
              ROUND(AVG(base_salary))::bigint    AS avg_base,
              ROUND(AVG(years_experience)::numeric, 1) AS avg_years
         FROM salary.submissions
         ${filter}
        GROUP BY level
        ORDER BY avg_total_comp DESC`,
      params,
    );
    return res.json(r.rows);
  } catch (err) {
    console.error('[stats] by-level error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/** GET /stats/distribution?bucket=25000 */
app.get('/stats/distribution', async (req, res) => {
  const bucket = Math.max(parseInt(req.query.bucket, 10) || 25000, 1000);
  try {
    const r = await pool.query(
      `SELECT
         (FLOOR(${TC} / $1) * $1)::bigint AS bucket_start,
         COUNT(*)                         AS n
         FROM salary.submissions
        WHERE status = 'APPROVED'
        GROUP BY bucket_start
        ORDER BY bucket_start`,
      [bucket],
    );
    return res.json({ bucket, bins: r.rows });
  } catch (err) {
    console.error('[stats] distribution error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/** GET /stats/percentiles?role=Software+Engineer&company=Google */
app.get('/stats/percentiles', async (req, res) => {
  const { role, company } = req.query;
  const params = [];
  let filter = `WHERE status = 'APPROVED'`;
  if (role)    { params.push(`%${role.toLowerCase()}%`);    filter += ` AND LOWER(role_title) LIKE $${params.length}`; }
  if (company) { params.push(`%${company.toLowerCase()}%`); filter += ` AND LOWER(company) LIKE $${params.length}`; }
  try {
    const r = await pool.query(
      `SELECT
         COUNT(*)                                                    AS n,
         PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${TC})::bigint AS p25,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${TC})::bigint AS p50,
         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${TC})::bigint AS p75,
         PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${TC})::bigint AS p90
         FROM salary.submissions ${filter}`,
      params,
    );
    return res.json(r.rows[0]);
  } catch (err) {
    console.error('[stats] percentiles error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => console.log(`[stats] listening on ${PORT}`));
