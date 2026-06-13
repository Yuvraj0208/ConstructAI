import { useEffect, useMemo, useState } from 'react';
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
import { api } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { useMaterials } from '../../hooks/useMaterials';
import { Layout } from '../../components/Layout';
import { Card, fmtMoney, fmtNum, Spinner, StatusBadge } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { WeatherPanel } from './WeatherPanel';
import { ProcurementPanel } from './ProcurementPanel';
import { ExpiryPanel } from './ExpiryPanel';
import { SiteProgressPanel } from './SiteProgressPanel';
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
  tone = 'slate',
  icon,
}: {
  label: string;
  value: number;
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
    </div>
  );
}

export default function ManagerDashboard() {
  const { selectedSite, selectedSiteId } = useSite();
  const { materials, loading, reload } = useMaterials();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<number | null>(null);
  const [usage, setUsage] = useState<DailyUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    if (selectedSiteId == null) return;
    api
      .get<Offer[]>('/vendors/offers', { params: { site_id: selectedSiteId } })
      .then((res) => setOffers(res.data));
  }, [selectedSiteId]);

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

  return (
    <Layout
      title="Manager Dashboard"
      subtitle="Stock health, usage analytics, and vendor offers at a glance"
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Materials" value={counts.total} icon="box" />
        <Kpi label="Low stock" value={counts.low} tone="amber" icon="alert" />
        <Kpi label="Critical" value={counts.critical} tone="rose" icon="critical" />
        <Kpi label="Active offers" value={offers.length} tone="indigo" icon="tag" />
      </div>

      {/* Weather + site progress */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <WeatherPanel city={selectedSite?.city} siteId={selectedSiteId} />
        <SiteProgressPanel siteId={selectedSiteId} />
      </div>

      {/* Expiry alerts (only renders when something is expiring/expired) */}
      <div className="mt-6 empty:mt-0">
        <ExpiryPanel siteId={selectedSiteId} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
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

      {/* Auto-procurement engine */}
      <div className="mt-6">
        <ProcurementPanel siteId={selectedSiteId} onChange={reload} />
      </div>

      {/* Vendor offers */}
      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <span className="text-sm font-semibold text-slate-700">Vendor offers</span>
          <span className="text-xs text-slate-400">
            Auto-ranking by price vs. ETA — approval flow coming next
          </span>
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
    </Layout>
  );
}
