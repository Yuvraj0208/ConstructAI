import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../site/SiteContext';
import { ROLE_LABELS } from '../types';

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Layout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const { sites, selectedSiteId, setSelectedSiteId } = useSite();

  return (
    <div className="app-shell min-h-screen">
      <header className="glass sticky top-0 z-40 border-b border-white/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-glow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M6 21V8l6-4 6 4v13M10 12h.01M14 12h.01M10 16h.01M14 16h.01" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold tracking-tight text-slate-900">
                Construct<span className="text-gradient">AI</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {user ? ROLE_LABELS[user.role] : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {sites.length > 0 && (
              <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/70 px-2.5 py-1.5 shadow-sm transition hover:border-indigo-300">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <select
                  value={selectedSiteId ?? ''}
                  onChange={(e) => setSelectedSiteId(Number(e.target.value))}
                  className="max-w-[11rem] bg-transparent text-sm font-semibold text-slate-800 outline-none"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` · ${s.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow">
                  {initials(user.full_name)}
                </div>
                <span className="text-sm font-medium text-slate-600">{user.full_name}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7">
        <div className="animate-fade-up mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
