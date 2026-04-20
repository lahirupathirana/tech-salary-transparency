import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try { await login(email, password); nav('/search'); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-display font-bold text-ink-900">Welcome back</h1>
        <p className="text-sm text-ink-500 mt-1">Log in to vote and contribute salaries.</p>

        {err && <div className="mt-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{err}</div>}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email}
                   onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password}
                   onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn-accent w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-ink-500 text-center">
          No account? <Link to="/signup" className="text-brand-700 font-medium hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
