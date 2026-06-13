import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { MaterialStatus } from '../types';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/70 bg-white/85 shadow-soft ring-1 ring-slate-900/[0.04] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
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
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-18px_rgba(99,70,229,0.65)] active:translate-y-0'
      : 'border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:bg-white hover:-translate-y-0.5';
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<MaterialStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  low: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  critical: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};
const STATUS_DOT: Record<MaterialStatus, string> = {
  ok: 'bg-emerald-500',
  low: 'bg-amber-500',
  critical: 'bg-rose-500',
};

export function StatusBadge({ status }: { status: MaterialStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${STATUS_STYLES[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]} ${status === 'critical' ? 'animate-pulse' : ''}`}
      />
      {status}
    </span>
  );
}

export function fmtNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtMoney(n: number): string {
  return '₹' + fmtNum(n);
}

// Shared form styles so inputs look consistent across pages.
export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15';

export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm text-rose-700">
      {children}
    </div>
  );
}
