import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { MaterialStatus } from '../types';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white shadow-soft ${className}`}>{children}</div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 ${className}`}
    />
  );
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[.99] disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow'
      : variant === 'danger'
        ? 'border border-rose-200 bg-rose-50 text-rose-600'
        : 'border border-slate-200 bg-white text-slate-700';
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

const STATUS: Record<MaterialStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  low: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  critical: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};
const DOT: Record<MaterialStatus, string> = {
  ok: 'bg-emerald-500',
  low: 'bg-amber-500',
  critical: 'bg-rose-500',
};

export function StatusBadge({ status }: { status: MaterialStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${STATUS[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${DOT[status]} ${status === 'critical' ? 'animate-pulse' : ''}`}
      />
      {status}
    </span>
  );
}

// 16px font-size on inputs prevents iOS Safari from auto-zooming on focus.
export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15';
export const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
      {children}
    </div>
  );
}

export function OkText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="animate-fade-up mb-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtMoney(n: number): string {
  return '₹' + fmtNum(n);
}
