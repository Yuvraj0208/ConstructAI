import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useMaterials } from '../../hooks/useMaterials';
import { Layout } from '../../components/Layout';
import { Button, Card, ErrorText, fmtNum, inputClass, labelClass, Spinner, StatusBadge } from '../../components/ui';
import type { Movement, MovementType, PurchaseOrder } from '../../types';

const MOVEMENT_OPTIONS: { value: MovementType; label: string; hint: string }[] = [
  { value: 'consumption', label: 'Usage (out)', hint: 'Material used on site' },
  { value: 'delivery', label: 'Delivery (in)', hint: 'Stock received from a vendor' },
  { value: 'adjustment', label: 'Adjustment', hint: 'Manual correction (+/-)' },
];

export default function StockDashboard() {
  const { user } = useAuth();
  const { industries, industryId, setIndustryId, materials, loading, reload } = useMaterials(
    user?.industry_id ?? null,
  );

  const [materialId, setMaterialId] = useState<number | ''>('');
  const [movementType, setMovementType] = useState<MovementType>('consumption');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [incoming, setIncoming] = useState<PurchaseOrder[]>([]);

  const materialName = useMemo(() => {
    const map = new Map(materials.map((m) => [m.id, m.name]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [materials]);

  function loadMovements() {
    api.get<Movement[]>('/stock/movements', { params: { limit: 15 } }).then((res) => setMovements(res.data));
  }

  useEffect(loadMovements, []);

  function loadIncoming() {
    api.get<PurchaseOrder[]>('/procurement/orders').then((res) => setIncoming(res.data));
  }
  useEffect(loadIncoming, []);

  async function receive(id: number) {
    await api.post(`/procurement/orders/${id}/receive`);
    await reload();
    loadMovements();
    loadIncoming();
  }

  // Default the form's material to the first one once materials load.
  useEffect(() => {
    if (materialId === '' && materials.length) setMaterialId(materials[0].id);
  }, [materials, materialId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (materialId === '') return;
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      await api.post('/stock/movements', {
        material_id: materialId,
        movement_type: movementType,
        quantity: Number(quantity),
        note: note || undefined,
      });
      setOkMsg('Stock updated.');
      setQuantity('');
      setNote('');
      await reload();
      loadMovements();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout
      title="Stock Control"
      subtitle="Track material levels and record usage or deliveries"
      actions={
        <select
          className={`${inputClass} w-48`}
          value={industryId ?? ''}
          onChange={(e) => setIndustryId(Number(e.target.value))}
        >
          {industries.map((ind) => (
            <option key={ind.id} value={ind.id}>
              {ind.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Materials table */}
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Materials
          </div>
          {loading ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th className="px-5 py-2 font-medium">Material</th>
                    <th className="px-5 py-2 text-right font-medium">In stock</th>
                    <th className="px-5 py-2 text-right font-medium">Threshold</th>
                    <th className="px-5 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{m.name}</td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {fmtNum(m.current_stock)} <span className="text-slate-400">{m.unit}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">{fmtNum(m.threshold)}</td>
                      <td className="px-5 py-3 text-center">
                        <StatusBadge status={m.status} />
                      </td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                        No materials yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Record movement */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700">Record a movement</h2>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <ErrorText>{error}</ErrorText>
            {okMsg && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {okMsg}
              </div>
            )}
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
              <label className={labelClass}>Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {MOVEMENT_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setMovementType(opt.value)}
                    title={opt.hint}
                    className={`rounded-lg border px-1 py-1.5 text-xs font-semibold transition ${
                      movementType === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {MOVEMENT_OPTIONS.find((o) => o.value === movementType)?.hint}
              </p>
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input
                type="number"
                step="any"
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={movementType === 'adjustment' ? 'e.g. -5 or 12' : 'e.g. 50'}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Note (optional)</label>
              <input
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Foundation pour, Block B"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Saving…' : 'Record movement'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Incoming deliveries to receive into stock */}
      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
          Incoming deliveries{' '}
          <span className="text-xs font-normal text-slate-400">
            — approved orders, ready to receive into stock
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2 font-medium">Material</th>
                <th className="px-5 py-2 font-medium">Vendor</th>
                <th className="px-5 py-2 text-right font-medium">Qty</th>
                <th className="px-5 py-2 text-right font-medium">ETA</th>
                <th className="px-5 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incoming.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{o.material_name}</td>
                  <td className="px-5 py-3 text-slate-600">{o.vendor_name}</td>
                  <td className="px-5 py-3 text-right text-slate-700">
                    {fmtNum(o.quantity)}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">{o.eta_days}d</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => receive(o.id)}
                      className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Receive
                    </button>
                  </td>
                </tr>
              ))}
              {incoming.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No deliveries waiting. Orders the manager approves appear here to receive.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent activity */}
      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
          Recent activity
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-5 py-2 font-medium">Material</th>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 text-right font-medium">Change</th>
                <th className="px-5 py-2 text-right font-medium">Balance</th>
                <th className="px-5 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((mv) => (
                <tr key={mv.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">
                    {new Date(mv.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-2.5 font-medium text-slate-700">{materialName(mv.material_id)}</td>
                  <td className="px-5 py-2.5 capitalize text-slate-500">{mv.movement_type}</td>
                  <td
                    className={`px-5 py-2.5 text-right font-medium ${
                      mv.quantity < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {mv.quantity > 0 ? '+' : ''}
                    {fmtNum(mv.quantity)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{fmtNum(mv.balance_after)}</td>
                  <td className="px-5 py-2.5 text-slate-400">{mv.note ?? '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No activity yet.
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
