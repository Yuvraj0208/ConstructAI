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
import { useAuth } from '../../auth/AuthContext';
import { useMaterials } from '../../hooks/useMaterials';
import { Layout } from '../../components/Layout';
import { Card, fmtMoney, fmtNum, inputClass, Spinner, StatusBadge } from '../../components/ui';
import { WeatherPanel } from './WeatherPanel';
import { ProcurementPanel } from './ProcurementPanel';
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

function Kpi({ label, value, tone = 'slate' }: { label: string; value: number; tone?: string }) {
  const toneClass =
    { rose: 'text-rose-600', amber: 'text-amber-600', indigo: 'text-indigo-600' }[tone] ??
    'text-slate-900';
  return (
    <Card className="p-4">
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${toneClass}`}>{value}</div>
    </Card>
  );
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { industries, industryId, setIndustryId, materials, loading, reload } = useMaterials(
    user?.industry_id ?? null,
  );

  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<number | null>(null);
  const [usage, setUsage] = useState<DailyUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    api.get<Offer[]>('/vendors/offers').then((res) => setOffers(res.data));
  }, []);

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
      actions={
        <select
          className={`${inputClass} w-48`}
          value={industryId ?? ''}
          onChange={(e) => setIndustryId(Number(e.target.value))}
        >
          {industries.map((ind) => (
            <option key={ind.id} value={ind.id}>
              {ind.name}
            </option>
          ))}
        </select>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Materials" value={counts.total} />
        <Kpi label="Low stock" value={counts.low} tone="amber" />
        <Kpi label="Critical" value={counts.critical} tone="rose" />
        <Kpi label="Active offers" value={offers.length} tone="indigo" />
      </div>

      {/* Weather */}
      <div className="mt-6">
        <WeatherPanel city={user?.city} />
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
                const pct = m.target_stock > 0 ? Math.min(100, (m.current_stock / m.target_stock) * 100) : 0;
                const threshPct =
                  m.target_stock > 0 ? Math.min(100, (m.threshold / m.target_stock) * 100) : 0;
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
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: STATUS_BAR[m.status] }}
                        />
                        <div
                          className="absolute inset-y-[-2px] w-px bg-slate-400"
                          style={{ left: `${threshPct}%` }}
                          title="Reorder threshold"
                        />
                      </div>
                      <span className="w-28 text-right text-xs text-slate-500">
                        {fmtNum(m.current_stock)}/{fmtNum(m.target_stock)} {m.unit}
                      </span>
                    </div>
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
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              ⚠️ Unusual consumption detected on{' '}
              <strong>{analysis.anomalies.map((a) => a.date.slice(5)).join(', ')}</strong> — well above
              the {fmtNum(analysis.mean)}-{selectedMat?.unit ?? 'unit'} daily norm. Worth checking for
              waste or theft.
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
        <ProcurementPanel onChange={reload} />
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
