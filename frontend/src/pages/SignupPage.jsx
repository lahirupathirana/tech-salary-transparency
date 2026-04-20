import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignupPage() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      await signup(form.email, form.password, form.displayName || null);
      nav('/search');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-display font-bold text-ink-900">Create your account</h1>
        <p className="text-sm text-ink-500 mt-1">
          Your email is stored only for login. Salary records you submit are never linked to it.
        </p>

        {err && <div className="mt-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{err}</div>}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">Display name (optional)</label>
            <input className="input" value={form.displayName}
                   onChange={e => setForm({ ...form, displayName: e.target.value })}
                   placeholder="e.g. Dev from Colombo" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email}
                   onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={form.password}
                   onChange={e => setForm({ ...form, password: e.target.value })}
                   minLength={8} required />
            <p className="text-xs text-ink-400 mt-1">Minimum 8 characters.</p>
          </div>
          <button className="btn-accent w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-ink-500 text-center">
          Already a member? <Link to="/login" className="text-brand-700 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
