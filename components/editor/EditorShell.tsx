'use client';

// UX: Shell principale dell'editor autoriale.
// Coordina: viewer gigapixel (sinistra 60%), pannello waypoint (destra 40%),
// autosave, publicazione, lista bozze.
//
// Flusso:
//   1. Utente pan/zoom nel viewer
//   2. Clicca "Cattura vista" → crea waypoint con viewport + thumbnail
//   3. Clicca su una card → apre WaypointEditor
//   4. Autosave ogni 30s (markUnsaved a ogni modifica)
//   5. Pubblica → PublishDialog → link condivisibile

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { UnifiedArtwork } from '@/types/museum';
import type { Story, Waypoint } from '@/types/story';
import { useViewer } from '@/hooks/useViewer';
import { useAnonymousAuthor } from '@/hooks/useAnonymousAuthor';
import { useEditorAutosave } from '@/hooks/useEditorAutosave';
import GigapixelViewer from '@/components/viewer/GigapixelViewer';
import WaypointList from './WaypointList';
import WaypointEditor from './WaypointEditor';
import PublishDialog from './PublishDialog';
import DraftsList from './DraftsList';

interface EditorShellProps {
  artwork: UnifiedArtwork;
  /** Storia bozza esistente — undefined se si sta creando una storia nuova */
  initialStory?: Story | null;
}

/** Genera un UUID v4 semplice per gli ID dei waypoint */
function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/** Etichette per l'indicatore di stato salvataggio */
const SAVE_STATUS_LABELS: Record<string, string> = {
  unsaved: '● Non salvato',
  saving: '↺ Salvando…',
  saved: '✓ Salvato',
  error: '⚠ Errore salvataggio',
};

const SAVE_STATUS_COLORS: Record<string, string> = {
  unsaved: 'text-zinc-600',
  saving: 'text-zinc-500 animate-pulse',
  saved: 'text-[#e8c832]',
  error: 'text-red-500',
};

/**
 * @description Shell principale dell'editor autoriale.
 * Layout desktop: viewer 60% sinistra + pannello 40% destra.
 * Layout mobile: viewer sopra, pannello sotto con scroll.
 *
 * @example
 * // Usato in app/editor/[artworkId]/page.tsx:
 * <EditorShell artwork={artwork} initialStory={draft} />
 *
 * @see hooks/useEditorAutosave.ts
 * @see hooks/useViewer.ts
 * @see components/editor/WaypointList.tsx
 * @see components/editor/PublishDialog.tsx
 */
