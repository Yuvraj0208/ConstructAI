import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Button, Card, ErrorText, fmtMoney, inputClass, labelClass, Spinner } from '../../components/ui';
import { Icon } from '../../components/icons';
import type { Budget, BudgetForecast } from '../../types';

const CATS = [
  { key: 'materials_amount', label: 'Materials', color: 'bg-indigo-500' },
  { key: 'labour_amount', label: 'Labour', color: 'bg-violet-500' },
  { key: 'contingency_amount', label: 'Contingency', color: 'bg-amber-500' },
] as const;

export function BudgetPanel({ siteId }: { siteId: number | null }) {
  const [data, setData] = useState<BudgetForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTotal, setEditTotal] = useState('');
  const [editRate, setEditRate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (siteId == null) return;
    setLoading(true);
    setEditing(false);
    api
      .get<BudgetForecast>('/ai/budget', { params: { site_id: siteId } })
      .then((r) => setData(r.data))
      .catch(() => setError('Could not load the budget.'))
      .finally(() => setLoading(false));
  }, [siteId]);

  async function repropose() {
    if (siteId == null) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post<BudgetForecast>('/ai/budget/propose', null, {
        params: { site_id: siteId },
      });
      setData(r.data);
    } catch {
      setError('Could not re-propose the budget.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(b: Budget) {
    setEditTotal(String(Math.round(b.total_amount)));
    setEditRate(String(Math.round(b.labor_rate)));
    setEditing(true);
  }

  async function saveEdit(id: number) {
    setBusy(true);
    setError('');
    try {
      const r = await api.patch<BudgetForecast>(`/ai/budget/${id}`, {
        total_amount: Number(editTotal),
        labor_rate: Number(editRate),
      });
      setData(r.data);
      setEditing(false);
    } catch {
      setError('Could not save your changes.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex justify-center p-10">
        <Spinner />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="p-5">
        <ErrorText>{error || 'No budget available.'}</ErrorText>
      </Card>
    );
  }

  const b = data.budget;
  const util = Math.max(0, Math.min(100, data.utilization_percent));

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow">
            <Icon name="wallet" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Budget &amp; Forecast</h2>
            <p className="text-xs text-slate-400">
              {b.source === 'ai' ? 'AI-proposed' : 'Manager-adjusted'} · {fmtMoney(b.total_amount)} total
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => startEdit(b)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-white"
          >
            <Icon name="pencil" className="h-3.5 w-3.5" /> Adjust
          </button>
          <button
            onClick={repropose}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-50"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> Re-propose
          </button>
        </div>
      </div>

      {/* Category split */}
      <div className="mt-5">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {CATS.map((c) => {
            const pct = b.total_amount > 0 ? (b[c.key] / b.total_amount) * 100 : 0;
            return (
              <div
                key={c.key}
                className={c.color}
                style={{ width: `${pct}%` }}
                title={`${c.label}: ${fmtMoney(b[c.key])}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {CATS.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`h-2 w-2 rounded-full ${c.color}`} />
              {c.label} <span className="font-semibold text-slate-700">{fmtMoney(b[c.key])}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Spend vs budget */}
      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Spent {fmtMoney(data.spend.total)} · committed {fmtMoney(data.committed)}
          </span>
          <span className="font-semibold text-slate-700">{data.utilization_percent}% used</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100">
          <div
            className={`h-2.5 rounded-full ${data.on_track ? 'bg-emerald-500' : 'bg-rose-500'}`}
            style={{ width: `${util}%` }}
          />
        </div>
      </div>

      {/* Forecast insight */}
      <div
        className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
          data.on_track
            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
            : 'border-rose-200 bg-rose-50/60 text-rose-800'
        }`}
      >
        <Icon name={data.on_track ? 'trendingUp' : 'alert'} className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{data.insight}</span>
      </div>

      {b.rationale && <p className="mt-3 text-xs leading-relaxed text-slate-400">{b.rationale}</p>}

      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>

      {editing && (
        <div className="animate-fade-up mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Total budget (₹)</label>
              <input
                type="number"
                className={inputClass}
                value={editTotal}
                onChange={(e) => setEditTotal(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Labour rate (₹/worker-day)</label>
              <input
                type="number"
                className={inputClass}
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => saveEdit(b.id)} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
