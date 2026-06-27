import { useEffect, useState, type FormEvent } from 'react';
import { api, apiError } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { useMaterials } from '../../hooks/useMaterials';
import { Layout } from '../../components/Layout';
import { Button, Card, ErrorText, fmtNum, inputClass, labelClass, StatusBadge } from '../../components/ui';
import { Icon } from '../../components/icons';
import { SitePhotosPanel } from '../../components/SitePhotosPanel';
import { SchedulePanel } from '../../components/SchedulePanel';
import type { DailyUpdate, MaterialRequest, RequestStatus } from '../../types';

const REQ_PILL: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  issued: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-600',
};

interface RequestLine {
  materialId: number | '';
  quantity: string;
}

export default function SiteEngineerDashboard() {
  const { selectedSiteId, selectedSite } = useSite();
  const { materials } = useMaterials();

  // Daily-update form
  const [progress, setProgress] = useState('');
  const [summary, setSummary] = useState('');
  const [labor, setLabor] = useState('');
  const [issues, setIssues] = useState('');
  const [weather, setWeather] = useState('');
  const [updErr, setUpdErr] = useState('');
  const [updOk, setUpdOk] = useState('');
  const [updBusy, setUpdBusy] = useState(false);

  // Material-request form
  const [lines, setLines] = useState<RequestLine[]>([{ materialId: '', quantity: '' }]);
  const [neededFor, setNeededFor] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqErr, setReqErr] = useState('');
  const [reqOk, setReqOk] = useState('');
  const [reqBusy, setReqBusy] = useState(false);

  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);

  function loadUpdates() {
    if (selectedSiteId == null) return;
    api
      .get<DailyUpdate[]>('/engineering/daily-updates', { params: { site_id: selectedSiteId } })
      .then((r) => setUpdates(r.data));
  }
  function loadRequests() {
    if (selectedSiteId == null) return;
    api
      .get<MaterialRequest[]>('/engineering/material-requests', { params: { site_id: selectedSiteId } })
      .then((r) => setRequests(r.data));
  }
  useEffect(() => {
    loadUpdates();
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId]);

  async function submitUpdate(e: FormEvent) {
    e.preventDefault();
    if (selectedSiteId == null) return;
    setUpdBusy(true);
    setUpdErr('');
    setUpdOk('');
    try {
      await api.post('/engineering/daily-updates', {
        site_id: selectedSiteId,
        progress_percent: Number(progress),
        summary,
        labor_count: Number(labor || 0),
        issues: issues || undefined,
        weather_impact: weather || undefined,
      });
      setUpdOk('Update sent to the manager.');
      setSummary('');
      setIssues('');
      setWeather('');
      loadUpdates();
    } catch (err) {
      setUpdErr(apiError(err));
    } finally {
      setUpdBusy(false);
    }
  }

  function updateLine(i: number, patch: Partial<RequestLine>) {
    setLines((l) => l.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln)));
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    if (selectedSiteId == null) return;
    const items = lines
      .filter((l) => l.materialId !== '' && Number(l.quantity) > 0)
      .map((l) => ({ material_id: Number(l.materialId), quantity: Number(l.quantity) }));
    if (items.length === 0) {
      setReqErr('Add at least one material with a quantity.');
      return;
    }
    setReqBusy(true);
    setReqErr('');
    setReqOk('');
    try {
      await api.post('/engineering/material-requests', {
        site_id: selectedSiteId,
        needed_for: neededFor || undefined,
        note: reqNote || undefined,
        items,
      });
      setReqOk('Request sent to the stock handler.');
      setLines([{ materialId: '', quantity: '' }]);
      setNeededFor('');
      setReqNote('');
      loadRequests();
    } catch (err) {
      setReqErr(apiError(err));
    } finally {
      setReqBusy(false);
    }
  }

  return (
    <Layout
      title="Site Engineer"
      subtitle={
        selectedSite
          ? `Daily updates & material requests · ${selectedSite.name}`
          : 'Daily updates & material requests'
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily update */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700">Daily site update</h2>
          <p className="text-xs text-slate-400">Sent straight to the manager.</p>
          <form onSubmit={submitUpdate} className="mt-4 space-y-3">
            <ErrorText>{updErr}</ErrorText>
            {updOk && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {updOk}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Progress %</label>
                <input
                  type="number" min="0" max="100" className={inputClass}
                  value={progress} onChange={(e) => setProgress(e.target.value)} required
                />
              </div>
              <div>
                <label className={labelClass}>Workers on site</label>
                <input
                  type="number" min="0" className={inputClass}
                  value={labor} onChange={(e) => setLabor(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Work summary</label>
              <textarea
                className={`${inputClass} min-h-[70px]`} value={summary}
                onChange={(e) => setSummary(e.target.value)} required
                placeholder="What was done today"
              />
            </div>
            <div>
              <label className={labelClass}>Blockers / issues (optional)</label>
              <input
                className={inputClass} value={issues} onChange={(e) => setIssues(e.target.value)}
                placeholder="e.g. waiting on steel delivery"
              />
            </div>
            <div>
              <label className={labelClass}>Weather impact (optional)</label>
              <input
                className={inputClass} value={weather} onChange={(e) => setWeather(e.target.value)}
                placeholder="e.g. rain stopped concreting at noon"
              />
            </div>
            <Button type="submit" disabled={updBusy} className="w-full">
              {updBusy ? 'Sending…' : 'Send daily update'}
            </Button>
          </form>
        </Card>

        {/* Material request */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700">Request materials for today</h2>
          <p className="text-xs text-slate-400">The stock handler approves to release stock.</p>
          <form onSubmit={submitRequest} className="mt-4 space-y-3">
            <ErrorText>{reqErr}</ErrorText>
            {reqOk && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {reqOk}
              </div>
            )}
            <div>
              <label className={labelClass}>Needed for (optional)</label>
              <input
                className={inputClass} value={neededFor} onChange={(e) => setNeededFor(e.target.value)}
                placeholder="e.g. Block A column casting"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Materials</label>
              {lines.map((ln, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className={`${inputClass} flex-1`}
                    value={ln.materialId}
                    onChange={(e) =>
                      updateLine(i, { materialId: e.target.value === '' ? '' : Number(e.target.value) })
                    }
                  >
                    <option value="">Select material…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({fmtNum(m.available_stock)} {m.unit} avail)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number" min="0" step="any" className={`${inputClass} w-24`} placeholder="Qty"
                    value={ln.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((l) => l.filter((_, idx) => idx !== i))}
                      className="shrink-0 px-1 text-slate-400 hover:text-rose-500"
                      aria-label="Remove material"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLines((l) => [...l, { materialId: '', quantity: '' }])}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                + Add another material
              </button>
            </div>
            <div>
              <label className={labelClass}>Note (optional)</label>
              <input className={inputClass} value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={reqBusy} className="w-full">
              {reqBusy ? 'Sending…' : 'Send request'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Read-only site stock */}
      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
          Site stock <span className="text-xs font-normal text-slate-400">— available before you request</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2 font-medium">Material</th>
                <th className="px-5 py-2 text-right font-medium">Available</th>
                <th className="px-5 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{m.name}</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">
                    {fmtNum(m.available_stock)} <span className="text-slate-400">{m.unit}</span>
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* My requests */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            My material requests
          </div>
          <div className="divide-y divide-slate-100">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{r.needed_for || `Request #${r.id}`}</div>
                  <div className="truncate text-xs text-slate-500">
                    {r.items.map((i) => `${fmtNum(i.quantity)} ${i.unit ?? ''} ${i.material_name}`).join(' · ')}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${REQ_PILL[r.status]}`}>
                  {r.status}
                </span>
              </div>
            ))}
            {requests.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400">No requests yet.</div>
            )}
          </div>
        </Card>

        {/* My recent updates */}
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Recent daily updates
          </div>
          <div className="divide-y divide-slate-100">
            {updates.map((u) => (
              <div key={u.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-600">{fmtNum(u.progress_percent)}% complete</span>
                  <span className="text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()} · {u.labor_count} workers
                  </span>
                </div>
                <div className="mt-1 text-slate-700">{u.summary}</div>
                {u.issues && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                    <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
                    {u.issues}
                  </div>
                )}
              </div>
            ))}
            {updates.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400">No updates yet.</div>
            )}
          </div>
        </Card>
      </div>

      {/* Project schedule — see milestones and mark them done */}
      <div className="mt-6">
        <SchedulePanel siteId={selectedSiteId} />
      </div>

      {/* Site photo upload → AI vision report (sent to the manager) */}
      <div className="mt-6">
        <SitePhotosPanel siteId={selectedSiteId} canUpload />
      </div>
    </Layout>
  );
}
