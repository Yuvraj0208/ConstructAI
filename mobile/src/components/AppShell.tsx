import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../site/SiteContext';
import { ROLE_LABELS } from '../types';
import { Icon, type IconName } from '../lib/icons';

export interface Tab {
  to: string;
  label: string;
  icon: IconName;
}

export function AppShell({ tabs }: { tabs: Tab[] }) {
  const { user, logout } = useAuth();
  const { sites, selectedSiteId, setSelectedSiteId } = useSite();

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="pt-safe blueprint sticky top-0 z-20 text-white">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glow">
              <Icon name="building" className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight">
                Construct<span className="text-amber-300">AI</span> Field
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {user ? ROLE_LABELS[user.role] : ''}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Log out"
            className="rounded-lg p-2 text-slate-300 active:bg-white/10"
          >
            <Icon name="logout" className="h-5 w-5" />
          </button>
        </div>

        {sites.length > 0 && (
          <div className="px-4 pb-3">
            <label className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/10">
              <Icon name="mapPin" className="h-4 w-4 shrink-0 text-amber-300" />
              <select
                value={selectedSiteId ?? ''}
                onChange={(e) => setSelectedSiteId(Number(e.target.value))}
                className="w-full min-w-0 bg-transparent text-sm font-semibold text-white outline-none"
                aria-label="Switch site"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id} className="text-slate-900">
                    {s.name}
                    {s.city ? ` · ${s.city}` : ''}
                  </option>
                ))}
              </select>
              <Icon name="chevron" className="h-4 w-4 shrink-0 text-slate-300" />
            </label>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <Outlet />
      </main>

      <nav className="pb-safe sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`
              }
            >
              <Icon name={t.icon} className="h-5 w-5" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
