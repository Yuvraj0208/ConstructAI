import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiError } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Button, ErrorText, inputClass, labelClass, OkText, PageTitle } from '../../lib/ui';
import type { Material, MovementType } from '../../types';

const TYPES: { value: MovementType; label: string }[] = [
  { value: 'consumption', label: 'Usage' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'adjustment', label: 'Adjust' },
];

export default function RecordMovement() {
  const { selectedSiteId } = useSite();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState<number | ''>('');
  const [type, setType] = useState<MovementType>('consumption');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (selectedSiteId == null) return;
    api.get<Material[]>('/materials', { params: { site_id: selectedSiteId } }).then((r) => {
      setMaterials(r.data);
      setMaterialId((cur) => (r.data.some((m) => m.id === cur) ? cur : (r.data[0]?.id ?? '')));
    });
  }, [selectedSiteId]);

  const unit = useMemo(
    () => materials.find((m) => m.id === materialId)?.unit ?? '',
    [materials, materialId],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (materialId === '') return;
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.post('/stock/movements', {
        material_id: materialId,
        movement_type: type,
        quantity: Number(qty),
        note: note || undefined,
      });
      setOk('Stock updated.');
      setQty('');
      setNote('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle title="Record movement" subtitle="Log usage, a delivery, or a correction" />
      <form onSubmit={submit} className="space-y-4">
        <ErrorText>{error}</ErrorText>
        <OkText>{ok}</OkText>
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
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  type === t.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>
            Quantity {unit && <span className="text-slate-400">({unit})</span>}
          </label>
          <input
            className={inputClass}
            type="number"
            inputMode="decimal"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={type === 'adjustment' ? 'e.g. -5 or 12' : 'e.g. 50'}
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
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Record movement'}
        </Button>
      </form>
    </div>
  );
}
