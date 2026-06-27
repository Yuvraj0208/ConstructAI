import { useState, type FormEvent } from 'react';
import { api, apiError } from '../../api/client';
import { useSite } from '../../site/SiteContext';
import { Button, ErrorText, inputClass, labelClass, OkText, PageTitle } from '../../lib/ui';

export default function DailyUpdate() {
  const { selectedSiteId } = useSite();
  const [progress, setProgress] = useState('');
  const [labor, setLabor] = useState('');
  const [summary, setSummary] = useState('');
  const [issues, setIssues] = useState('');
  const [weather, setWeather] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (selectedSiteId == null) return;
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.post('/engineering/daily-updates', {
        site_id: selectedSiteId,
        progress_percent: Number(progress),
        summary,
        labor_count: Number(labor || 0),
        issues: issues || undefined,
        weather_impact: weather || undefined,
      });
      setOk('Update sent to the manager.');
      setSummary('');
      setIssues('');
      setWeather('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle title="Daily update" subtitle="Sent straight to the manager" />
      <form onSubmit={submit} className="space-y-4">
        <ErrorText>{error}</ErrorText>
        <OkText>{ok}</OkText>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Progress %</label>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Workers</label>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min="0"
              value={labor}
              onChange={(e) => setLabor(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Work summary</label>
          <textarea
            className={`${inputClass} min-h-[90px]`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What was done today"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Blockers (optional)</label>
          <input
            className={inputClass}
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            placeholder="e.g. waiting on steel delivery"
          />
        </div>
        <div>
          <label className={labelClass}>Weather impact (optional)</label>
          <input
            className={inputClass}
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="e.g. rain stopped concreting at noon"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send daily update'}
        </Button>
      </form>
    </div>
  );
}
