import { useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import { Card, inputClass } from '../../components/ui';
import { Icon } from '../../components/icons';
import type { NoteHit, NoteSearchResult } from '../../types';

export function NotesSearchPanel({ siteId }: { siteId: number | null }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<NoteHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (siteId == null || !q.trim()) return;
    setLoading(true);
    try {
      const r = await api.get<NoteSearchResult>('/ai/notes/search', {
        params: { site_id: siteId, q: q.trim() },
      });
      setHits(r.data.hits);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow">
          <Icon name="layers" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Search the site log</h2>
          <p className="text-xs text-slate-400">Daily updates, requests, order notes & photo reports</p>
        </div>
      </div>

      <form onSubmit={search} className="mt-4 flex items-center gap-2">
        <input
          className={inputClass}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. steel delivery, rain, Block B"
        />
        <button
          type="submit"
          disabled={loading || siteId == null}
          aria-label="Search"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2.5 text-white shadow-glow transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Icon name="arrowRight" className="h-4 w-4" />
          )}
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {hits == null ? null : hits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            No matching notes.
          </div>
        ) : (
          hits.map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-white/70 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                  {h.source}
                </span>
                {h.date && <span className="text-[11px] text-slate-400">{h.date}</span>}
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{h.text}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
