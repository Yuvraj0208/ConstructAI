import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, apiError } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Button, Card, ErrorText, inputClass, labelClass, PageTitle } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import type { SiteImageReportDetail } from '../../types';

export default function PhotoCapture() {
  const { selectedSiteId } = useSite();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SiteImageReportDetail | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError('');
    setReport(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || selectedSiteId == null) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('site_id', String(selectedSiteId));
      if (caption) fd.append('caption', caption);
      const r = await api.post<SiteImageReportDetail>('/engineering/site-photos', fd);
      setReport(r.data);
      setFile(null);
      setPreview(null);
      setCaption('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle title="Site photo" subtitle="Snap a progress photo for AI analysis" />
      <form onSubmit={submit} className="space-y-4">
        <ErrorText>{error}</ErrorText>
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="w-full rounded-2xl border border-slate-200 object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-12 text-slate-400 active:bg-slate-50"
          >
            <Icon name="camera" className="h-10 w-10" />
            <span className="text-sm font-semibold">Take or choose a photo</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pick}
          className="hidden"
        />
        {preview && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm font-semibold text-indigo-600"
            >
              Retake / choose another
            </button>
            <div>
              <label className={labelClass}>Caption (optional)</label>
              <input
                className={inputClass}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Block A, east elevation"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Uploading…' : 'Upload & analyse'}
            </Button>
          </>
        )}
      </form>

      {report && (
        <Card className="mt-5 p-4">
          <div className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">AI report</div>
          <p className="mt-1 text-sm text-slate-700">{report.summary}</p>
          {report.safety_flags.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
              <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{report.safety_flags.join(' · ')}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">Sent to the manager.</p>
        </Card>
      )}
    </div>
  );
}
