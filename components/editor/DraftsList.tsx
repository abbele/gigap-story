'use client';

// SUPABASE: Lista bozze dell'autore corrente.
// Fetcha GET /api/stories?status=draft con header x-author-cookie-id.
// Permette di riaprire o eliminare le bozze esistenti.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Story } from '@/types/story';

interface DraftsListProps {
  /** AUTH: cookie anonimo dell'autore — passato come header x-author-cookie-id */
  authorCookieId: string;
  /** ID della storia attualmente aperta — evidenziata nella lista */
  currentStoryId: string | null;
  onClose: () => void;
}

/**
 * @description Pannello "Le mie bozze".
 * Carica le bozze dell'autore tramite API, mostra titolo e opera di riferimento.
 * Cliccando su una bozza si naviga all'editor con ?storyId=.
 * Il pulsante elimina chiama DELETE /api/stories/:id.
 *
 * @example
 * <DraftsList authorCookieId={cookieId} currentStoryId={storyId} onClose={closeDrafts} />
 *
 * @see components/editor/EditorShell.tsx
 * @see app/api/stories/route.ts
 */
export default function DraftsList({ authorCookieId, currentStoryId, onClose }: DraftsListProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // SUPABASE: carica bozze all'apertura del pannello
  useEffect(() => {
    setLoading(true);
    fetch('/api/stories?status=draft', {
      headers: { 'x-author-cookie-id': authorCookieId },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { stories: Story[] }) => setDrafts(data.stories))
      .catch((err) => console.error('[DraftsList] Errore fetch bozze:', err))
      .finally(() => setLoading(false));
  }, [authorCookieId]);

  // SUPABASE: elimina bozza tramite DELETE /api/stories/:id
  const handleDelete = useCallback(
    async (storyId: string) => {
      if (!confirm("Eliminare questa bozza? L'azione non è reversibile.")) return;
      setDeletingId(storyId);
      try {
        const res = await fetch(`/api/stories/${storyId}`, {
          method: 'DELETE',
          headers: { 'x-author-cookie-id': authorCookieId },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setDrafts((prev) => prev.filter((d) => d.id !== storyId));
      } catch (err) {
        console.error('[DraftsList] Errore eliminazione:', err);
      } finally {
        setDeletingId(null);
      }
    },
    [authorCookieId],
  );

  const handleOpen = useCallback(
    (story: Story) => {
      onClose();
      router.push(`/editor/${story.artwork.id}?storyId=${story.id}`);
    },
    [router, onClose],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#2a2a2a] block" aria-hidden />
          <span className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600">
            Le mie bozze
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-700 hover:text-zinc-400 font-mono text-xs transition-colors"
          aria-label="Chiudi pannello bozze"
        >
          ✕
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <p className="text-[10px] font-mono text-zinc-700 text-center py-4 animate-pulse">
            Caricamento…
          </p>
        )}

        {!loading && drafts.length === 0 && (
          <p className="text-[10px] font-mono text-zinc-700 text-center py-4">
            Nessuna bozza salvata
          </p>
        )}

        {!loading && drafts.length > 0 && (
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className={`border-2 transition-colors ${
                  draft.id === currentStoryId ? 'border-[#e8c832]' : 'border-[#2a2a2a]'
                }`}
              >
                <div className="flex items-stretch">
                  {/* Info + apri */}
                  <button
                    type="button"
                    onClick={() => handleOpen(draft)}
                    className="flex-1 px-3 py-2.5 text-left"
                    aria-label={`Riapri bozza: ${draft.title}`}
                  >
                    <p className="text-xs font-mono font-bold text-[#f0ede8] truncate leading-tight">
                      {draft.title || 'Senza titolo'}
                    </p>
                    <p className="text-[9px] font-mono text-zinc-600 truncate mt-0.5">
                      {draft.artwork.title}
                    </p>
                    <p className="text-[8px] font-mono text-zinc-700 mt-0.5">
                      {draft.waypoints.length} waypoint ·{' '}
                      {new Date(draft.updatedAt).toLocaleDateString('it-IT')}
                    </p>
                  </button>

                  {/* Elimina */}
                  <button
                    type="button"
                    onClick={() => handleDelete(draft.id)}
                    disabled={deletingId === draft.id}
                    className="shrink-0 w-8 flex items-center justify-center border-l-2 border-[#2a2a2a] text-zinc-700 hover:text-red-500 disabled:opacity-40 transition-colors"
                    aria-label={`Elimina bozza: ${draft.title}`}
                  >
                    <span className="text-xs font-mono">{deletingId === draft.id ? '…' : '✕'}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
