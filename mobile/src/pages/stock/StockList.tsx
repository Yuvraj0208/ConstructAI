import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Card, EmptyState, fmtNum, PageTitle, Spinner, StatusBadge } from '../../lib/ui';
import type { Material } from '../../types';

export default function StockList() {
  const { selectedSiteId } = useSite();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedSiteId == null) return;
    setLoading(true);
    api
      .get<Material[]>('/materials', { params: { site_id: selectedSiteId } })
      .then((r) => setMaterials(r.data))
      .finally(() => setLoading(false));
  }, [selectedSiteId]);

  return (
    <div>
      <PageTitle title="Stock" subtitle="Live material levels on this site" />
      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : materials.length === 0 ? (
        <EmptyState>No materials on this site.</EmptyState>
      ) : (
        <div className="space-y-2.5">
          {materials.map((m) => (
            <Card key={m.id} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">{m.name}</span>
                <StatusBadge status={m.status} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm text-slate-500">
                <span>
                  <span className="font-semibold text-slate-700">{fmtNum(m.available_stock)}</span> {m.unit}{' '}
                  available
                </span>
                <span className="text-xs">
                  on hand {fmtNum(m.current_stock)} · thr {fmtNum(m.threshold)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
