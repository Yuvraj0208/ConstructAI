import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Button, Card, ErrorText, inputClass, Spinner } from './ui';
import { Icon } from './icons';
import type { Milestone } from '../types';

function dayInfo(m: Milestone) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tgt = new Date(`${m.target_date}T00:00:00`);
  const days = Math.round((tgt.getTime() - today.getTime()) / 86_400_000);
  if (m.status === 'done') return { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  if (days < 0) return { label: `Overdue ${-days}d`, cls: 'bg-rose-50 text-rose-700 ring-rose-200' };
  if (days <= 7) return { label: `Due in ${days}d`, cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return { label: `In ${days}d`, cls: 'bg-slate-100 text-slate-500 ring-slate-200' };
}

export function SchedulePanel({
  siteId,
  canManage = false,
}: {
  siteId: number | null;
  canManage?: boolean;
}) {
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function load() {
    if (siteId == null) return;
    setLoading(true);
    api
      .get<Milestone[]>('/schedule/milestones', { params: { site_id: siteId } })
      .then((r) => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, [siteId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (siteId == null || !title.trim() || !date) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/schedule/milestones', {
        site_id: siteId,
        title: title.trim(),
        target_date: date,
        sort_order: items.length,
      });
      setTitle('');
      setDate('');
      load();
    } catch {
      setError('Could not add the milestone.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: Milestone) {
    try {
      await api.patch(`/schedule/milestones/${m.id}`, {
        status: m.status === 'done' ? 'pending' : 'done',
      });
      load();
    } catch {
      setError('Could not update the milestone.');
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/schedule/milestones/${id}`);
      load();
    } catch {
      setError('Could not delete the milestone.');
    }
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow">
          <Icon name="clock" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Schedule</h2>
          <p className="text-xs text-slate-400">Milestones the AI tracks for schedule risk</p>
        </div>
      </div>

      <div className="mt-4 flex-1">
        {loading && items.length === 0 ? (
          <div className="flex justify-center p-4">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            No milestones yet.{canManage ? ' Add one below.' : ''}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((m) => {
              const d = dayInfo(m);
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-2"
                >
                  <button
                    onClick={() => toggle(m)}
                    title={m.status === 'done' ? 'Mark not done' : 'Mark done'}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                      m.status === 'done'
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 text-transparent hover:border-indigo-400'
                    }`}
                  >
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-sm font-medium ${
                        m.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'
                      }`}
                    >
                      {m.title}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(`${m.target_date}T00:00:00`).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${d.cls}`}>
                    {d.label}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => remove(m.id)}
                      className="shrink-0 text-slate-300 hover:text-rose-500"
                      title="Delete"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>

      {canManage && (
        <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} min-w-[8rem] flex-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New milestone…"
          />
          <input
            type="date"
            className={`${inputClass} w-auto`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button type="submit" disabled={busy || !title.trim() || !date}>
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}
