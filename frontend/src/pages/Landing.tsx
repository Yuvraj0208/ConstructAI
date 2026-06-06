import { Link } from 'react-router-dom';
import type { Role } from '../types';

const ROLE_CARDS: { key: Role; title: string; emoji: string; desc: string }[] = [
  {
    key: 'stock_handler',
    title: 'Stock Handler',
    emoji: '📦',
    desc: 'Track material stock in real time. Log daily usage and incoming deliveries.',
  },
  {
    key: 'manager',
    title: 'Manager',
    emoji: '📊',
    desc: 'Live dashboards, set reorder thresholds, approve auto-orders, and catch anomalies.',
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
    desc: 'Post your price and delivery ETA for materials. Win orders automatically.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
            C
          </div>
          <span className="text-lg font-bold text-slate-900">ConstructAI</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Sign up
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center">
        <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
          Material Procurement · Construction &amp; beyond
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Never run out of materials again
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          ConstructAI watches your stock levels, calls the right vendors when you dip below
          threshold, and balances price against delivery speed automatically — so the right
          materials show up at the right time.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <p className="mb-4 text-center text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Get started — who are you?
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_CARDS.map((r) => (
            <Link
              key={r.key}
              to={`/login?role=${r.key}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="text-3xl">{r.emoji}</div>
              <h3 className="mt-3 text-lg font-bold text-slate-900">{r.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-600">{r.desc}</p>
              <span className="mt-4 text-sm font-semibold text-indigo-600 group-hover:underline">
                Continue as {r.title} →
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Built industry-agnostic — start with construction (cement, sand, bricks…), extend to
          electrical, plumbing, and more without changing the platform.
        </p>
      </section>
    </div>
  );
}
