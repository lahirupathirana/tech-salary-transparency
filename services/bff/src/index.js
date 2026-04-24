/**
 * BFF (Backend-for-Frontend)
 * ---------------------------
 * The single entry point for the React frontend. Responsibilities:
 *   - Forward auth calls (/auth/*) to the identity service
 *   - Verify JWTs locally (secret shared with identity) for community
 *     actions (submitting, voting)
 *   - Proxy reads (/search, /stats) to the appropriate service
 *   - Aggregate: /feed combines search + vote summary in one call
 *
 * The frontend never addresses identity/submission/vote/search/stats
 * directly; only this BFF. The BFF communicates with them over the
 * internal Docker network.
 */
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const IDENTITY_URL   = process.env.IDENTITY_URL   || 'http://identity:4001';
const SUBMISSION_URL = process.env.SUBMISSION_URL || 'http://salary-submission:4002';
const VOTE_URL       = process.env.VOTE_URL       || 'http://vote:4003';
const SEARCH_URL     = process.env.SEARCH_URL     || 'http://search:4004';
const STATS_URL      = process.env.STATS_URL      || 'http://stats:4005';
const FEEDBACK_URL   = process.env.FEEDBACK_URL   || 'http://feedback:4006';

if (!JWT_SECRET) { console.error('[bff] JWT_SECRET missing'); process.exit(1); }

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ---- Small fetch helper (Node 20+ has global fetch) ----------------
async function call(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body };
}

// ---- JWT middleware (for community actions) ------------------------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { sub: submitterToken, name }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---- Health --------------------------------------------------------
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'bff' }));

// ====================================================================
// AUTH — proxy to identity service
// ====================================================================
app.post('/auth/signup', async (req, res) => {
  try {
    const r = await call(`${IDENTITY_URL}/signup`, { method: 'POST', body: JSON.stringify(req.body) });
    return res.status(r.status).json(r.body);
  } catch (err) { console.error('[bff] signup:', err); res.status(502).json({ error: 'identity unreachable' }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const r = await call(`${IDENTITY_URL}/login`, { method: 'POST', body: JSON.stringify(req.body) });
    return res.status(r.status).json(r.body);
  } catch (err) { console.error('[bff] login:', err); res.status(502).json({ error: 'identity unreachable' }); }
});

app.get('/auth/me', requireAuth, (req, res) => {
  return res.json({ submitterToken: req.user.sub, displayName: req.user.name });
});

// ====================================================================
// SUBMISSIONS
// ====================================================================

/**
 * POST /submissions
 * Auth: required. Body may include "anonymize": true to strip the
 * submitter token before storage. The BFF never lets the client send
 * an arbitrary submitterToken — it uses the one from the JWT.
 */
app.post('/submissions', requireAuth, async (req, res) => {
  const payload = {
    ...req.body,
    submitterToken: req.user.sub,
    anonymize: !!req.body.anonymize,
  };
  try {
    const r = await call(`${SUBMISSION_URL}/submissions`, { method: 'POST', body: JSON.stringify(payload) });
    return res.status(r.status).json(r.body);
  } catch (err) { console.error('[bff] submit:', err); res.status(502).json({ error: 'submission service unreachable' }); }
});

app.get('/submissions/pending', async (_req, res) => {
  try {
    const r = await call(`${SUBMISSION_URL}/submissions/status/pending`);
    return res.status(r.status).json(r.body);
  } catch { res.status(502).json({ error: 'submission service unreachable' }); }
});

// ====================================================================
// VOTES
// ====================================================================

/**
 * POST /votes
 * Auth: required. The voterToken is taken from the JWT — the client
 * cannot spoof it.
 */
app.post('/votes', requireAuth, async (req, res) => {
  const { submissionId, value } = req.body || {};
  try {
    const r = await call(`${VOTE_URL}/votes`, {
      method: 'POST',
      body: JSON.stringify({ submissionId, value, voterToken: req.user.sub }),
    });
    return res.status(r.status).json(r.body);
  } catch { res.status(502).json({ error: 'vote service unreachable' }); }
});

// ====================================================================
// FEEDBACK
// ====================================================================

app.post('/feedback', requireAuth, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      submitterToken: req.user.sub,
    };
    const r = await call(`${FEEDBACK_URL}/feedback`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('[bff] feedback:', err);
    return res.status(502).json({ error: 'feedback service unreachable' });
  }
});

app.get('/feedback', requireAuth, async (req, res) => {
  const query = new URLSearchParams({
    submitterToken: req.user.sub,
    limit: req.query.limit || '50',
    offset: req.query.offset || '0',
  }).toString();
  try {
    const r = await call(`${FEEDBACK_URL}/feedback?${query}`);
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('[bff] feedback list:', err);
    return res.status(502).json({ error: 'feedback service unreachable' });
  }
});

// ====================================================================
// SEARCH — passthrough
// ====================================================================
app.get('/search', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try {
    const r = await call(`${SEARCH_URL}/search?${qs}`);
    return res.status(r.status).json(r.body);
  } catch { res.status(502).json({ error: 'search service unreachable' }); }
});

app.get('/search/facets', async (_req, res) => {
  try {
    const r = await call(`${SEARCH_URL}/search/facets`);
    return res.status(r.status).json(r.body);
  } catch { res.status(502).json({ error: 'search service unreachable' }); }
});

// ====================================================================
// STATS — passthrough
// ====================================================================
for (const path of ['/stats/overview', '/stats/by-company', '/stats/by-level', '/stats/distribution', '/stats/percentiles']) {
  app.get(path, async (req, res) => {
    const qs = new URLSearchParams(req.query).toString();
    try {
      const r = await call(`${STATS_URL}${path}${qs ? `?${qs}` : ''}`);
      return res.status(r.status).json(r.body);
    } catch { res.status(502).json({ error: 'stats service unreachable' }); }
  });
}

// ====================================================================
// AGGREGATE — /feed combines search results + each row's vote summary
// ====================================================================
app.get('/feed', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try {
    const searchR = await call(`${SEARCH_URL}/search?${qs}`);
    if (searchR.status !== 200) return res.status(searchR.status).json(searchR.body);

    const rows = searchR.body.rows || [];
    const withVotes = await Promise.all(rows.map(async (row) => {
      try {
        const v = await call(`${VOTE_URL}/votes/submission/${row.id}`);
        return { ...row, votes: v.body };
      } catch {
        return { ...row, votes: { ups: 0, downs: 0, netScore: 0 } };
      }
    }));
    return res.json({ ...searchR.body, rows: withVotes });
  } catch (err) {
    console.error('[bff] feed:', err);
    return res.status(502).json({ error: 'upstream unreachable' });
  }
});

app.listen(PORT, () => console.log(`[bff] listening on ${PORT}`));
