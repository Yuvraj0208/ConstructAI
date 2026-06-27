import { useEffect, useState } from 'react';
import { api, apiError } from '../../api/client';
import { Button, Card, fmtMoney, fmtNum } from '../../components/ui';
import { Icon } from '../../components/icons';
import type { POStatus, PurchaseOrder } from '../../types';

const STATUS_STYLES: Record<POStatus, string> = {
  suggested: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-emerald-100 text-emerald-700',
  ordered: 'bg-amber-100 text-amber-700',
  delivered: 'bg-slate-200 text-slate-600',
  rejected: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

function StatusPill({ status }: { status: POStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function OrdersTable({
  title,
  orders,
  onApprove,
  onReject,
  emptyText,
}: {
  title: string;
  orders: PurchaseOrder[];
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  emptyText: string;
}) {
  const showActions = Boolean(onApprove || onReject);
  return (
    <div>
      <div className="px-5 pt-4 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="px-5 py-2 font-medium">Material</th>
              <th className="px-5 py-2 font-medium">Vendor</th>
              <th className="px-5 py-2 text-right font-medium">Qty</th>
              <th className="px-5 py-2 text-right font-medium">Total</th>
              <th className="px-5 py-2 text-right font-medium">ETA</th>
              <th className="px-5 py-2 font-medium">Why</th>
              <th className="px-5 py-2 text-right font-medium">{showActions ? 'Action' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => (
              <tr key={o.id} className="align-top hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{o.material_name}</td>
                <td className="px-5 py-3 text-slate-600">{o.vendor_name}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap text-slate-700">{fmtNum(o.quantity)}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap text-slate-700">{fmtMoney(o.total_price)}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap text-slate-600">{o.eta_days}d</td>
                <td className="max-w-xs px-5 py-3 text-xs text-slate-500">{o.rationale}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {showActions ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onApprove?.(o.id)}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject?.(o.id)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <StatusPill status={o.status} />
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProcurementPanel({
  siteId,
  onChange,
}: {
  siteId?: number | null;
  onChange?: () => void;
}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [running, setRunning] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    if (siteId == null) return;
    api
      .get<PurchaseOrder[]>('/procurement/orders', { params: { site_id: siteId } })
      .then((r) => setOrders(r.data));
  }
  useEffect(load, [siteId]);

  async function run() {
    if (siteId == null) return;
    setRunning(true);
    setError('');
    setMessage('');
    try {
      const r = await api.post('/procurement/run', null, { params: { site_id: siteId } });
      setMessage(r.data.message);
      load();
      onChange?.();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setRunning(false);
    }
  }

  async function draftAi() {
    if (siteId == null) return;
    setDrafting(true);
    setError('');
    setMessage('');
    try {
      const r = await api.post<PurchaseOrder[]>('/ai/draft-orders', null, {
        params: { site_id: siteId },
      });
      setMessage(
        r.data.length
          ? `AI drafted ${r.data.length} order(s) for your approval.`
          : 'AI found nothing that needs ordering right now.',
      );
      load();
      onChange?.();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setDrafting(false);
    }
  }

  async function act(id: number, action: 'approve' | 'reject') {
    try {
      await api.post(`/procurement/orders/${id}/${action}`);
      load();
      onChange?.();
    } catch (e) {
      setError(apiError(e));
    }
  }

  const suggested = orders.filter((o) => o.status === 'suggested');
  const others = orders.filter((o) => o.status !== 'suggested');

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div>
          <span className="text-sm font-semibold text-slate-700">Auto-procurement</span>
          <p className="text-xs text-slate-400">
            Scores vendors by price vs. ETA vs. urgency, then allocates orders to refill stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={draftAi} disabled={drafting || running}>
            {drafting ? (
              'Drafting…'
            ) : (
              <>
                <Icon name="sparkles" className="h-4 w-4" /> AI draft orders
              </>
            )}
          </Button>
          <Button onClick={run} disabled={running || drafting}>
            {running ? (
              'Running…'
            ) : (
              <>
                <Icon name="bolt" className="h-4 w-4" /> Run auto-procurement
              </>
            )}
          </Button>
        </div>
      </div>

      {(message || error) && (
        <div className="space-y-2 px-5 pt-3">
          {message && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
          )}
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        </div>
      )}

      <OrdersTable
        title="Suggested — awaiting your approval"
        orders={suggested}
        onApprove={(id) => act(id, 'approve')}
        onReject={(id) => act(id, 'reject')}
        emptyText="No pending suggestions. Click “Run auto-procurement”."
      />

      {others.length > 0 && <OrdersTable title="Decided & in progress" orders={others} emptyText="" />}
    </Card>
  );
}
