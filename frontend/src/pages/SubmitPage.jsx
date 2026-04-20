import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatMoney } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const INITIAL = {
  company: '', roleTitle: '', level: '', location: '',
  yearsExperience: '', baseSalary: '', bonus: '', equity: '',
  currency: 'USD', anonymize: true,
};

export default function SubmitPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(null);
  const [err, setErr] = useState('');

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-display font-bold text-ink-900">Join to contribute</h1>
        <p className="text-ink-500 mt-3">You need an account to submit a salary. Your identity is never linked to the record.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/login"  className="btn-outline">Log in</Link>
          <Link to="/signup" className="btn-accent">Create free account</Link>
        </div>
      </div>
    );
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setErr(''); setOk(null);
    try {
      const payload = {
        company:         form.company.trim(),
        roleTitle:       form.roleTitle.trim(),
        level:           form.level.trim(),
        location:        form.location.trim() || null,
        yearsExperience: Number(form.yearsExperience),
        baseSalary:      Number(form.baseSalary),
        bonus:           form.bonus  === '' ? 0 : Number(form.bonus),
        equity:          form.equity === '' ? 0 : Number(form.equity),
        currency:        form.currency,
        anonymize:       form.anonymize,
      };
      const res = await api.submit(payload);
      setOk(res);
      setForm(INITIAL);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const total =
    (Number(form.baseSalary) || 0) +
    (Number(form.bonus) || 0) +
    (Number(form.equity) || 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-900">Share your salary</h1>
      <p className="text-ink-500 mt-2 max-w-xl">
        Help build market transparency. Submissions enter as <b>PENDING</b> and are
        promoted to <b>APPROVED</b> after the community vote threshold is met.
      </p>

      {ok && (
        <div className="card mt-6 p-4 border-brand-200 bg-brand-50">
          <div className="text-sm text-brand-900">
            Submission received — status <b>{ok.status}</b>. Thank you.
          </div>
          <button className="btn-ghost mt-2 text-sm" onClick={() => nav('/search')}>View in feed →</button>
        </div>
      )}

      {err && <div className="card mt-6 p-4 border-red-200 bg-red-50 text-red-800 text-sm">{err}</div>}

      <form onSubmit={submit} className="card mt-6 p-6 md:p-8 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Company" required>
            <input className="input" value={form.company}
              onChange={e => update('company', e.target.value)} placeholder="Google" required />
          </Field>
          <Field label="Role title" required>
            <input className="input" value={form.roleTitle}
              onChange={e => update('roleTitle', e.target.value)} placeholder="Software Engineer" required />
          </Field>
          <Field label="Level" required>
            <input className="input" value={form.level}
              onChange={e => update('level', e.target.value)} placeholder="L4" required />
          </Field>
          <Field label="Location">
            <input className="input" value={form.location}
              onChange={e => update('location', e.target.value)} placeholder="Remote or city" />
          </Field>
          <Field label="Years of experience" required>
            <input type="number" step="0.5" min="0" max="60" className="input"
              value={form.yearsExperience}
              onChange={e => update('yearsExperience', e.target.value)} placeholder="3" required />
          </Field>
          <Field label="Currency">
            <select className="input" value={form.currency} onChange={e => update('currency', e.target.value)}>
              <option>USD</option><option>EUR</option><option>GBP</option>
              <option>CAD</option><option>INR</option><option>SGD</option><option>AUD</option>
            </select>
          </Field>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Base salary" required>
            <input type="number" min="0" className="input" value={form.baseSalary}
              onChange={e => update('baseSalary', e.target.value)} placeholder="160000" required />
          </Field>
          <Field label="Bonus (annual)">
            <input type="number" min="0" className="input" value={form.bonus}
              onChange={e => update('bonus', e.target.value)} placeholder="20000" />
          </Field>
          <Field label="Equity (annualised)">
            <input type="number" min="0" className="input" value={form.equity}
              onChange={e => update('equity', e.target.value)} placeholder="50000" />
          </Field>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-ink-50 border border-ink-100">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-500">Total comp</div>
            <div className="font-display font-bold text-2xl text-ink-900 money">
              {formatMoney(total, form.currency)}
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="text-right">
              <div className="text-sm font-medium text-ink-900">Submit anonymously</div>
              <div className="text-xs text-ink-500">Strip all identifiers from this record</div>
            </div>
            <input type="checkbox" className="sr-only peer"
              checked={form.anonymize} onChange={e => update('anonymize', e.target.checked)} />
            <div className="w-11 h-6 bg-ink-200 rounded-full peer peer-checked:bg-brand-500 relative transition
                            after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5
                            after:bg-white after:rounded-full after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button className="btn-accent" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit salary'}
          </button>
          <span className="text-xs text-ink-500">
            By submitting you agree your data is added to the public database.
          </span>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-brand-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
