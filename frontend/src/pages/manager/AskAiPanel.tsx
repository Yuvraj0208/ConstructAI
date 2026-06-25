import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import { Card, ErrorText, inputClass } from '../../components/ui';
import { Icon } from '../../components/icons';
import type { AiStatus, AskResponse } from '../../types';

const EXAMPLES = [
  'What should I order?',
  'Why did cement usage spike?',
  'Are we on budget?',
  'Will the weather affect us?',
];

export function AskAiPanel({ siteId }: { siteId: number | null }) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<AiStatus>('/ai/status').then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  async function ask(q: string) {
    if (siteId == null || !q.trim()) return;
    setLoading(true);
    setError('');
    setAnswer(null);
    try {
      const res = await api.post<AskResponse>('/ai/ask', { site_id: siteId, question: q.trim() });
      setAnswer(res.data);
    } catch {
      setError('Could not reach the assistant. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow">
            <Icon name="sparkles" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Ask ConstructAI</h2>
            <p className="text-xs text-slate-400">Grounded in this site's live data</p>
          </div>
        </div>
        {status && (
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

      <form onSubmit={onSubmit} className="mt-4 flex items-center gap-2">
        <input
          className={inputClass}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about stock, orders, budget, weather, progress…"
        />
        <button
          type="submit"
          disabled={loading || siteId == null}
          aria-label="Ask"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2.5 text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Icon name="send" className="h-4 w-4" />
          )}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
            className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>

      {answer && (
        <div className="animate-fade-up mt-1 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{answer.answer}</p>
          {answer.sources.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Sources</span>
              {answer.sources.map((s) => (
                <span
                  key={s.label}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200"
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
