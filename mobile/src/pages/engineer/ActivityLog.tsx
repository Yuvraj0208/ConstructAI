import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Card, EmptyState, fmtNum, PageTitle, Spinner } from '../../lib/ui';
import type { DailyUpdate, MaterialRequest } from '../../types';

const REQ_PILL: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  issued: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-600',
};

export default function ActivityLog() {
  const { selectedSiteId } = useSite();
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedSiteId == null) return;
    setLoading(true);
    Promise.all([
      api.get<DailyUpdate[]>('/engineering/daily-updates', { params: { site_id: selectedSiteId } }),
      api.get<MaterialRequest[]>('/engineering/material-requests', { params: { site_id: selectedSiteId } }),
    ])
      .then(([u, r]) => {
        setUpdates(u.data);
        setRequests(r.data);
      })
      .finally(() => setLoading(false));
  }, [selectedSiteId]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Activity" subtitle="Recent updates & requests on this site" />

      <h2 className="mb-2 text-sm font-bold text-slate-700">Daily updates</h2>
      {updates.length === 0 ? (
        <EmptyState>No updates yet.</EmptyState>
      ) : (
        <div className="space-y-2.5">
          {updates.slice(0, 8).map((u) => (
            <Card key={u.id} className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-600">{fmtNum(u.progress_percent)}% complete</span>
                <span className="text-xs text-slate-400">
                  {new Date(u.created_at).toLocaleDateString()} · {u.labor_count} workers
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{u.summary}</p>
              {u.issues && <p className="mt-1 text-xs text-rose-600">Blocker: {u.issues}</p>}
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-6 mb-2 text-sm font-bold text-slate-700">Material requests</h2>
      {requests.length === 0 ? (
        <EmptyState>No requests yet.</EmptyState>
      ) : (
        <div className="space-y-2.5">
          {requests.slice(0, 8).map((r) => (
            <Card key={r.id} className="flex items-center justify-between p-3.5">
              <div className="min-w-0">
                <div className="font-medium text-slate-800">{r.needed_for || `Request #${r.id}`}</div>
                <div className="truncate text-xs text-slate-500">
                  {r.items.map((i) => `${fmtNum(i.quantity)} ${i.unit ?? ''} ${i.material_name}`).join(' · ')}
                </div>
              </div>
              <span
                className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${REQ_PILL[r.status]}`}
              >
                {r.status}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