export default function EditorShell({ artwork, initialStory }: EditorShellProps) {
  const { cookieId, displayName } = useAnonymousAuthor();

  // IIIF: usa la sorgente dell'opera (o della bozza se diversa)
  const iiifUrl = initialStory?.imageSource ?? artwork.iiifInfoUrl;
  const { containerRef, isReady, goToViewport, getCurrentViewport, captureViewport } =
    useViewer(iiifUrl);

  // ── Stato storia ─────────────────────────────────────────────────
  const [title, setTitle] = useState(initialStory?.title ?? '');
  const [description, setDescription] = useState(initialStory?.description ?? '');
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialStory?.waypoints ?? []);
  const [activeWaypointId, setActiveWaypointId] = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────
  const [isPublishOpen, setPublishOpen] = useState(false);
  const [isDraftsOpen, setDraftsOpen] = useState(false);

  // ── Autosave ──────────────────────────────────────────────────────
  const { storyId, saveStatus, save, markUnsaved } = useEditorAutosave({
    initialStoryId: initialStory?.id,
    artwork,
    imageSource: iiifUrl,
    authorCookieId: cookieId,
  });

  // PERF: ref per accedere allo stato aggiornato nell'autosave timer
  const stateRef = useRef({ title, description, waypoints });
  useEffect(() => {
    stateRef.current = { title, description, waypoints };
  }, [title, description, waypoints]);

  // UX: autosave ogni 30s se ci sono modifiche non salvate
  useEffect(() => {
    const timer = setInterval(() => {
      if (stateRef.current.waypoints.length === 0) return; // niente da salvare
      const { title: t, description: d, waypoints: w } = stateRef.current;
      save({
        title: t,
        description: d,
        waypoints: w,
        authorDisplayName: displayName,
        coverThumbnail: w[0]?.thumbnailDataUrl,
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [save, displayName]);

  // ── Cattura viewport ──────────────────────────────────────────────
  const handleCaptureVista = useCallback(() => {
    const viewport = getCurrentViewport();
    if (!viewport) return;

    const thumbnailDataUrl = captureViewport() ?? undefined;

    const newWaypoint: Waypoint = {
      id: generateId(),
      viewport,
      text: '',
      duration: 5,
      transition: 'ease',
      thumbnailDataUrl,
    };

    setWaypoints((prev) => {
      const updated = [...prev, newWaypoint];
      markUnsaved();
      return updated;
    });
    // UX: apre subito il WaypointEditor sul nuovo waypoint
    setActiveWaypointId(newWaypoint.id);
  }, [getCurrentViewport, captureViewport, markUnsaved]);

  // ── Aggiorna viewport del waypoint attivo ─────────────────────────
  const handleCaptureViewportForActive = useCallback(() => {
    if (!activeWaypointId) return;
    const viewport = getCurrentViewport();
    if (!viewport) return;
    const thumbnailDataUrl = captureViewport() ?? undefined;

    setWaypoints((prev) =>
      prev.map((w) => (w.id === activeWaypointId ? { ...w, viewport, thumbnailDataUrl } : w)),
    );
    markUnsaved();
  }, [activeWaypointId, getCurrentViewport, captureViewport, markUnsaved]);

  // ── Update waypoint ────────────────────────────────────────────────
  const updateWaypoint = useCallback(
    (id: string, updates: Partial<Waypoint>) => {
      setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
      markUnsaved();
    },
    [markUnsaved],
  );

  // UX: naviga al waypoint selezionato nel viewer
  const handleSelectWaypoint = useCallback(
    (id: string) => {
      setActiveWaypointId(id);
      const waypoint = waypoints.find((w) => w.id === id);
      if (waypoint && isReady) {
        goToViewport(waypoint.viewport, 1.2, waypoint.transition);
      }
    },
    [waypoints, isReady, goToViewport],
  );

  // ── Salva manuale ─────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    save({
      title,
      description,
      waypoints,
      authorDisplayName: displayName,
      coverThumbnail: waypoints[0]?.thumbnailDataUrl,
    }).catch(() => {});
  }, [save, title, description, waypoints, displayName]);

  // ── Pubblica ──────────────────────────────────────────────────────
  const handlePublish = useCallback(async (): Promise<string> => {
    // AUTH: header x-author-cookie-id è gestito dall'API route
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-author-cookie-id': cookieId,
    };

    // Prima assicuriamoci che la storia esista
    let id = storyId;
    if (!id) {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers,
        body: JSON.stringify({ artwork, imageSource: iiifUrl }),
      });
      if (!res.ok) throw new Error(`Creazione bozza fallita: HTTP ${res.status}`);
      const created = (await res.json()) as { id: string };
      id = created.id;
    }

    // Pubblica con tutti i dati aggiornati
    const res = await fetch(`/api/stories/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        title,
        description,
        waypoints,
        status: 'published',
        authorDisplayName: displayName,
        coverThumbnail: waypoints[0]?.thumbnailDataUrl,
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error ?? `Pubblicazione fallita: HTTP ${res.status}`);
    }

    const published = (await res.json()) as { id: string };
    return published.id;
  }, [storyId, cookieId, artwork, iiifUrl, title, description, waypoints, displayName]);

  const activeWaypoint = waypoints.find((w) => w.id === activeWaypointId) ?? null;
  const activeWaypointIndex = waypoints.findIndex((w) => w.id === activeWaypointId);

  return (
    <>
      <div className="flex flex-col lg:flex-row h-full bg-[#080808] overflow-hidden">
        {/* ─── VIEWER ────────────────────────────────────────────── */}
        <div className="lg:w-[60%] h-[45vw] lg:h-full min-h-0 border-b-2 lg:border-b-0 lg:border-r-2 border-[#2a2a2a]">
          <GigapixelViewer containerRef={containerRef} isReady={isReady} className="h-full" />
        </div>

        {/* ─── PANNELLO ──────────────────────────────────────────── */}
        <div className="lg:w-[40%] flex flex-col min-h-0 overflow-hidden">
          {/* Top bar: breadcrumb + save status + salva */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[#2a2a2a] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href={`/artwork/${artwork.id}`}
                className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600 hover:text-[#e8c832] transition-colors shrink-0"
              >
                ← Opera
              </Link>
              <span className="text-zinc-700 font-mono text-[9px] shrink-0">|</span>
              <span className="text-[9px] font-mono text-zinc-600 truncate">{artwork.title}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2">
              {/* Indicatore stato */}
              <span
                className={`text-[8px] font-mono tracking-widest uppercase ${SAVE_STATUS_COLORS[saveStatus] ?? 'text-zinc-600'}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {SAVE_STATUS_LABELS[saveStatus]}
              </span>
              {/* Salva manuale */}
              <button
                type="button"
                onClick={handleSave}
                className="text-[9px] font-mono tracking-widest uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
                aria-label="Salva manualmente"
              >
                ↓ Salva
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Titolo storia */}
            <div className="px-4 py-3 border-b-2 border-[#2a2a2a]">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markUnsaved();
                }}
                placeholder="Titolo della storia…"
                className="w-full bg-transparent border-0 text-[#f0ede8] font-mono font-bold text-sm placeholder:text-zinc-700 focus:outline-none"
                aria-label="Titolo della storia"
              />
            </div>

            {/* Pulsante "Cattura vista" */}
            <div className="px-4 py-3 border-b-2 border-[#2a2a2a]">
              <button
                type="button"
                onClick={handleCaptureVista}
                disabled={!isReady}
                className="w-full py-2.5 bg-[#e8c832] text-black font-mono font-bold text-xs tracking-[0.25em] uppercase hover:bg-[#f0d040] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                + Cattura vista corrente
              </button>
              {!isReady && (
                <p className="mt-1.5 text-[9px] font-mono text-zinc-700 text-center">
                  Attendere il caricamento del viewer…
                </p>
              )}
            </div>

            {/* Lista waypoint o editor waypoint */}
            <div className="flex-1 px-4 py-4">
              {activeWaypoint ? (
                <WaypointEditor
                  waypoint={activeWaypoint}
                  index={activeWaypointIndex}
                  onChange={(updates) => updateWaypoint(activeWaypoint.id, updates)}
                  onCaptureViewport={handleCaptureViewportForActive}
                  onClose={() => setActiveWaypointId(null)}
                />
              ) : (
                <WaypointList
                  waypoints={waypoints}
                  activeWaypointId={activeWaypointId}
                  onReorder={(reordered) => {
                    setWaypoints(reordered);
                    markUnsaved();
                  }}
                  onSelect={handleSelectWaypoint}
                  onDelete={(id) => {
                    setWaypoints((prev) => prev.filter((w) => w.id !== id));
                    if (activeWaypointId === id) setActiveWaypointId(null);
                    markUnsaved();
                  }}
                />
              )}
            </div>

            {/* Footer: bozze + pubblica */}
            <div className="px-4 py-4 border-t-2 border-[#2a2a2a] shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftsOpen(true)}
                className="flex-1 py-2 border-2 border-[#2a2a2a] text-zinc-600 hover:border-zinc-500 hover:text-zinc-400 font-mono text-[9px] tracking-widest uppercase transition-colors"
              >
                Le mie bozze
              </button>
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="flex-1 py-2 bg-[#e8c832] text-black font-mono font-bold text-[9px] tracking-widest uppercase hover:bg-[#f0d040] transition-colors"
              >
                Pubblica
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── DIALOGS ──────────────────────────────────────────────── */}
      {isPublishOpen && (
        <PublishDialog
          title={title}
          waypoints={waypoints}
          onTitleChange={(t) => {
            setTitle(t);
            markUnsaved();
          }}
          onPublish={handlePublish}
          onClose={() => setPublishOpen(false)}
        />
      )}

      {/* UX: pannello bozze come overlay laterale su mobile */}
      {isDraftsOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="flex-1 bg-black/60" onClick={() => setDraftsOpen(false)} aria-hidden />
          <div className="w-80 max-w-full h-full bg-[#0a0a0a] border-l-2 border-[#2a2a2a] overflow-hidden flex flex-col">
            <DraftsList
              authorCookieId={cookieId}
              currentStoryId={storyId}
              onClose={() => setDraftsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
