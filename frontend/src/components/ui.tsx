import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { MaterialStatus } from '../types';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 ${className}`}
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
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100';
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<MaterialStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  low: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
};

export function StatusBadge({ status }: { status: MaterialStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}
    >
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
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {children}
    </div>
  );
}
