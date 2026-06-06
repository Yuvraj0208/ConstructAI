import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Card, fmtNum } from '../../components/ui';
import type { DailyUpdate } from '../../types';

export function SiteProgressPanel({ siteId }: { siteId?: number | null }) {
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);

  useEffect(() => {
    if (siteId == null) return;
    api
      .get<DailyUpdate[]>('/engineering/daily-updates', { params: { site_id: siteId } })
      .then((r) => setUpdates(r.data))
      .catch(() => {});
  }, [siteId]);

  if (updates.length === 0) return null;

  const latest = updates[0];
  const openIssues = updates.filter((u) => u.issues).slice(0, 3);
  const trend = [...updates].reverse().slice(-12);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">🏗️ Site progress</h2>
        <span className="text-xs text-slate-400">
          {latest.author_name ?? 'site engineer'} · {new Date(latest.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="text-3xl font-bold text-indigo-600">{fmtNum(latest.progress_percent)}%</div>
        <div className="min-w-0 flex-1">
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-indigo-500"
              style={{ width: `${Math.min(100, latest.progress_percent)}%` }}
            />
          </div>
          <div className="mt-1 truncate text-xs text-slate-500">{latest.summary}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-slate-800">{latest.labor_count}</div>
          <div className="text-[10px] tracking-wide text-slate-400 uppercase">workers</div>
        </div>
      </div>

      {openIssues.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Open blockers</div>
          <ul className="mt-1 space-y-1">
            {openIssues.map((u) => (
              <li
                key={u.id}
                className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-1.5 text-sm text-rose-700"
              >
                ⚠ {u.issues}
              </li>
            ))}
          </ul>
        </div>
      )}

      {trend.length > 1 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Progress trend
          </div>
          <div className="flex h-16 items-end gap-1">
            {trend.map((u) => (
              <div
                key={u.id}
                className="flex-1 rounded-t bg-indigo-200"
                style={{ height: `${Math.max(6, Math.min(100, u.progress_percent) * 0.6)}px` }}
                title={`${fmtNum(u.progress_percent)}% · ${new Date(u.created_at).toLocaleDateString()}`}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
