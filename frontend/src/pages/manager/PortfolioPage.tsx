import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Layout } from '../../components/Layout';
import { Card, fmtMoney, fmtNum, Spinner } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import type { Portfolio, PortfolioSite } from '../../types';

const TONES: Record<string, string> = {
  slate: 'text-slate-900',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
  indigo: 'text-indigo-600',
};

function Tile({
  label,
  value,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: string;
}) {
  const t = TONES[tone] ?? TONES.slate;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
        <Icon name={icon} className={`h-4 w-4 ${t}`} />
      </div>
      <div className={`mt-2 text-2xl font-extrabold ${t}`}>{value}</div>
    </Card>
  );
}

function StockCell({ s }: { s: PortfolioSite }) {
  if (s.critical === 0 && s.low === 0)
    return <span className="text-xs font-medium text-emerald-600">healthy</span>;
  return (
    <span className="inline-flex flex-wrap justify-center gap-1">
      {s.critical > 0 && (
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
          {s.critical} critical
        </span>
      )}
      {s.low > 0 && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
          {s.low} low
        </span>
      )}
    </span>
  );
}

function ScheduleCell({ s }: { s: PortfolioSite }) {
  if (s.milestones_overdue > 0)
    return (
      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
        {s.milestones_overdue} overdue
      </span>
    );
  if (s.milestones_at_risk > 0)
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
        {s.milestones_at_risk} due soon
      </span>
    );
  return <span className="text-xs text-slate-400">on track</span>;
}

export default function PortfolioPage() {
  const { setSelectedSiteId } = useSite();
  const navigate = useNavigate();
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Portfolio>('/portfolio')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openSite(id: number) {
    setSelectedSiteId(id);
    navigate('/app/manager');
  }

  return (
    <Layout title="Portfolio" subtitle="Every site at a glance — stock, spend, progress & schedule risk">
      {loading ? (
        <Card className="flex justify-center p-12">
          <Spinner />
        </Card>
      ) : !data ? (
        <Card className="p-6 text-sm text-slate-500">Could not load the portfolio.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Tile label="Sites" value={String(data.totals.sites)} icon="building" />
            <Tile label="Critical" value={String(data.totals.critical)} icon="critical" tone="rose" />
            <Tile label="Low stock" value={String(data.totals.low)} icon="alert" tone="amber" />
            <Tile label="Total spend" value={fmtMoney(data.totals.spend_total)} icon="wallet" tone="indigo" />
            <Tile
              label="Need attention"
              value={String(data.totals.sites_need_attention)}
              icon="bell"
              tone={data.totals.sites_need_attention > 0 ? 'rose' : 'slate'}
            />
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-slate-700">
            <Icon name="sparkles" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <span>{data.insight}</span>
          </div>

          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th className="px-5 py-3 font-medium">Site</th>
                    <th className="px-5 py-3 text-center font-medium">Stock</th>
                    <th className="px-5 py-3 text-right font-medium">Progress</th>
                    <th className="px-5 py-3 text-center font-medium">Schedule</th>
                    <th className="px-5 py-3 text-right font-medium">Spend</th>
                    <th className="px-5 py-3 text-right font-medium">Budget used</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.sites.map((s) => (
                    <tr key={s.id} className={`hover:bg-slate-50 ${s.needs_attention ? 'bg-rose-50/40' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{s.name}</div>
                        <div className="text-xs text-slate-400">
                          {s.city ? `${s.city} · ` : ''}
                          {s.materials_total} materials
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <StockCell s={s} />
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {s.latest_progress != null ? `${fmtNum(s.latest_progress)}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <ScheduleCell s={s} />
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">{fmtMoney(s.spend_total)}</td>
                      <td className="px-5 py-3 text-right">
                        {s.utilization_percent != null ? (
                          <span className={s.on_track === false ? 'font-semibold text-rose-600' : 'text-slate-700'}>
                            {s.utilization_percent}%
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openSite(s.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
                        >
                          Open <Icon name="arrowRight" className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.sites.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        No sites in your portfolio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Layout>
  );
}
