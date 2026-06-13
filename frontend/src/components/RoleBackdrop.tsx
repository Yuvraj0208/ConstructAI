import type { ReactNode } from 'react';
import type { Role } from '../types';
import type { IconName } from './icons';

// Each role gets a distinct identity: an accent palette, an eyebrow label, a
// signature icon, and a faint themed line-art motif behind the dashboard.
export interface RoleTheme {
  eyebrow: string;
  icon: IconName;
  accentText: string; // eyebrow / accent text color
  accentGrad: string; // brand + role chip gradient
  chip: string; // soft role chip
  glowA: string; // backdrop blob colors
  glowB: string;
  motif: string; // motif stroke color (very faint)
}

export const ROLE_THEME: Record<Role, RoleTheme> = {
  manager: {
    eyebrow: 'Operations command center',
    icon: 'chart',
    accentText: 'text-indigo-600',
    accentGrad: 'from-indigo-500 via-violet-600 to-fuchsia-600',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70',
    glowA: 'bg-indigo-400/20',
    glowB: 'bg-violet-400/20',
    motif: 'text-indigo-500/[0.07]',
  },
  stock_handler: {
    eyebrow: 'Inventory & stock control',
    icon: 'box',
    accentText: 'text-amber-600',
    accentGrad: 'from-amber-500 via-orange-500 to-amber-600',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200/70',
    glowA: 'bg-amber-400/20',
    glowB: 'bg-orange-400/20',
    motif: 'text-amber-600/[0.08]',
  },
  site_engineer: {
    eyebrow: 'On-site engineering',
    icon: 'hardHat',
    accentText: 'text-emerald-600',
    accentGrad: 'from-emerald-500 via-teal-500 to-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
    glowA: 'bg-emerald-400/20',
    glowB: 'bg-teal-400/20',
    motif: 'text-emerald-600/[0.08]',
  },
  vendor: {
    eyebrow: 'Supply & delivery network',
    icon: 'truck',
    accentText: 'text-sky-600',
    accentGrad: 'from-sky-500 via-cyan-500 to-sky-600',
    chip: 'bg-sky-50 text-sky-700 ring-sky-200/70',
    glowA: 'bg-sky-400/20',
    glowB: 'bg-cyan-400/20',
    motif: 'text-sky-600/[0.08]',
  },
};

const motifProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Faint role-specific line art, anchored bottom-right behind the dashboard.
const MOTIF: Record<Role, ReactNode> = {
  // Analytics — rising bars, trend line, axis.
  manager: (
    <svg viewBox="0 0 520 340" {...motifProps} aria-hidden="true">
      <path d="M50 24v272h420" strokeWidth={3} />
      {[
        [96, 210],
        [156, 168],
        [216, 196],
        [276, 120],
        [336, 150],
        [396, 70],
      ].map(([x, y]) => (
        <rect key={x} x={x} y={y} width="38" height={296 - y} rx="4" />
      ))}
      <path d="M96 196 156 152 216 176 276 104 336 132 415 58" strokeWidth={3} />
      {[
        [96, 196],
        [156, 152],
        [216, 176],
        [276, 104],
        [336, 132],
        [415, 58],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="5" />
      ))}
    </svg>
  ),
  // Warehouse — shelving rack stacked with taped boxes.
  stock_handler: (
    <svg viewBox="0 0 520 340" {...motifProps} aria-hidden="true">
      <path d="M40 36v280M250 36v280M460 36v280M40 130h420M40 224h420M40 316h420" />
      {[
        [70, 50],
        [150, 50],
        [280, 50],
        [360, 50],
        [70, 144],
        [180, 144],
        [300, 144],
        [380, 144],
        [110, 238],
        [330, 238],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="70" height="64" rx="4" />
          <path d={`M${x} ${y + 22}h70`} strokeWidth={1.6} />
          <path d={`M${x + 35} ${y}v22`} strokeWidth={1.6} />
        </g>
      ))}
    </svg>
  ),
  // On-site — blueprint sheet, hard hat, tower crane.
  site_engineer: (
    <svg viewBox="0 0 520 340" {...motifProps} aria-hidden="true">
      {/* blueprint sheet */}
      <rect x="40" y="150" width="230" height="160" rx="6" />
      <path d="M40 190h230M40 230h230M40 270h230M90 150v160M150 150v160M210 150v160" strokeWidth={1.2} />
      <path d="M75 285v-45l40-28 40 28v45" strokeWidth={2.2} />
      {/* tower crane */}
      <path d="M380 320V70M340 70h150M470 70l16 26M360 96 490 70" strokeWidth={2.6} />
      <path d="M380 110h40v18h-40z" />
      <path d="M410 70v44" strokeWidth={1.4} />
      <path d="M410 114h22v14h-22z" />
      {/* hard hat */}
      <path d="M300 120a40 40 0 0 1 80 0" />
      <path d="M286 120h108a6 6 0 0 1 0 12H286a6 6 0 0 1 0-12Z" />
      <path d="M330 86v-14h20v14" strokeWidth={2} />
    </svg>
  ),
  // Logistics — delivery truck, route, parcels.
  vendor: (
    <svg viewBox="0 0 520 340" {...motifProps} aria-hidden="true">
      {/* truck */}
      <path d="M60 120h180v120H60z" rx="6" />
      <path d="M240 160h80l50 56v24h-130z" />
      <circle cx="130" cy="270" r="26" />
      <circle cx="320" cy="270" r="26" />
      <path d="M250 176h44l30 34h-74z" strokeWidth={1.6} />
      {/* dotted route + pins */}
      <path d="M70 56c80 0 80 40 170 40s90-40 200-30" strokeDasharray="2 14" strokeWidth={3} />
      <path d="M70 56a10 10 0 1 0 0-.1ZM450 64a10 10 0 1 0 0-.1Z" />
      {/* parcels */}
      <rect x="410" y="210" width="60" height="56" rx="4" />
      <path d="M410 232h60M440 210v56" strokeWidth={1.6} />
    </svg>
  ),
};

/**
 * A fixed, decorative, role-aware backdrop that sits behind every dashboard.
 * Purely visual — never intercepts pointer events.
 */
export function RoleBackdrop({ role }: { role: Role }) {
  const t = ROLE_THEME[role];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className={`animate-blob absolute -top-28 -left-24 h-[26rem] w-[26rem] rounded-full ${t.glowA} blur-3xl`}
      />
      <div
        className={`animate-blob absolute -right-20 -bottom-28 h-[32rem] w-[32rem] rounded-full ${t.glowB} blur-3xl`}
        style={{ animationDelay: '6s' }}
      />
      <div
        className={`animate-float absolute right-[-2rem] bottom-[-1rem] w-[40rem] max-w-[78vw] ${t.motif}`}
      >
        {MOTIF[role]}
      </div>
    </div>
  );
}
