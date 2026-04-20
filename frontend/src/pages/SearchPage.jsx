import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, formatMoney } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY = { company: '', role: '', level: '', location: '', minSalary: '', maxSalary: '' };

export default function SearchPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(EMPTY);
  const [facets, setFacets]   = useState({ companies: [], roles: [], levels: [] });
  const [data, setData]       = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async (f) => {
    setLoading(true); setError('');
    try {
      const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const res = await api.feed({ ...clean, limit: 100 });
      setData(res);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { api.facets().then(setFacets).catch(() => {}); load(EMPTY); }, [load]);

  const submit = (e) => { e.preventDefault(); load(filters); };
  const reset  = ()  => { setFilters(EMPTY); load(EMPTY); };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-900">Explore salaries</h1>
          <p className="text-ink-500 mt-1">Community-verified submissions from tech professionals.</p>
        </div>
        <div className="text-sm text-ink-500">
          <span className="font-semibold text-ink-800 money">{data.total}</span> results
        </div>
      </div>

      <form onSubmit={submit} className="card p-5 mb-6">
        <div className="grid md:grid-cols-5 gap-4">
          <Field label="Company">
            <input list="companies" className="input"
              value={filters.company}
              onChange={e => setFilters({ ...filters, company: e.target.value })}
              placeholder="e.g. Google" />
            <datalist id="companies">{facets.companies.map(c => <option key={c} value={c} />)}</datalist>
          </Field>

          <Field label="Role">
            <input list="roles" className="input"
              value={filters.role}
              onChange={e => setFilters({ ...filters, role: e.target.value })}
              placeholder="e.g. Software Engineer" />
            <datalist id="roles">{facets.roles.map(r => <option key={r} value={r} />)}</datalist>
          </Field>

          <Field label="Level">
            <select className="input"
              value={filters.level}
              onChange={e => setFilters({ ...filters, level: e.target.value })}>
              <option value="">Any</option>
              {facets.levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>

          <Field label="Min base (USD)">
            <input type="number" className="input" placeholder="0"
              value={filters.minSalary}
              onChange={e => setFilters({ ...filters, minSalary: e.target.value })} />
          </Field>

          <Field label="Max base (USD)">
            <input type="number" className="input" placeholder="Any"
              value={filters.maxSalary}
              onChange={e => setFilters({ ...filters, maxSalary: e.target.value })} />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Searching…' : 'Apply filters'}
          </button>
          <button type="button" className="btn-ghost" onClick={reset}>Reset</button>
        </div>
      </form>

      {error && <div className="card p-4 mb-6 border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-600 text-xs uppercase tracking-wider">
              <tr>
                <Th>Company</Th>
                <Th>Role · Level</Th>
                <Th>Location</Th>
                <Th className="text-right">Years</Th>
                <Th className="text-right">Base</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-center">Community</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && !loading && (
                <tr><td colSpan={7} className="text-center py-12 text-ink-400">
                  No matches. Try loosening your filters.
                </td></tr>
              )}
              {data.rows.map(row => <Row key={row.id} row={row} user={user} onVoted={() => load(filters)} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><label className="label">{label}</label>{children}</div>);
}
function Th({ children, className = '' }) {
  return <th className={`text-left font-medium px-5 py-3 ${className}`}>{children}</th>;
}

function Row({ row, user, onVoted }) {
  const [voting, setVoting] = useState(false);
  const [err, setErr]       = useState('');
  const total = Number(row.base_salary) + Number(row.bonus || 0) + Number(row.equity || 0);
  const isPending = row.status === 'PENDING';
  const ups   = row.votes?.ups ?? 0;
  const downs = row.votes?.downs ?? 0;

  const vote = async (value) => {
    setErr(''); setVoting(true);
    try { await api.vote(row.id, value); onVoted(); }
    catch (e) { setErr(e.message); }
    finally { setVoting(false); }
  };

  return (
    <tr className="border-t border-ink-100 hover:bg-ink-50/60 transition">
      <td className="px-5 py-4">
        <div className="font-medium text-ink-900">{row.company}</div>
        {isPending && <span className="badge bg-amber-100 text-amber-800 mt-1">PENDING</span>}
      </td>
      <td className="px-5 py-4">
        <div className="text-ink-900">{row.role_title}</div>
        <div className="text-xs text-ink-500 font-mono">{row.level}</div>
      </td>
      <td className="px-5 py-4 text-ink-600">{row.location || '—'}</td>
      <td className="px-5 py-4 text-right money text-ink-600">{row.years_experience}</td>
      <td className="px-5 py-4 text-right money text-ink-900 font-medium">
        {formatMoney(row.base_salary, row.currency)}
      </td>
      <td className="px-5 py-4 text-right money font-semibold text-brand-700">
        {formatMoney(total, row.currency)}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-center gap-2">
          {user ? (
            <>
              <button className="btn-outline px-2.5 py-1 text-xs" disabled={voting} onClick={() => vote('UP')}>
                ▲ {ups}
              </button>
              <button className="btn-outline px-2.5 py-1 text-xs" disabled={voting} onClick={() => vote('DOWN')}>
                ▼ {downs}
              </button>
            </>
          ) : (
            <Link to="/login" className="text-xs text-ink-500 hover:text-ink-800">Login to vote</Link>
          )}
        </div>
        {err && <div className="text-xs text-red-600 mt-1 text-center">{err}</div>}
      </td>
    </tr>
  );
}
