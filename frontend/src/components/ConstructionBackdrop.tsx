// A construction-themed backdrop: blueprint grid + aurora glow + a dusk city
// skyline with a tower crane. Purely decorative (renders behind content).

const BUILDINGS: { x: number; w: number; h: number }[] = [
  { x: 20, w: 92, h: 150 },
  { x: 118, w: 64, h: 232 },
  { x: 190, w: 110, h: 176 },
  { x: 308, w: 78, h: 286 },
  { x: 394, w: 104, h: 200 },
  { x: 506, w: 132, h: 150 },
  { x: 660, w: 88, h: 250 },
  { x: 756, w: 112, h: 196 },
  { x: 1156, w: 120, h: 236 },
  { x: 1286, w: 120, h: 176 },
];

export function ConstructionBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden blueprint ${className}`}>
      {/* Aurora glow blobs */}
      <div className="animate-blob absolute -top-28 -left-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
      <div
        className="animate-blob absolute top-6 right-0 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl"
        style={{ animationDelay: '5s' }}
      />
      <div className="absolute bottom-0 left-1/3 h-72 w-[30rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />

      {/* Skyline + crane */}
      <svg
        className="absolute right-0 bottom-0 left-0 w-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="bldg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2347" />
            <stop offset="1" stopColor="#0b1020" />
          </linearGradient>
          <pattern id="windows" width="15" height="19" patternUnits="userSpaceOnUse">
            <rect x="3" y="4" width="5" height="7" fill="#fbbf24" opacity="0.55" />
            <rect x="9" y="4" width="3" height="7" fill="#fcd34d" opacity="0.35" />
          </pattern>
          <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f59e0b" stopOpacity="0.5" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* golden-hour glow near horizon */}
        <ellipse cx="980" cy="400" rx="520" ry="220" fill="url(#sun)" />

        {/* skyline */}
        {BUILDINGS.map((b) => (
          <g key={b.x}>
            <rect x={b.x} y={400 - b.h} width={b.w} height={b.h} fill="url(#bldg)" rx="2" />
            <rect x={b.x} y={400 - b.h} width={b.w} height={b.h} fill="url(#windows)" opacity="0.5" />
          </g>
        ))}

        {/* under-construction tower (exposed frame at top) */}
        <g stroke="#fb923c" strokeWidth="2" opacity="0.85" fill="none">
          <rect x="916" y="96" width="96" height="304" fill="url(#bldg)" stroke="none" />
          <rect
            x="916"
            y="96"
            width="96"
            height="304"
            fill="url(#windows)"
            opacity="0.4"
            stroke="none"
          />
          {/* exposed steel frame on top */}
          <path d="M916 96 H1012 M916 70 H1012 M932 70 V96 M964 70 V96 M996 70 V96 M916 70 L1012 96 M1012 70 L916 96" />
        </g>

        {/* Tower crane */}
        <g stroke="#f59e0b" strokeWidth="3" fill="#f59e0b">
          {/* mast */}
          <rect x="1052" y="70" width="9" height="330" stroke="none" opacity="0.95" />
          <path d="M1052 110 L1061 150 M1061 110 L1052 150 M1052 190 L1061 230 M1061 190 L1052 230 M1052 270 L1061 310 M1061 270 L1052 310" strokeWidth="1.5" opacity="0.8" />
          {/* cabin */}
          <rect x="1046" y="70" width="21" height="16" stroke="none" />
          {/* jib (long, to the left) */}
          <path d="M1046 64 H812" strokeWidth="4" />
          <path d="M1056 50 L840 64" strokeWidth="1.5" opacity="0.85" fill="none" />
          {/* counter-jib + counterweight */}
          <path d="M1067 64 H1140" strokeWidth="4" />
          <rect x="1132" y="58" width="22" height="22" stroke="none" />
          {/* hoist cable + hook */}
          <path d="M884 64 V150" strokeWidth="1.5" />
          <rect x="878" y="150" width="12" height="9" stroke="none" />
        </g>
      </svg>

      {/* legibility veil */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/5 to-slate-950/65" />
    </div>
  );
}
