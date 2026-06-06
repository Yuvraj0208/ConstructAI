import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Card, fmtNum } from '../../components/ui';
import type { ExpiryStatus, StockBatch } from '../../types';

const BADGE: Record<ExpiryStatus, string> = {
  expired: 'bg-rose-100 text-rose-700',
  expiring: 'bg-amber-100 text-amber-700',
  fresh: 'bg-emerald-100 text-emerald-700',
};

function relativeDays(days?: number | null): string {
  if (typeof days !== 'number') return '';
  if (days < 0) return `${-days}d ago`;
  if (days === 0) return 'today';
  return `in ${days}d`;
}

export function ExpiryPanel() {
  const [batches, setBatches] = useState<StockBatch[]>([]);

  useEffect(() => {
    api
      .get<StockBatch[]>('/stock/expiry')
      .then((r) => setBatches(r.data))
      .catch(() => {});
  }, []);

  if (batches.length === 0) return null; // nothing to warn about

  const expired = batches.filter((b) => b.expiry_status === 'expired').length;
  const expiring = batches.filter((b) => b.expiry_status === 'expiring').length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">⏳ Expiry alerts</h2>
        <span className="text-xs text-slate-400">
          {expired} expired · {expiring} expiring soon
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {batches.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium text-slate-800">{b.material_name}</span>
              <span className="text-slate-500">
                {' '}
                · {fmtNum(b.remaining_quantity)} {b.unit}
              </span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-xs text-slate-500">
                {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : ''} ({relativeDays(b.days_to_expiry)})
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${BADGE[b.expiry_status]}`}
              >
                {b.expiry_status}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Stock is consumed oldest-expiry-first (FIFO). Write off expired lots with a stock adjustment.
      </p>
    </Card>
  );
}
