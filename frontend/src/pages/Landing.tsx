import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ConstructionBackdrop } from '../components/ConstructionBackdrop';
import { Reveal } from '../components/Reveal';
import { Icon, type IconName } from '../components/icons';
import type { Role } from '../types';

const TRADES: { name: string; icon: IconName }[] = [
  { name: 'Construction', icon: 'building' },
  { name: 'Electrical', icon: 'bolt' },
  { name: 'Plumbing', icon: 'droplet' },
  { name: 'HVAC', icon: 'wind' },
  { name: 'Painting', icon: 'roller' },
];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'box',
    title: 'Track every material',
    body: 'Stock handlers log movements per site. Levels, safety reserves and batch expiry stay live across all your projects.',
  },
  {
    icon: 'sparkles',
    title: 'Let the engine decide',
    body: 'The moment stock dips below threshold, ConstructAI ranks vendors by price vs. delivery speed and drafts the order.',
  },
  {
    icon: 'check',
    title: 'Approve & receive',
    body: 'Managers approve, vendors accept, stock handlers receive — every step tracked from request to delivery.',
  },
];

const ROLE_CARDS: { key: Role; title: string; desc: string; icon: IconName; grad: string; glow: string }[] = [
  {
    key: 'stock_handler',
    title: 'Stock Handler',
    desc: 'Track levels in real time. Log usage, receive deliveries, release requested stock.',
    icon: 'box',
    grad: 'from-amber-400 to-orange-500',
    glow: 'hover:shadow-[0_24px_60px_-24px_rgba(245,158,11,0.55)] hover:border-amber-300/50',
  },
  {
    key: 'manager',
    title: 'Manager',
    desc: 'Live dashboards, thresholds, the auto-procurement engine and anomaly alerts.',
    icon: 'chart',
    grad: 'from-indigo-400 to-violet-500',
    glow: 'hover:shadow-[0_24px_60px_-24px_rgba(99,102,241,0.55)] hover:border-indigo-300/50',
  },
  {
    key: 'site_engineer',
    title: 'Site Engineer',
    desc: 'Send daily progress updates and request the materials needed for the day.',
    icon: 'hardHat',
    grad: 'from-emerald-400 to-teal-500',
    glow: 'hover:shadow-[0_24px_60px_-24px_rgba(16,185,129,0.55)] hover:border-emerald-300/50',
  },
  {
    key: 'vendor',
    title: 'Vendor',
    desc: 'Post price and delivery ETA. Win orders automatically across every site.',
    icon: 'truck',
    grad: 'from-sky-400 to-cyan-500',
    glow: 'hover:shadow-[0_24px_60px_-24px_rgba(14,165,233,0.55)] hover:border-sky-300/50',
  },
];

const STATS: { value: string; label: string }[] = [
  { value: '5', label: 'industries' },
  { value: '4', label: 'role workspaces' },
  { value: '<1s', label: 'vendor ranking' },
  { value: '24/7', label: 'live weather' },
];

/* ---------- small product mock-ups (make the page feel like a real app) ---------- */

