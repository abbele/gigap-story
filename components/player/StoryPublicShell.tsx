'use client';

// UX: Shell pubblica di fruizione storia — layout fullscreen con viewer e player.
// Coordina useViewer (OSD), StoryPlayer (playback), top bar (titolo, condivisione)
// e il pannello share (copia link, X/Twitter, WhatsApp).

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { Story } from '@/types/story';
import { useViewer } from '@/hooks/useViewer';
import GigapixelViewer from '@/components/viewer/GigapixelViewer';
import StoryPlayer from '@/components/viewer/StoryPlayer';

interface StoryPublicShellProps {
  story: Story;
}

/**
 * @description Shell fullscreen per la fruizione pubblica di una storia.
 * Layout: viewer a tutto schermo con StoryPlayer in overlay.
 * Top bar: titolo storia + autore + pulsante condivisione.
 * Share panel: copia URL, link X/Twitter e WhatsApp (URL-based, no SDK).
 *
 * @example
 * // Usato in app/story/[id]/page.tsx:
 * <StoryPublicShell story={story} />
 *
 * @see hooks/useViewer.ts
 * @see components/viewer/StoryPlayer.tsx
 */
export default function StoryPublicShell({ story }: StoryPublicShellProps) {
  const { containerRef, isReady, goToViewport } = useViewer(story.imageSource);

  // UX: pannello share aperto/chiuso
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleShare = useCallback(() => setShareOpen((v) => !v), []);

  // UX: copia URL della storia negli appunti
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      // Ripristina l'etichetta dopo 2s
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silenzioso: il browser potrebbe bloccare clipboard fuori da gesture
    }
  }, []);

  // UX: URL encode per i link di condivisione — usa window.location.href lato client
  const storyUrl = typeof window !== 'undefined' ? window.location.href : '';
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(storyUrl)}&text=${encodeURIComponent(story.title)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${story.title} ${storyUrl}`)}`;

  return (
    // UX: h-[100dvh] usa dynamic viewport height — evita il problema con la barra URL mobile
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden">
      {/* ─── TOP BAR ─────────────────────────────────────────────── */}
      <div
        className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
      >
        {/* Sinistra: link indietro + titolo + autore */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/stories"
            className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-500 hover:text-[#e8c832] transition-colors shrink-0"
            aria-label="Torna alla lista storie"
          >
            ← Storie
          </Link>
          <span className="text-zinc-700 font-mono text-xs shrink-0" aria-hidden>
            |
          </span>
          <span className="text-xs font-mono text-zinc-300 truncate" title={story.title}>
            {story.title}
          </span>
          {story.authorDisplayName && (
            <span className="text-[9px] font-mono text-zinc-600 shrink-0 hidden sm:block">
              — {story.authorDisplayName}
            </span>
          )}
        </div>

        {/* Destra: pulsante condivisione */}
        <div className="relative shrink-0 ml-3">
          <button
            type="button"
            onClick={toggleShare}
            className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-500 hover:text-[#e8c832] transition-colors"
            aria-label="Apri opzioni di condivisione"
            aria-expanded={shareOpen}
          >
            ↗ CONDIVIDI
          </button>

          {/* Share panel */}
          {shareOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-44 bg-[#0a0a0a] border-2 border-[#2a2a2a] p-3 flex flex-col gap-2.5"
              role="dialog"
              aria-label="Opzioni di condivisione"
            >
              {/* Copia link */}
              <button
                type="button"
                onClick={handleCopy}
                className="text-left text-[10px] font-mono uppercase tracking-widest text-zinc-400 hover:text-[#e8c832] transition-colors"
              >
                {copied ? '✓ Copiato!' : '⧉ Copia link'}
              </button>

              {/* X / Twitter */}
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 hover:text-[#e8c832] transition-colors"
              >
                ↗ X / Twitter
              </a>

              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 hover:text-[#e8c832] transition-colors"
              >
                ↗ WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ─── VIEWER ──────────────────────────────────────────────── */}
      {/* IIIF: il viewer occupa l'intera area — StoryPlayer si posiziona sopra in absolute */}
      <GigapixelViewer containerRef={containerRef} isReady={isReady} className="w-full h-full" />

      {/* ─── STORY PLAYER ────────────────────────────────────────── */}
      {/* UX: relative wrapper necessario perché StoryPlayer usa absolute inset-0 */}
      <div className="absolute inset-0 pointer-events-none">
        <StoryPlayer story={story} goToViewport={goToViewport} isViewerReady={isReady} />
      </div>
    </div>
  );
}
