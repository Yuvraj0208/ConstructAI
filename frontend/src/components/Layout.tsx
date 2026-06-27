import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../site/SiteContext';
import { ROLE_LABELS } from '../types';
import { Icon } from './icons';
import { RoleBackdrop, ROLE_THEME } from './RoleBackdrop';

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

  const role = user?.role ?? 'manager';
  const theme = ROLE_THEME[role];

  return (
    <div className="app-shell relative min-h-screen">
      {user && <RoleBackdrop role={role} />}

      <header className="glass sticky top-0 z-30 border-b border-white/60">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          {/* Brand — accent shifts with the role */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div
              className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${theme.accentGrad} text-white shadow-glow`}
            >
              <Icon name="building" className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold tracking-tight text-slate-900">
                Construct<span className={theme.accentText}>AI</span>
              </div>
              <div className={`flex items-center gap-1 text-[11px] font-semibold ${theme.accentText}`}>
                <Icon name={theme.icon} className="h-3 w-3" />
                {ROLE_LABELS[role]}
              </div>
            </div>
          </div>

          <div className="flex flex-1" />

          {/* Controls — each item is shrink-protected so they can never overlap */}
          <div className="flex min-w-0 items-center gap-2">
            {role === 'manager' && (
              <Link
                to="/app/portfolio"
                className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white sm:inline-flex"
              >
                <Icon name="layers" className="h-4 w-4" /> Portfolio
              </Link>
            )}
            {sites.length > 0 && (
              <label className="inline-flex min-w-0 max-w-[11rem] shrink items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 shadow-sm transition focus-within:border-indigo-300 hover:border-indigo-300 sm:max-w-[15rem]">
                <Icon name="mapPin" className={`h-4 w-4 shrink-0 ${theme.accentText}`} />
                <select
                  value={selectedSiteId ?? ''}
                  onChange={(e) => setSelectedSiteId(Number(e.target.value))}
                  className="w-full min-w-0 truncate bg-transparent text-sm font-semibold text-slate-800 outline-none"
                  aria-label="Switch site"
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
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <div
                  className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${theme.accentGrad} text-xs font-bold text-white shadow`}
                  title={user.full_name}
                >
                  {initials(user.full_name)}
                </div>
                <span className="hidden max-w-[8rem] truncate text-sm font-medium text-slate-600 lg:block">
                  {user.full_name}
                </span>
              </div>
            )}

            <button
              onClick={logout}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white"
            >
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-7">
        <div className="animate-fade-up mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div
              className={`mb-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ring-1 ${theme.chip}`}
            >
              <Icon name={theme.icon} className="h-3.5 w-3.5" />
              {theme.eyebrow}
            </div>
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
