import { useEffect, useState, type FormEvent } from 'react';
import { api, apiError } from '../../api/client';
import { useMaterials } from '../../hooks/useMaterials';
import { Layout } from '../../components/Layout';
import { Button, Card, ErrorText, fmtMoney, fmtNum, inputClass, labelClass } from '../../components/ui';
import type { Offer, POStatus, PurchaseOrder } from '../../types';

const PO_PILL: Record<POStatus, string> = {
  suggested: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-emerald-100 text-emerald-700',
  ordered: 'bg-amber-100 text-amber-700',
  delivered: 'bg-slate-200 text-slate-600',
  rejected: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-400',
};

export default function VendorDashboard() {
  const { materials } = useMaterials();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [materialId, setMaterialId] = useState<number | ''>('');
  const [price, setPrice] = useState('');
  const [eta, setEta] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  function loadOffers() {
    api.get<Offer[]>('/vendors/offers').then((res) => setOffers(res.data));
  }
  useEffect(loadOffers, []);

  function loadOrders() {
    api.get<PurchaseOrder[]>('/procurement/orders').then((res) => setOrders(res.data));
  }
  useEffect(loadOrders, []);

  async function acceptOrder(id: number) {
    await api.post(`/procurement/orders/${id}/accept`);
    loadOrders();
  }

  useEffect(() => {
    if (!materials.some((m) => m.id === materialId)) {
      setMaterialId(materials[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (materialId === '') return;
    setBusy(true);
    setError('');
    try {
      await api.post('/vendors/offers', {
        material_id: materialId,
        price_per_unit: Number(price),
        eta_days: Number(eta),
        available_quantity: Number(qty),
      });
      setPrice('');
      setEta('');
      setQty('');
      loadOffers();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: number) {
    await api.delete(`/vendors/offers/${id}`);
    loadOffers();
  }

  return (
    <Layout title="Vendor Portal" subtitle="Post your price and delivery ETA — the engine ranks every offer">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* New offer */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700">Post an offer</h2>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <ErrorText>{error}</ErrorText>
            <div>
              <label className={labelClass}>Material</label>
              <select
                className={inputClass}
                value={materialId}
                onChange={(e) => setMaterialId(Number(e.target.value))}
                required
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Price per unit (₹)</label>
              <input
                type="number"
                step="any"
                min="0"
                className={inputClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>ETA (days)</label>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Available qty</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className={inputClass}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Posting…' : 'Post offer'}
            </Button>
          </form>
        </Card>

        {/* My offers */}
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            My offers
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-2 font-medium">Material</th>
                  <th className="px-5 py-2 text-right font-medium">Price</th>
                  <th className="px-5 py-2 text-right font-medium">ETA</th>
                  <th className="px-5 py-2 text-right font-medium">Qty</th>
                  <th className="px-5 py-2 text-center font-medium">Status</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{o.material_name}</td>
                    <td className="px-5 py-3 text-right text-slate-700">{fmtMoney(o.price_per_unit)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{o.eta_days}d</td>
                    <td className="px-5 py-3 text-right text-slate-600">{fmtNum(o.available_quantity)}</td>
                    <td className="px-5 py-3 text-center">
                      {o.is_active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          withdrawn
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {o.is_active && (
                        <button
                          onClick={() => withdraw(o.id)}
                          className="text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Withdraw
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {offers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No offers yet — post one to start winning orders.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Incoming orders won from this vendor's offers */}
      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
          Incoming orders{' '}
          <span className="text-xs font-normal text-slate-400">
            — approved by the manager from your offers
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2 font-medium">Material</th>
                <th className="px-5 py-2 text-right font-medium">Qty</th>
                <th className="px-5 py-2 text-right font-medium">Unit</th>
                <th className="px-5 py-2 text-right font-medium">Total</th>
                <th className="px-5 py-2 text-right font-medium">ETA</th>
                <th className="px-5 py-2 text-center font-medium">Status</th>
                <th className="px-5 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{o.material_name}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{fmtNum(o.quantity)}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{fmtMoney(o.price_per_unit)}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{fmtMoney(o.total_price)}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{o.eta_days}d</td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PO_PILL[o.status]}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {o.status === 'approved' && (
                      <button
                        onClick={() => acceptOrder(o.id)}
                        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        Accept
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No orders yet. When a manager approves an order from your offer, it appears here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
}
