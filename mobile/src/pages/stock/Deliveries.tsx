import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Button, Card, EmptyState, fmtMoney, fmtNum, PageTitle, Spinner } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import type { PurchaseOrder } from '../../types';

export default function Deliveries() {
  const { selectedSiteId } = useSite();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (selectedSiteId == null) return;
    setLoading(true);
    api
      .get<PurchaseOrder[]>('/procurement/orders', { params: { site_id: selectedSiteId } })
      .then((r) => setOrders(r.data.filter((o) => o.status === 'approved' || o.status === 'ordered')))
      .finally(() => setLoading(false));
  }, [selectedSiteId]);
  useEffect(load, [load]);

  async function receive(id: number) {
    setBusyId(id);
    try {
      await api.post(`/procurement/orders/${id}/receive`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageTitle title="Deliveries" subtitle="Receive approved orders into stock" />
      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState>No deliveries waiting.</EmptyState>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{o.material_name}</span>
                <span className="text-xs text-slate-400">{o.vendor_name}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
                <span>
                  <span className="font-semibold text-slate-700">{fmtNum(o.quantity)}</span> units · {o.eta_days}d
                  ETA
                </span>
                <span>{fmtMoney(o.total_price)}</span>
              </div>
              <div className="mt-3">
                <Button disabled={busyId === o.id} onClick={() => receive(o.id)}>
                  <Icon name="check" className="h-4 w-4" /> Receive into stock
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
