import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, formatMoney } from '../lib/api.js';

export default function LandingPage() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.statsOverview().then(setOverview).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20">
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse" />
              Community-verified salary data
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-bold text-ink-900 leading-[1.05] tracking-tight">
              Know your worth.<br />
              <span className="text-brand-600">Before</span> the next negotiation.
            </h1>
            <p className="mt-6 text-lg text-ink-600 max-w-xl leading-relaxed">
              PayFloor is a community-moderated salary database for tech professionals.
              Submit anonymously, compare by role and level, and see what the market really pays.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/search" className="btn-primary">Explore salaries →</Link>
              <Link to="/submit" className="btn-outline">Share yours</Link>
            </div>
          </div>

          <div className="card p-8">
            <div className="text-xs uppercase tracking-wider text-ink-500 mb-6">Live community stats</div>
            <div className="grid grid-cols-2 gap-6">
              <Stat label="Submissions"   value={overview?.total_submissions ?? '—'} />
              <Stat label="Companies"     value={overview?.total_companies ?? '—'} />
              <Stat label="Roles tracked" value={overview?.total_roles ?? '—'} />
              <Stat label="Median TC"     value={overview ? formatMoney(overview.median_total_comp) : '—'} />
            </div>
            <div className="mt-6 pt-6 border-t border-ink-100">
              <p className="text-sm text-ink-500 leading-relaxed">
                Each submission enters as <span className="font-medium text-ink-700">PENDING</span> and is
                promoted to <span className="font-medium text-brand-700">APPROVED</span> once the community
                up-votes it past the threshold.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three-up feature strip */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          <Feature
            title="Privacy by design"
            body="Salary records are never linked to user emails. Submit anonymously with one toggle."
          />
          <Feature
            title="Community moderation"
            body="Up-voted submissions earn APPROVED status. Low-quality data gets filtered out."
          />
          <Feature
            title="Real statistics"
            body="Percentiles (p25/p50/p75/p90), distributions, and level breakdowns — not marketing averages."
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-3xl font-display font-bold text-ink-900 mt-1 money">{value}</div>
    </div>
  );
}

function Feature({ title, body }) {
  return (
    <div className="card p-6">
      <h3 className="font-display font-semibold text-ink-900">{title}</h3>
      <p className="text-sm text-ink-600 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
