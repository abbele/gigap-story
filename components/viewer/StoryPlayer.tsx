'use client';

// UX: StoryPlayer — overlay di riproduzione sovrapposto al GigapixelViewer.
// Gestisce il playback tramite useStory, i controlli keyboard/touch,
// e la presentazione del testo del waypoint corrente.

import { useCallback, useEffect, useRef } from 'react';
import type { Story } from '@/types/story';
import type { ViewerRect } from '@/hooks/useViewer';
import type { Waypoint } from '@/types/story';
import { useStory } from '@/hooks/useStory';

interface StoryPlayerProps {
  story: Story;
  /** Da useViewer — naviga il viewer al viewport del waypoint */
  goToViewport: (rect: ViewerRect, duration?: number, transition?: Waypoint['transition']) => void;
  /** True quando OSD è pronto */
  isViewerReady: boolean;
  /** Callback opzionale per uscire dalla modalità player */
  onClose?: () => void;
}

/**
 * @description Overlay di riproduzione di una storia.
 * Si posiziona in `absolute inset-0` sopra il GigapixelViewer.
 * Gestisce: dots di progresso (top), testo del waypoint + controlli (bottom),
 * navigazione keyboard (← → Space Esc) e swipe touch.
 *
 * @example
 * // Nel parent che chiama useViewer:
 * <div className="relative w-full h-full">
 *   <GigapixelViewer containerRef={containerRef} isReady={isReady} />
 *   <StoryPlayer story={story} goToViewport={goToViewport} isViewerReady={isReady} />
 * </div>
 *
 * @see hooks/useStory.ts
 * @see hooks/useViewer.ts
 */
export default function StoryPlayer({
  story,
  goToViewport,
  isViewerReady,
  onClose,
}: StoryPlayerProps) {
  const { waypoints } = story;

  const { currentWaypointIndex, isPlaying, next, prev, play, pause, goToWaypoint } = useStory({
    waypoints,
    goToViewport,
    isViewerReady,
  });

  // UX: touch — rileva swipe orizzontale per navigare tra waypoint
  const touchStartX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(delta) < 50) return; // soglia minima per swipe intenzionale
      if (delta > 0)
        prev(); // swipe destra → waypoint precedente
      else next(); // swipe sinistra → waypoint successivo
    },
    [next, prev],
  );

  // UX: keyboard — ← → per navigare, Space per play/pause, Esc per uscire
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === ' ') {
        e.preventDefault();
        if (isPlaying) pause();
        else play();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, play, pause, isPlaying, onClose]);

  if (waypoints.length === 0) return null;

  const currentWaypoint = waypoints[currentWaypointIndex];

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Progress dots — in alto al centro */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto">
        {waypoints.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToWaypoint(i)}
            aria-label={`Waypoint ${i + 1}`}
            className={`transition-all duration-200 ${
              i === currentWaypointIndex
                ? 'w-6 h-2 bg-[#e8c832]'
                : 'w-2 h-2 bg-zinc-600 hover:bg-zinc-400'
            }`}
          />
        ))}
      </div>

      {/* Pannello inferiore: testo + controlli */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-auto">
        {/* Gradiente di transizione sopra il pannello */}
        <div className="h-24 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Pannello contenuto */}
        <div className="bg-black/90 border-t-2 border-[#e8c832] px-6 py-4">
          {/* Indicatore waypoint corrente */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-[#e8c832] block shrink-0" />
            <span className="text-[9px] font-mono tracking-[0.35em] uppercase text-zinc-500">
              {currentWaypointIndex + 1} / {waypoints.length}
            </span>
          </div>

          {/* UX: testo HTML da Tiptap — il contenuto proviene dal nostro editor,
              non da input utente grezzo, quindi dangerouslySetInnerHTML è accettabile.
              La pagina di fruizione è in sola lettura.
              aria-live="polite" notifica il testo ai lettori di schermo al cambio waypoint. */}
          {currentWaypoint.text && (
            <div
              className="text-sm text-[#f0ede8] font-sans leading-relaxed max-h-32 overflow-y-auto mb-4
                         prose prose-invert prose-sm max-w-none
                         prose-p:my-1 prose-strong:text-[#e8c832] prose-em:text-zinc-300"
              dangerouslySetInnerHTML={{ __html: currentWaypoint.text }}
              aria-live="polite"
              aria-atomic="true"
              role="region"
              aria-label={`Testo waypoint ${currentWaypointIndex + 1}`}
            />
          )}

          {/* Controlli */}
          <div className="flex items-center gap-3">
            {/* Prev */}
            <button
              type="button"
              onClick={prev}
              disabled={currentWaypointIndex === 0}
              className="px-3 py-1.5 border-2 border-[#2a2a2a] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed font-mono text-xs tracking-widest uppercase transition-colors"
              aria-label="Waypoint precedente"
            >
              ←
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              onClick={isPlaying ? pause : play}
              className="px-4 py-1.5 bg-[#e8c832] text-black font-mono font-bold text-xs tracking-widest uppercase hover:bg-[#f0d040] transition-colors"
              aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
            >
              {isPlaying ? 'PAUSA' : 'PLAY'}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={next}
              disabled={currentWaypointIndex === waypoints.length - 1}
              className="px-3 py-1.5 border-2 border-[#2a2a2a] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed font-mono text-xs tracking-widest uppercase transition-colors"
              aria-label="Waypoint successivo"
            >
              →
            </button>

            {/* Chiudi (opzionale) */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="ml-auto px-3 py-1.5 border-2 border-[#2a2a2a] text-zinc-600 hover:border-zinc-500 hover:text-zinc-300 font-mono text-xs tracking-widest uppercase transition-colors"
                aria-label="Chiudi player"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
