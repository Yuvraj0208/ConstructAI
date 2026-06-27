import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, apiError } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { useMaterials } from '../../hooks/useMaterials';
import { Layout } from '../../components/Layout';
import { Card, fmtMoney, fmtNum, Spinner, StatusBadge } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { WeatherPanel } from './WeatherPanel';
import { ProcurementPanel } from './ProcurementPanel';
import { ExpiryPanel } from './ExpiryPanel';
import { SiteProgressPanel } from './SiteProgressPanel';
import { AskAiPanel } from './AskAiPanel';
import { BudgetPanel } from './BudgetPanel';
import { NotesSearchPanel } from './NotesSearchPanel';
import { SitePhotosPanel } from '../../components/SitePhotosPanel';
import { SchedulePanel } from '../../components/SchedulePanel';
import type { DailyUsage, Material, Offer } from '../../types';

const STATUS_BAR: Record<string, string> = {
  ok: '#10b981',
  low: '#f59e0b',
  critical: '#f43f5e',
};

/** Flag days where consumption is far above the period's norm (possible theft/waste). */
function analyzeUsage(series: DailyUsage[]) {
  const nonzero = series.map((s) => s.consumed).filter((v) => v > 0);
  const mean = nonzero.length ? nonzero.reduce((a, b) => a + b, 0) / nonzero.length : 0;
  const variance = nonzero.length
    ? nonzero.reduce((a, b) => a + (b - mean) ** 2, 0) / nonzero.length
    : 0;
  const std = Math.sqrt(variance);
  const alertLevel = mean + 2 * std;
  const points = series.map((s) => ({
    ...s,
    label: s.date.slice(5), // MM-DD
    anomaly: s.consumed > 0 && std > 0 && s.consumed > alertLevel,
  }));
  return { points, mean, alertLevel, anomalies: points.filter((p) => p.anomaly) };
}

function pickDefaultMaterial(materials: Material[]): number | null {
  const critical = materials.find((m) => m.status === 'critical');
  const low = materials.find((m) => m.status === 'low');
  return (critical ?? low ?? materials[0])?.id ?? null;
}

const KPI_TONES: Record<string, { grad: string; ring: string; text: string; chip: string }> = {
  slate: { grad: 'from-slate-50', ring: 'ring-slate-200/70', text: 'text-slate-900', chip: 'bg-slate-100 text-slate-500' },
  indigo: { grad: 'from-indigo-50', ring: 'ring-indigo-100', text: 'text-indigo-600', chip: 'bg-indigo-100 text-indigo-600' },
  amber: { grad: 'from-amber-50', ring: 'ring-amber-100', text: 'text-amber-600', chip: 'bg-amber-100 text-amber-600' },
  rose: { grad: 'from-rose-50', ring: 'ring-rose-100', text: 'text-rose-600', chip: 'bg-rose-100 text-rose-600' },
};

