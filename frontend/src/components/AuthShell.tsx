import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ConstructionBackdrop } from './ConstructionBackdrop';
import { Icon } from './icons';

const FEATURES = [
  'Auto-reorders the moment stock dips below threshold',
  'Ranks vendors by price vs. delivery speed',
  'Per-site stock, live weather, batch expiry & safety reserves',
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-glow">
        <Icon name="building" className="h-5 w-5" />
      </div>
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        Construct<span className={light ? 'text-amber-gradient' : 'text-gradient'}>AI</span>
      </span>
    </Link>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left — construction visual (desktop) */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <ConstructionBackdrop />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <Brand light />
          <div className="max-w-md">
            <h2 className="text-4xl leading-tight font-extrabold tracking-tight">
              Smarter procurement for <span className="text-amber-gradient">every build.</span>
            </h2>
            <p className="mt-4 text-slate-300">
              The AI-native platform that keeps materials flowing across all your sites.
            </p>
            <ul className="mt-7 space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-400/20 text-amber-300">
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-400">Construction · Electrical · Plumbing · HVAC · Painting</p>
        </div>
      </div>

      {/* Right — form */}
      <div className="app-shell flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="animate-fade-up w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Brand />
          </div>
          <div className="glass rounded-2xl border border-white/70 p-7 shadow-soft ring-1 ring-slate-900/5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-5">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-slate-600">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
