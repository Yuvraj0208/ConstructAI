import { useEffect, useState, type FormEvent } from 'react';
import { api, apiError } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Button, ErrorText, inputClass, labelClass, OkText, PageTitle } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import type { Material } from '../../types';

interface Line {
  materialId: number | '';
  quantity: string;
}

export default function RequestMaterials() {
  const { selectedSiteId } = useSite();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [lines, setLines] = useState<Line[]>([{ materialId: '', quantity: '' }]);
  const [neededFor, setNeededFor] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (selectedSiteId == null) return;
    api
      .get<Material[]>('/materials', { params: { site_id: selectedSiteId } })
      .then((r) => setMaterials(r.data));
  }, [selectedSiteId]);

  function update(i: number, patch: Partial<Line>) {
    setLines((l) => l.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (selectedSiteId == null) return;
    const items = lines
      .filter((l) => l.materialId !== '' && Number(l.quantity) > 0)
      .map((l) => ({ material_id: Number(l.materialId), quantity: Number(l.quantity) }));
    if (items.length === 0) {
      setError('Add at least one material with a quantity.');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.post('/engineering/material-requests', {
        site_id: selectedSiteId,
        needed_for: neededFor || undefined,
        note: note || undefined,
        items,
      });
      setOk('Request sent to the stock handler.');
      setLines([{ materialId: '', quantity: '' }]);
      setNeededFor('');
      setNote('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle title="Request materials" subtitle="The stock handler releases stock" />
      <form onSubmit={submit} className="space-y-4">
        <ErrorText>{error}</ErrorText>
        <OkText>{ok}</OkText>
        <div>
          <label className={labelClass}>Needed for (optional)</label>
          <input
            className={inputClass}
            value={neededFor}
            onChange={(e) => setNeededFor(e.target.value)}
            placeholder="e.g. Block A column casting"
          />
        </div>
        <div>
          <label className={labelClass}>Materials</label>
          <div className="space-y-2">
            {lines.map((ln, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className={`${inputClass} flex-1`}
                  value={ln.materialId}
                  onChange={(e) =>
                    update(i, { materialId: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                >
                  <option value="">Select…</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
                <input
                  className={`${inputClass} w-24`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  value={ln.quantity}
                  onChange={(e) => update(i, { quantity: e.target.value })}
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((l) => l.filter((_, idx) => idx !== i))}
                    className="shrink-0 p-2 text-slate-400"
                    aria-label="Remove"
                  >
                    <Icon name="x" className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines((l) => [...l, { materialId: '', quantity: '' }])}
            className="mt-2 text-sm font-semibold text-indigo-600"
          >
            + Add material
          </button>
        </div>
        <div>
          <label className={labelClass}>Note (optional)</label>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </Button>
      </form>
    </div>
  );
}