function StockMock() {
  const rows = [
    { n: 'Cement', pct: 16, dot: 'bg-rose-500', bar: 'bg-rose-500' },
    { n: 'Steel Rods', pct: 44, dot: 'bg-amber-500', bar: 'bg-amber-500' },
    { n: 'Sand', pct: 78, dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">Site stock · Tower A</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
          <Icon name="critical" className="h-3 w-3" /> 1 critical
        </span>
      </div>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.n}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <span className={`h-2 w-2 rounded-full ${r.dot}`} />
                {r.n}
              </span>
              <span className="text-xs text-slate-400">{r.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${r.bar}`} style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VendorMock() {
  const rows = [
    { v: 'UltraTech', price: '₹420', eta: '1 day', best: true },
    { v: 'MetroSupply', price: '₹405', eta: '3 days', best: false },
    { v: 'BuildCorp', price: '₹398', eta: '5 days', best: false },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">Vendor ranking · Cement</span>
        <span className="text-xs text-slate-400">critical → speed wins</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.v}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
              r.best ? 'border-indigo-200 bg-indigo-50/70 ring-1 ring-indigo-200' : 'border-slate-100 bg-slate-50/60'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              {r.v}
              {r.best && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                  Picked
                </span>
              )}
            </span>
            <span className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{r.price}</span>
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {r.eta}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherMock() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-800">Mumbai · next 3 days</div>
          <div className="mt-0.5 text-xs text-slate-400">Open-Meteo · live</div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-sky-500 ring-1 ring-sky-100">
          <Icon name="cloudRain" className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {['Rain', 'Rain', 'Clouds'].map((c, i) => (
          <span
            key={i}
            className="flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-center text-xs font-medium text-slate-500 ring-1 ring-slate-100"
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-amber-200">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>+20% buffer</strong> auto-applied to weather-sensitive materials before the rain
          hits.
        </span>
      </div>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  icon,
  title,
  body,
  reverse,
  children,
}: {
  eyebrow: string;
  icon: IconName;
  title: string;
  body: string;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <Reveal>
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className={reverse ? 'lg:order-2' : ''}>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold tracking-wide text-indigo-600 uppercase ring-1 ring-indigo-100">
            <Icon name={icon} className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 text-balance sm:text-4xl">
            {title}
          </h3>
          <p className="mt-3 max-w-md text-base leading-relaxed text-slate-600">{body}</p>
        </div>
        <div className={reverse ? 'lg:order-1' : ''}>{children}</div>
      </div>
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="bg-white">
      {/* ============ HERO (dark) ============ */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <ConstructionBackdrop />
        <div className="relative z-10">
          <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-glow">
                <Icon name="building" className="h-5 w-5" />
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

          <div className="animate-fade-up mx-auto max-w-4xl px-5 pt-16 pb-24 text-center sm:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Live demo · Material procurement, on autopilot
            </span>
            <h1 className="mt-6 text-5xl leading-[1.04] font-extrabold tracking-tight text-balance sm:text-7xl">
              <span className="text-amber-gradient">Build smarter.</span>
              <br />
              Never run out of materials.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              ConstructAI watches every site's stock, calls the right vendors the moment you dip
              below threshold, and balances price against delivery speed — so the right materials
              show up at the right time, on every project.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login?role=manager"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_50px_-18px_rgba(245,158,11,0.7)] transition hover:-translate-y-0.5"
              >
                Explore the live demo
                <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/signup"
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRADES STRIP (light) ============ */}
      <section className="border-b border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-center text-xs font-semibold tracking-[0.22em] text-slate-400 uppercase">
              One platform · every trade
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {TRADES.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center gap-2 text-slate-500 transition hover:text-slate-900"
                >
                  <Icon name={t.icon} className="h-5 w-5" />
                  <span className="text-sm font-semibold">{t.name}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ HOW IT WORKS (light) ============ */}
      <section className="bg-slate-50/70 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold tracking-[0.2em] text-indigo-600 uppercase">How it works</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
              From low-stock to ordered, automatically.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 110}>
                <div className="relative h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                  <div className="absolute -top-3 left-6 grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                    {i + 1}
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow">
                    <Icon name={s.icon} className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURE HIGHLIGHTS (light, alternating) ============ */}
      <section className="space-y-20 bg-white py-24 lg:space-y-28">
        <div className="mx-auto max-w-6xl px-5">
          <FeatureRow
            eyebrow="Never run dry"
            icon="trendingUp"
            title="Stock health you can read at a glance."
            body="Per-site levels, reorder thresholds and untouchable safety reserves — with unusual-usage detection that flags possible waste or theft before it costs you."
          >
            <StockMock />
          </FeatureRow>
        </div>
        <div className="mx-auto max-w-6xl px-5">
          <FeatureRow
            eyebrow="Smarter sourcing"
            icon="tag"
            title="Every vendor, ranked in milliseconds."
            body="The engine scores each offer on price, delivery ETA and how urgent the shortfall is — then splits the order across vendors to hit your deadline at the best price."
            reverse
          >
            <VendorMock />
          </FeatureRow>
        </div>
        <div className="mx-auto max-w-6xl px-5">
          <FeatureRow
            eyebrow="Weather-aware"
            icon="cloudRain"
            title="It orders ahead of the rain."
            body="Live, city-wise forecasts add an automatic buffer to weather-sensitive materials like cement — so a wet week never stalls the pour."
          >
            <WeatherMock />
          </FeatureRow>
        </div>
      </section>

      {/* ============ ROLE CHOOSER (dark) ============ */}
      <section className="relative overflow-hidden bg-slate-950 py-24 text-white">
        <div className="pointer-events-none absolute inset-0 blueprint opacity-60" />
        <div className="pointer-events-none absolute -top-24 left-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-5">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold tracking-[0.2em] text-amber-300 uppercase">
              Four workspaces, one source of truth
            </p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-balance">
              Pick your seat to start.
            </h2>
            <p className="mt-3 text-slate-300">
              Each role gets a workspace built for the job — themed, focused, and shareable across
              every site.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_CARDS.map((r, i) => (
              <Reveal key={r.key} delay={i * 90}>
                <Link
                  to={`/login?role=${r.key}`}
                  className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.1] ${r.glow}`}
                >
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${r.grad} text-white shadow-glow transition group-hover:scale-110`}
                  >
                    <Icon name={r.icon} className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">{r.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm text-slate-300">{r.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
                    Continue
                    <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          {/* stats band */}
          <Reveal>
            <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-slate-950/60 px-6 py-7 text-center">
                  <div className="text-amber-gradient text-3xl font-extrabold">{s.value}</div>
                  <div className="mt-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ CTA + FOOTER (dark) ============ */}
      <footer className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-5 pb-12">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-fuchsia-600/20 p-10 text-center sm:p-14">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
                See it running with live demo data.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-300">
                Five industries, six sites, and the auto-procurement engine — already seeded and
                ready to explore.
              </p>
              <Link
                to="/login?role=manager"
                className="group mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-[0_18px_50px_-18px_rgba(245,158,11,0.7)] transition hover:-translate-y-0.5"
              >
                Explore the live demo
                <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-slate-400 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Icon name="building" className="h-4 w-4" />
              </div>
              <span className="font-semibold text-slate-200">ConstructAI</span>
            </div>
            <span>Smart material procurement · Construction · Electrical · Plumbing · HVAC · Painting</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
