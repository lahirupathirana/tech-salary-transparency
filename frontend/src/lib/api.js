/**
 * API client — the ONLY place we reference the BFF. Every request goes
 * to the relative path `/api/...` which Nginx proxies to the BFF
 * container. The frontend never talks directly to any other service.
 */
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getToken() {
  try { return localStorage.getItem('tst_token'); } catch { return null; }
}

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(body?.error || body?.errors?.join(', ') || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  // Auth
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login:  (data) => request('/auth/login',  { method: 'POST', body: JSON.stringify(data) }),
  me:     ()     => request('/auth/me'),

  // Submissions
  submit: (data) => request('/submissions',         { method: 'POST', body: JSON.stringify(data) }),
  pending: ()    => request('/submissions/pending'),

  // Votes
  vote: (submissionId, value) =>
    request('/votes', { method: 'POST', body: JSON.stringify({ submissionId, value }) }),

  // Search
  feed:   (params) => request(`/feed?${new URLSearchParams(params)}`),
  search: (params) => request(`/search?${new URLSearchParams(params)}`),
  facets: ()       => request('/search/facets'),

  // Stats
  statsOverview:     ()       => request('/stats/overview'),
  statsByCompany:    (limit=10) => request(`/stats/by-company?limit=${limit}`),
  statsByLevel:      (company) => request(`/stats/by-level${company ? `?company=${encodeURIComponent(company)}` : ''}`),
  statsDistribution: (bucket=25000) => request(`/stats/distribution?bucket=${bucket}`),
  statsPercentiles:  (params={}) => request(`/stats/percentiles?${new URLSearchParams(params)}`),
};

export function formatMoney(amount, currency = 'USD') {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}
