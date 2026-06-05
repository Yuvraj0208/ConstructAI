import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../types';

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

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
              C
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-slate-900">ConstructAI</div>
              <div className="text-xs text-slate-500">{user ? ROLE_LABELS[user.role] : ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-slate-600 sm:block">{user.full_name}</span>
            )}
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
