import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Button, Card, EmptyState, fmtNum, PageTitle, Spinner } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import type { MaterialRequest } from '../../types';

export default function RequestsQueue() {
  const { selectedSiteId } = useSite();
  const [reqs, setReqs] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (selectedSiteId == null) return;
    setLoading(true);
    api
      .get<MaterialRequest[]>('/engineering/material-requests', {
        params: { site_id: selectedSiteId, status_filter: 'pending' },
      })
      .then((r) => setReqs(r.data))
      .finally(() => setLoading(false));
  }, [selectedSiteId]);
  useEffect(load, [load]);

  async function act(id: number, action: 'issue' | 'reject') {
    setBusyId(id);
    try {
      await api.post(`/engineering/material-requests/${id}/${action}`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageTitle title="Requests" subtitle="Issue or reject engineer material requests" />
      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : reqs.length === 0 ? (
        <EmptyState>No pending requests. 🎉</EmptyState>
      ) : (
        <div className="space-y-3">
          {reqs.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{r.needed_for || `Request #${r.id}`}</span>
                <span className="text-xs text-slate-400">{r.requester_name ?? ''}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {r.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{i.material_name}</span>
                    <span className="font-medium text-slate-700">
                      {fmtNum(i.quantity)} {i.unit}
                    </span>
                  </li>
                ))}
              </ul>
              {r.note && <p className="mt-2 text-xs text-slate-400">{r.note}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="danger" disabled={busyId === r.id} onClick={() => act(r.id, 'reject')}>
                  <Icon name="x" className="h-4 w-4" /> Reject
                </Button>
                <Button disabled={busyId === r.id} onClick={() => act(r.id, 'issue')}>
                  <Icon name="check" className="h-4 w-4" /> Issue
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
