import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line,
} from 'recharts';
import { api, formatMoney } from '../lib/api.js';

export default function StatsPage() {
  const [overview, setOverview] = useState(null);
  const [byCompany, setByCompany] = useState([]);
  const [byLevel, setByLevel] = useState([]);
  const [dist, setDist] = useState({ bins: [] });
  const [percentiles, setPercentiles] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');

  useEffect(() => {
    api.statsOverview().then(setOverview).catch(() => {});
    api.statsByCompany(10).then(setByCompany).catch(() => {});
    api.statsDistribution(25000).then(setDist).catch(() => {});
    api.statsPercentiles({}).then(setPercentiles).catch(() => {});
  }, []);

  useEffect(() => {
    api.statsByLevel(selectedCompany || undefined).then(setByLevel).catch(() => {});
  }, [selectedCompany]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-900">Market insights</h1>
      <p className="text-ink-500 mt-2">Aggregated over APPROVED submissions only.</p>

      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <Stat label="Submissions"   value={overview?.total_submissions ?? '—'} />
        <Stat label="Companies"     value={overview?.total_companies ?? '—'} />
        <Stat label="Avg total comp" value={overview ? formatMoney(overview.avg_total_comp) : '—'} />
        <Stat label="Median total comp" value={overview ? formatMoney(overview.median_total_comp) : '—'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        {/* Top companies */}
        <div className="card p-6">
          <h2 className="font-display font-semibold text-lg text-ink-900">Top companies by avg TC</h2>
          <p className="text-sm text-ink-500 mb-4">Total compensation (base + bonus + equity)</p>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={byCompany} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eeeef1" />
              <XAxis type="number" tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                     tick={{ fontSize: 11, fill: '#6b6b80' }} />
              <YAxis type="category" dataKey="company" width={90}
                     tick={{ fontSize: 12, fill: '#3d3d4e' }} />
              <Tooltip
                cursor={{ fill: 'rgba(26,164,111,0.06)' }}
                formatter={(v) => formatMoney(v)}
                contentStyle={{ borderRadius: 12, border: '1px solid #eeeef1', fontSize: 13 }}
              />
              <Bar dataKey="avg_total_comp" radius={[0, 6, 6, 0]}>
                {byCompany.map((_, i) => <Cell key={i} fill="#0f8458" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution */}
        <div className="card p-6">
          <h2 className="font-display font-semibold text-lg text-ink-900">TC distribution</h2>
          <p className="text-sm text-ink-500 mb-4">Histogram in $25k buckets</p>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={dist.bins}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eeeef1" />
              <XAxis dataKey="bucket_start"
                     tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                     tick={{ fontSize: 11, fill: '#6b6b80' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b6b80' }} />
              <Tooltip
                formatter={(v) => [`${v} submissions`, 'Count']}
                labelFormatter={(v) => `Bucket start: ${formatMoney(v)}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #eeeef1', fontSize: 13 }}
              />
              <Bar dataKey="n" radius={[6, 6, 0, 0]} fill="#3fc08b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Levels */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-ink-900">By level</h2>
              <p className="text-sm text-ink-500">Average total comp per level</p>
            </div>
            <select className="input max-w-xs"
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}>
              <option value="">All companies</option>
              {byCompany.map(c => <option key={c.company} value={c.company}>{c.company}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={byLevel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eeeef1" />
              <XAxis dataKey="level" tick={{ fontSize: 12, fill: '#3d3d4e' }} />
              <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                     tick={{ fontSize: 11, fill: '#6b6b80' }} />
              <Tooltip formatter={(v) => formatMoney(v)}
                       contentStyle={{ borderRadius: 12, border: '1px solid #eeeef1', fontSize: 13 }} />
              <Line type="monotone" dataKey="avg_total_comp" stroke="#0f8458" strokeWidth={3}
                    dot={{ r: 5, fill: '#0f8458' }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Percentiles */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-display font-semibold text-lg text-ink-900">Global percentiles</h2>
          <p className="text-sm text-ink-500 mb-6">Total compensation across APPROVED submissions</p>
          {percentiles && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Percentile label="p25" value={percentiles.p25} />
              <Percentile label="p50 · median" value={percentiles.p50} highlight />
              <Percentile label="p75" value={percentiles.p75} />
              <Percentile label="p90" value={percentiles.p90} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-2 text-2xl font-display font-bold text-ink-900 money">{value}</div>
    </div>
  );
}

function Percentile({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-5 ${highlight ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-900'}`}>
      <div className={`text-xs uppercase tracking-wider ${highlight ? 'text-brand-100' : 'text-ink-500'}`}>{label}</div>
      <div className="mt-1 text-2xl font-display font-bold money">{formatMoney(value)}</div>
    </div>
  );
}
