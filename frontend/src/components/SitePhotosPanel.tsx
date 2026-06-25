import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../api/client';
import { Button, Card, ErrorText, fmtNum, inputClass, Spinner } from './ui';
import { Icon } from './icons';
import type { AiStatus, SiteImageReport, SiteImageReportDetail } from '../types';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  on_track: { label: 'On track', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  needs_attention: { label: 'Needs attention', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  blocked: { label: 'Blocked', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  pending: { label: 'Analysis pending', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

/** Lazily fetches a single report's image (kept out of the list payload). */
function Thumb({ reportId }: { reportId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<SiteImageReportDetail>(`/engineering/site-photos/${reportId}`)
      .then((r) => {
        if (alive) setUrl(r.data.image_data_url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [reportId]);
  return (
    <div className="aspect-video w-full overflow-hidden bg-slate-100">
      {url ? (
        <img src={url} alt="Site photo" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-slate-300">
          <Spinner />
        </div>
      )}
    </div>
  );
}

function ReportCard({ r }: { r: SiteImageReport }) {
  const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <Thumb reportId={r.id} />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${st.cls}`}
          >
            {st.label}
          </span>
          {r.progress_estimate != null && (
            <span className="text-sm font-bold text-slate-800">{fmtNum(r.progress_estimate)}%</span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{r.summary}</p>
        {r.safety_flags.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
            <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{r.safety_flags.join(' · ')}</span>
          </div>
        )}
        {r.materials_visible.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {r.materials_visible.slice(0, 6).map((m) => (
              <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                {m}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 text-[11px] text-slate-400">
          {r.caption ? `${r.caption} · ` : ''}
          {r.author_name ?? 'Engineer'} · {new Date(r.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

export function SitePhotosPanel({
  siteId,
  canUpload = false,
}: {
  siteId: number | null;
  canUpload?: boolean;
}) {
  const [reports, setReports] = useState<SiteImageReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<AiStatus | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (siteId == null) return;
    setLoading(true);
    api
      .get<SiteImageReport[]>('/engineering/site-photos', { params: { site_id: siteId } })
      .then((r) => setReports(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => {
    if (canUpload) api.get<AiStatus>('/ai/status').then((r) => setStatus(r.data)).catch(() => {});
  }, [canUpload]);

  function reload() {
    if (siteId == null) return;
    api
      .get<SiteImageReport[]>('/engineering/site-photos', { params: { site_id: siteId } })
      .then((r) => setReports(r.data))
      .catch(() => {});
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError('');
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || siteId == null) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('site_id', String(siteId));
      if (caption) fd.append('caption', caption);
      await api.post('/engineering/site-photos', fd);
      setFile(null);
      setPreview(null);
      setCaption('');
      if (inputRef.current) inputRef.current.value = '';
      reload();
    } catch {
      setError('Upload failed — please try a smaller image (max 6 MB).');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow">
            <Icon name="sparkles" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Site photo {canUpload ? 'upload' : 'reports'}
            </h2>
            <p className="text-xs text-slate-400">
              {canUpload
                ? 'Upload a progress photo for an AI vision analysis'
                : 'AI vision progress & safety reports from the field'}
            </p>
          </div>
        </div>
        {canUpload && status && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
              status.enabled
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-slate-100 text-slate-500 ring-slate-200'
            }`}
            title={status.enabled ? `Live Claude (${status.model})` : 'Rule-based demo mode'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {status.enabled ? 'Live AI' : 'Demo'}
          </span>
        )}
      </div>

      {canUpload && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <ErrorText>{error}</ErrorText>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-600 hover:file:bg-indigo-100"
          />
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="max-h-48 rounded-xl border border-slate-200 object-cover"
            />
          )}
          <input
            className={inputClass}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional) — e.g. Block A, east elevation"
          />
          <Button type="submit" disabled={busy || !file}>
            {busy ? 'Analysing…' : 'Upload & analyse'}
          </Button>
        </form>
      )}

      <div className="mt-5">
        {loading && reports.length === 0 ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            No site photos yet.{canUpload ? ' Upload one above to get an AI report.' : ''}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {reports.map((r) => (
              <ReportCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