function Kpi({
  label,
  value,
  hint,
  tone = 'slate',
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: string;
  icon?: IconName;
}) {
  const t = KPI_TONES[tone] ?? KPI_TONES.slate;
  return (
    <div
      className={`group rounded-2xl border border-white/70 bg-gradient-to-br ${t.grad} to-white p-4 shadow-soft ring-1 ${t.ring} transition hover:-translate-y-0.5`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
        {icon && (
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${t.chip} transition group-hover:scale-110`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className={`mt-2 text-3xl font-extrabold ${t.text}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-slate-400">{hint}</div>
    </div>
  );
}

/** A labelled section divider so the long dashboard reads as organised groups. */
function SectionLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="mt-9 mb-4 flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <h2 className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">{children}</h2>
      <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  loading = false,
  disabled = false,
  primary = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-60 ${
        primary
          ? 'bg-white text-indigo-700 shadow-sm hover:bg-white/90'
          : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25'
      }`}
    >
      {loading ? (
        <span
          className={`h-4 w-4 animate-spin rounded-full border-2 ${
            primary ? 'border-indigo-200 border-t-indigo-600' : 'border-white/40 border-t-white'
          }`}
        />
      ) : (
        <Icon name={icon} className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}

export default function ManagerDashboard() {
  const { selectedSite, selectedSiteId } = useSite();
  const { materials, loading, reload } = useMaterials();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<number | null>(null);
  const [usage, setUsage] = useState<DailyUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // Top command-bar actions refresh the panels by bumping this key.
  const [refreshKey, setRefreshKey] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const aiRef = useRef<HTMLDivElement>(null);

  function loadOffers() {
    if (selectedSiteId == null) return;
    api.get<Offer[]>('/vendors/offers', { params: { site_id: selectedSiteId } }).then((res) => setOffers(res.data));
  }
  useEffect(loadOffers, [selectedSiteId]);

  // When the material list changes (e.g. industry switch), pick a sensible default.
  useEffect(() => {
    setSelectedMaterial((cur) =>
      cur && materials.some((m) => m.id === cur) ? cur : pickDefaultMaterial(materials),
    );
  }, [materials]);

  useEffect(() => {
    if (selectedMaterial == null) return;
    setUsageLoading(true);
    api
      .get<DailyUsage[]>('/stock/daily-usage', { params: { material_id: selectedMaterial, days: 14 } })
      .then((res) => setUsage(res.data))
      .finally(() => setUsageLoading(false));
  }, [selectedMaterial]);

  const counts = useMemo(
    () => ({
      total: materials.length,
      low: materials.filter((m) => m.status === 'low').length,
      critical: materials.filter((m) => m.status === 'critical').length,
    }),
    [materials],
  );

  const analysis = useMemo(() => analyzeUsage(usage), [usage]);
  const selectedMat = materials.find((m) => m.id === selectedMaterial);

  async function runAction(kind: string, fn: () => Promise<string>) {
    if (selectedSiteId == null) return;
    setActing(kind);
    setActionErr('');
    setActionMsg('');
    try {
      const msg = await fn();
      setActionMsg(msg);
      await reload();
      loadOffers();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionErr(apiError(e));
    } finally {
      setActing(null);
    }
  }

  const runProcurement = () =>
    runAction('run', async () => {
      const r = await api.post('/procurement/run', null, { params: { site_id: selectedSiteId } });
      return r.data.message ?? 'Auto-procurement complete.';
    });

  const draftOrders = () =>
    runAction('draft', async () => {
      const r = await api.post<unknown[]>('/ai/draft-orders', null, { params: { site_id: selectedSiteId } });
      return r.data.length
        ? `AI drafted ${r.data.length} order(s) for your approval.`
        : 'AI found nothing that needs ordering right now.';
    });

  const reproposeBudget = () =>
    runAction('budget', async () => {
      await api.post('/ai/budget/propose', null, { params: { site_id: selectedSiteId } });
      return 'Budget re-proposed by the AI.';
    });

  function scrollToAi() {
    aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <Layout title="Manager Dashboard" subtitle="Stock health, AI insights & site operations — in one place">
      {/* ===== Command bar (primary actions, up top) ===== */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-white">
            <div className="text-[11px] font-semibold tracking-wider text-white/70 uppercase">
              {selectedSite?.name ?? 'Site'} · command center
            </div>
            <div className="text-lg font-bold">Quick actions</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionBtn primary icon="bolt" label="Run procurement" loading={acting === 'run'} disabled={!!acting} onClick={runProcurement} />
            <ActionBtn icon="sparkles" label="AI draft orders" loading={acting === 'draft'} disabled={!!acting} onClick={draftOrders} />
            <ActionBtn icon="refresh" label="Re-propose budget" loading={acting === 'budget'} disabled={!!acting} onClick={reproposeBudget} />
            <ActionBtn icon="send" label="Ask AI" onClick={scrollToAi} />
            <Link
              to="/app/portfolio"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25 active:scale-95"
            >
              <Icon name="layers" className="h-4 w-4" /> Portfolio
            </Link>
          </div>
        </div>
        {(actionMsg || actionErr) && (
          <div
            className={`px-5 py-2.5 text-sm font-medium ${
              actionErr ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {actionErr || actionMsg}
          </div>
        )}
      </Card>

      {/* ===== KPIs ===== */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Materials" value={counts.total} hint="tracked on this site" icon="box" />
        <Kpi label="Low stock" value={counts.low} hint="below threshold" tone="amber" icon="alert" />
        <Kpi label="Critical" value={counts.critical} hint="need ordering" tone="rose" icon="critical" />
        <Kpi label="Active offers" value={offers.length} hint="from vendors" tone="indigo" icon="tag" />
      </div>

      {/* ===== AI & insights ===== */}
      <div ref={aiRef}>
        <SectionLabel icon="sparkles">AI &amp; insights</SectionLabel>
        <div className="grid gap-5 lg:grid-cols-2">
          <AskAiPanel siteId={selectedSiteId} />
          <BudgetPanel key={`budget-${refreshKey}`} siteId={selectedSiteId} />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <SchedulePanel siteId={selectedSiteId} canManage />
          <NotesSearchPanel siteId={selectedSiteId} />
        </div>
      </div>

      {/* ===== Operations ===== */}
      <SectionLabel icon="box">Operations</SectionLabel>

      <div className="empty:hidden">
        <ExpiryPanel siteId={selectedSiteId} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Stock overview */}
        <Card className="lg:col-span-1">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Stock overview
          </div>
          {loading ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {materials.map((m) => {
                const cap = m.target_stock > 0 ? m.target_stock : 1;
                const currentPct = Math.min(100, (m.current_stock / cap) * 100);
                const reservePct = Math.min(100, (m.reserved_quantity / cap) * 100);
                const grayPct = Math.min(reservePct, currentPct); // reserved stock physically on hand
                const availFillPct = Math.max(0, currentPct - grayPct); // usable stock, above the reserve
                const threshPct = Math.min(100, (m.threshold / cap) * 100);
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMaterial(m.id)}
                    className={`block w-full px-5 py-3 text-left transition hover:bg-slate-50 ${
                      selectedMaterial === m.id ? 'bg-indigo-50/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{m.name}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative h-2 flex-1 rounded-full bg-slate-100">
                        {grayPct > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 rounded-l-full bg-slate-300"
                            style={{ width: `${grayPct}%` }}
                            title="Reserved safety stock"
                          />
                        )}
                        <div
                          className="absolute inset-y-0 rounded-r-full"
                          style={{ left: `${grayPct}%`, width: `${availFillPct}%`, backgroundColor: STATUS_BAR[m.status] }}
                        />
                        <div
                          className="absolute inset-y-[-2px] w-px bg-slate-500"
                          style={{ left: `${threshPct}%` }}
                          title="Reorder threshold"
                        />
                      </div>
                      <span
                        className="w-24 text-right text-xs text-slate-500"
                        title={`${fmtNum(m.current_stock)} ${m.unit} on hand`}
                      >
                        {fmtNum(m.available_stock)} avail
                      </span>
                    </div>
                    {m.reserved_quantity > 0 && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        {fmtNum(m.current_stock)} on hand · {fmtNum(m.reserved_quantity)} {m.unit} reserved
                        {m.below_reserve && (
                          <span className="font-semibold text-rose-500"> · into reserve</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Usage analytics + anomaly detection */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Usage analytics{selectedMat ? ` — ${selectedMat.name}` : ''}
            </h2>
            <span className="text-xs text-slate-400">Last 14 days</span>
          </div>

          {analysis.anomalies.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Unusual consumption detected on{' '}
                <strong>{analysis.anomalies.map((a) => a.date.slice(5)).join(', ')}</strong> — well
                above the {fmtNum(analysis.mean)}-{selectedMat?.unit ?? 'unit'} daily norm. Worth
                checking for waste or theft.
              </span>
            </div>
          )}

          <div className="mt-4 h-72">
            {usageLoading ? (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288} minWidth={0}>
                <BarChart data={analysis.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(value) => [fmtNum(Number(value)), 'Consumed']}
                  />
                  {analysis.alertLevel > 0 && (
                    <ReferenceLine
                      y={analysis.alertLevel}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{ value: 'alert', fontSize: 10, fill: '#f43f5e', position: 'right' }}
                    />
                  )}
                  <Bar dataKey="consumed" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {analysis.points.map((p, i) => (
                      <Cell key={i} fill={p.anomaly ? '#f43f5e' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Auto-procurement orders (actions live in the command bar above) */}
      <div className="mt-5">
        <ProcurementPanel key={`proc-${refreshKey}`} siteId={selectedSiteId} onChange={reload} showActions={false} />
      </div>

      {/* Vendor offers */}
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <span className="text-sm font-semibold text-slate-700">Vendor offers</span>
          <span className="text-xs text-slate-400">Auto-ranking by price vs. ETA</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2 font-medium">Material</th>
                <th className="px-5 py-2 font-medium">Vendor</th>
                <th className="px-5 py-2 text-right font-medium">Price</th>
                <th className="px-5 py-2 text-right font-medium">ETA</th>
                <th className="px-5 py-2 text-right font-medium">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {offers.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{o.material_name}</td>
                  <td className="px-5 py-2.5 text-slate-600">{o.vendor_name}</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{fmtMoney(o.price_per_unit)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{o.eta_days}d</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{fmtNum(o.available_quantity)}</td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No active offers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== Site status ===== */}
      <SectionLabel icon="mapPin">Site status</SectionLabel>
      <div className="grid gap-5 lg:grid-cols-2">
        <WeatherPanel city={selectedSite?.city} siteId={selectedSiteId} />
        <SiteProgressPanel siteId={selectedSiteId} />
      </div>
      <div className="mt-5">
        <SitePhotosPanel siteId={selectedSiteId} />
      </div>
    </Layout>
  );
}
