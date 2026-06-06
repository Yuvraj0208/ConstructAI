import { useEffect, useState } from 'react';
import { api, apiError } from '../../api/client';
import { Card, fmtNum } from '../../components/ui';
import type { MaterialRequest } from '../../types';

export function MaterialRequestsQueue({
  siteId,
  onIssued,
}: {
  siteId?: number | null;
  onIssued?: () => void;
}) {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [error, setError] = useState('');

  function load() {
    if (siteId == null) return;
    api
      .get<MaterialRequest[]>('/engineering/material-requests', {
        params: { site_id: siteId, status_filter: 'pending' },
      })
      .then((r) => setRequests(r.data))
      .catch(() => {});
  }
  useEffect(load, [siteId]);

  async function act(id: number, action: 'issue' | 'reject') {
    try {
      await api.post(`/engineering/material-requests/${id}/${action}`);
      load();
      if (action === 'issue') onIssued?.();
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <span className="text-sm font-semibold text-slate-700">Material requests</span>
        <span className="text-xs text-slate-400">
          from the site engineer — approve to release stock (FIFO)
        </span>
      </div>
      {error && (
        <div className="px-5 pt-3">
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium text-slate-800">
                {r.needed_for || `Request #${r.id}`}{' '}
                <span className="font-normal text-slate-400">· {r.requester_name}</span>
              </div>
              <div className="text-xs text-slate-500">
                {r.items.map((i) => `${fmtNum(i.quantity)} ${i.unit ?? ''} ${i.material_name}`).join(' · ')}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => act(r.id, 'issue')}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Issue
              </button>
              <button
                onClick={() => act(r.id, 'reject')}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="px-5 py-8 text-center text-slate-400">No pending requests.</div>
        )}
      </div>
    </Card>
  );
}
