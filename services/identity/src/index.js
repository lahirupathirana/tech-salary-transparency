/**
 * Identity Service
 * ----------------
 * Handles signup, login, password hashing (bcrypt), JWT issuance, and
 * token verification. This is the ONLY service that knows about emails.
 *
 * JWT payload:
 *   {
 *     sub: <submitter_token>,   // opaque UUID, NEVER the email
 *     name: <display_name>,
 *     iat, exp
 *   }
 *
 * Other services only ever see the submitter_token — this is how we
 * keep salary records disjoint from user PII.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = process.env.PORT || 4001;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const parsedRounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
const BCRYPT_ROUNDS = Number.isNaN(parsedRounds) ? 10 : parsedRounds;

if (!DATABASE_URL || !JWT_SECRET) {
  console.error('[identity] Missing DATABASE_URL or JWT_SECRET');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '100kb' }));

// ---- Validation helpers --------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateSignup(body) {
  const errors = [];
  if (!body.email || !EMAIL_RE.test(body.email)) errors.push('Invalid email');
  if (!body.password || body.password.length < 8) errors.push('Password must be at least 8 characters');
  if (body.displayName && body.displayName.length > 100) errors.push('Display name too long');
  return errors;
}

// ---- Routes ---------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'identity' }));

/**
 * POST /signup
 * Body: { email, password, displayName? }
 * Response: { token, user: { id, displayName, submitterToken } }
 */
app.post('/signup', async (req, res) => {
  const errors = validateSignup(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { email, password, displayName } = req.body;
  const emailNorm = email.trim().toLowerCase();

  try {
    const existing = await pool.query('SELECT id FROM identity.users WHERE email = $1', [emailNorm]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const insert = await pool.query(
      `INSERT INTO identity.users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, display_name, submitter_token`,
      [emailNorm, passwordHash, displayName || null]
    );
    const user = insert.rows[0];
    const token = jwt.sign(
      { sub: user.submitter_token, name: user.display_name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        displayName: user.display_name,
        submitterToken: user.submitter_token,
      },
    });
  } catch (err) {
    console.error('[identity] signup error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /login
 * Body: { email, password }
 * Response: { token, user: { ... } }
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query(
      `SELECT id, password_hash, display_name, submitter_token
         FROM identity.users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { sub: user.submitter_token, name: user.display_name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return res.json({
      token,
      user: {
        id: user.id,
        displayName: user.display_name,
        submitterToken: user.submitter_token,
      },
    });
  } catch (err) {
    console.error('[identity] login error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /verify
 * Body: { token }
 * Used by the BFF to validate a JWT without duplicating the secret.
 */
app.post('/verify', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, payload });
  } catch {
    return res.status(401).json({ valid: false });
  }
});

app.listen(PORT, () => console.log(`[identity] listening on ${PORT}`));
