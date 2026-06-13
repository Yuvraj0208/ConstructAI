import { Link } from 'react-router-dom';
import { ConstructionBackdrop } from '../components/ConstructionBackdrop';
import type { Role } from '../types';

const ROLE_CARDS: { key: Role; title: string; emoji: string; desc: string }[] = [
  {
    key: 'stock_handler',
    title: 'Stock Handler',
    emoji: '📦',
    desc: 'Track material stock in real time. Log usage, receive deliveries, issue requests.',
  },
  {
    key: 'manager',
    title: 'Manager',
    emoji: '📊',
    desc: 'Live dashboards, reorder thresholds, the auto-procurement engine, anomaly alerts.',
  },
  {
    key: 'site_engineer',
    title: 'Site Engineer',
    emoji: '👷',
    desc: 'Send daily progress updates and request the materials needed for the day.',
  },
  {
    key: 'vendor',
    title: 'Vendor',
    emoji: '🚚',
    desc: 'Post your price and delivery ETA. Win orders automatically across every site.',
  },
];

const STATS = ['5 industries', '4 roles', 'Auto-reorder engine', 'Live weather'];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <ConstructionBackdrop />

      <div className="relative z-10">
        {/* Nav */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-glow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M6 21V8l6-4 6 4v13M10 12h.01M14 12h.01M10 16h.01M14 16h.01" />
              </svg>
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              Construct<span className="text-amber-gradient">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
            >
              Sign up
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="animate-fade-up mx-auto max-w-4xl px-5 pt-16 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Live demo · Material procurement, on autopilot
          </span>
          <h1 className="mt-6 text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
            <span className="text-amber-gradient">Build smarter.</span>
            <br />
            Never run out of materials.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            ConstructAI watches every site's stock, calls the right vendors the moment you dip below
            threshold, and balances price against delivery speed automatically — so the right
            materials show up at the right time, on every project.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login?role=manager"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_50px_-18px_rgba(245,158,11,0.7)] transition hover:-translate-y-0.5"
            >
              Explore the live demo →
            </Link>
            <Link
              to="/signup"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Create an account
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {STATS.map((s) => (
              <span
                key={s}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
              >
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* Role chooser */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <p className="mb-5 text-center text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
            Get started — who are you?
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_CARDS.map((r, i) => (
              <Link
                key={r.key}
                to={`/login?role=${r.key}`}
                style={{ animationDelay: `${i * 80}ms` }}
                className="group animate-fade-up relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/40 hover:bg-white/[0.1] hover:shadow-[0_24px_60px_-24px_rgba(245,158,11,0.5)]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-2xl ring-1 ring-white/10">
                  {r.emoji}
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{r.title}</h3>
                <p className="mt-1.5 flex-1 text-sm text-slate-300">{r.desc}</p>
                <span className="mt-4 text-sm font-semibold text-amber-300 transition group-hover:translate-x-0.5">
                  Continue →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="text-sm text-slate-400">Built for every trade:</span>
            {['Construction', 'Electrical', 'Plumbing', 'HVAC', 'Painting'].map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-white/10"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
