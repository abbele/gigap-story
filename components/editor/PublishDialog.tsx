'use client';

// UX: Dialog di conferma pubblicazione storia.
// Valida titolo non vuoto e almeno 2 waypoint prima di mostrare il CTA.
// Dopo la pubblicazione mostra il link condivisibile con pulsante copia.

import { useCallback, useState } from 'react';
import type { Waypoint } from '@/types/story';

interface PublishDialogProps {
  title: string;
  waypoints: Waypoint[];
  /** Callback per aggiornare il titolo prima di pubblicare */
  onTitleChange: (title: string) => void;
  /** Chiama l'API di pubblicazione — restituisce l'ID della storia */
  onPublish: () => Promise<string>;
  onClose: () => void;
}

/**
 * @description Dialog modale di conferma pubblicazione.
 * Gestisce due stati: form di validazione → link post-pubblicazione.
 * La validazione avviene lato client (titolo + waypoint count) prima
 * di chiamare onPublish() che effettua il PUT all'API.
 *
 * @example
 * <PublishDialog
 *   title={title}
 *   waypoints={waypoints}
 *   onTitleChange={setTitle}
 *   onPublish={handlePublish}
 *   onClose={() => setPublishOpen(false)}
 * />
 *
 * @see components/editor/EditorShell.tsx
 */
export default function PublishDialog({
  title,
  waypoints,
  onTitleChange,
  onPublish,
  onClose,
}: PublishDialogProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Validazione lato client
  const titleTrimmed = title.trim();
  const hasTitle = titleTrimmed.length > 0;
  const hasEnoughWaypoints = waypoints.length >= 2;
  const canPublish = hasTitle && hasEnoughWaypoints;

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    setIsPublishing(true);
    setError(null);
    try {
      const id = await onPublish();
      setPublishedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la pubblicazione');
    } finally {
      setIsPublishing(false);
    }
  }, [canPublish, onPublish]);

  const storyUrl =
    typeof window !== 'undefined' && publishedId
      ? `${window.location.origin}/story/${publishedId}`
      : '';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(storyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silenzioso
    }
  }, [storyUrl]);

  return (
    // UX: overlay scuro con backdrop-blur per focus sul dialog
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label="Pubblica storia"
    >
      <div className="w-full max-w-md mx-4 bg-[#0a0a0a] border-2 border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#e8c832] block" aria-hidden />
            <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-zinc-400">
              {publishedId ? 'Storia pubblicata' : 'Pubblica storia'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 font-mono text-xs transition-colors"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          {publishedId ? (
            // ── Stato post-pubblicazione ──────────────────────────
            <div className="flex flex-col gap-4">
              <p className="text-xs font-mono text-zinc-400">
                La tua storia è ora pubblica. Condividila con questo link:
              </p>
              <div className="flex gap-0">
                <code className="flex-1 min-w-0 truncate border-2 border-[#2a2a2a] bg-[#111] px-3 py-2 text-[10px] font-mono text-zinc-400">
                  {storyUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 px-3 py-2 border-2 border-l-0 border-[#e8c832] bg-[#e8c832] text-black font-mono font-bold text-[9px] tracking-widest uppercase hover:bg-[#f0d040] transition-colors"
                >
                  {copied ? '✓' : '⧉'}
                </button>
              </div>
              <a
                href={`/story/${publishedId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 border-2 border-[#2a2a2a] text-zinc-500 hover:border-[#e8c832] hover:text-[#e8c832] font-mono text-[10px] tracking-[0.25em] uppercase transition-colors text-center block"
              >
                ↗ Apri storia
              </a>
            </div>
          ) : (
            // ── Form di conferma ──────────────────────────────────
            <div className="flex flex-col gap-4">
              {/* Titolo */}
              <div>
                <label
                  htmlFor="publish-title"
                  className="block text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600 mb-1.5"
                >
                  Titolo storia *
                </label>
                <input
                  id="publish-title"
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Es: La luce nel caos"
                  className="w-full border-2 border-[#2a2a2a] bg-[#111] py-2 px-3 text-sm text-[#f0ede8] font-mono placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                  aria-required="true"
                />
                {!hasTitle && (
                  <p className="mt-1 text-[9px] font-mono text-red-500/70">
                    Il titolo è obbligatorio
                  </p>
                )}
              </div>

              {/* Checklist validazione */}
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-[10px] font-mono">
                  <span
                    className={`w-1.5 h-1.5 block ${hasTitle ? 'bg-[#e8c832]' : 'bg-[#2a2a2a]'}`}
                    aria-hidden
                  />
                  <span className={hasTitle ? 'text-zinc-400' : 'text-zinc-600'}>
                    Titolo presente
                  </span>
                </li>
                <li className="flex items-center gap-2 text-[10px] font-mono">
                  <span
                    className={`w-1.5 h-1.5 block ${hasEnoughWaypoints ? 'bg-[#e8c832]' : 'bg-[#2a2a2a]'}`}
                    aria-hidden
                  />
                  <span className={hasEnoughWaypoints ? 'text-zinc-400' : 'text-zinc-600'}>
                    Almeno 2 waypoint ({waypoints.length} presenti)
                  </span>
                </li>
              </ul>

              {error && <p className="text-[10px] font-mono text-red-500">{error}</p>}

              {/* CTA */}
              <button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish || isPublishing}
                className="w-full py-3 bg-[#e8c832] text-black font-mono font-bold text-xs tracking-[0.25em] uppercase hover:bg-[#f0d040] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPublishing ? 'Pubblicazione…' : 'Pubblica storia'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
