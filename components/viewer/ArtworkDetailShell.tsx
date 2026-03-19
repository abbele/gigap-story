'use client';

// UX: Shell della pagina dettaglio opera.
// Coordina il viewer IIIF (useViewer), il layout split/fullscreen,
// i metadati dell'opera, il form IIIF custom e la CTA per creare una storia.

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UnifiedArtwork } from '@/types/museum';
import { useViewer } from '@/hooks/useViewer';
import { useAnonymousAuthor } from '@/hooks/useAnonymousAuthor';
import GigapixelViewer from './GigapixelViewer';

interface ArtworkDetailShellProps {
  artwork: UnifiedArtwork;
}

/**
 * @description Shell della pagina dettaglio opera.
 * Layout: viewer 2/3 | sidebar 1/3 su desktop, stacked su mobile.
 * Il pulsante "Espandi" porta il viewer in modalità fullscreen (fixed inset-0).
 * Include un form per aggiungere una sorgente IIIF esterna al posto di quella del museo.
 *
 * @example
 * // Usato in app/artwork/[id]/page.tsx:
 * <ArtworkDetailShell artwork={artwork} />
 *
 * @see hooks/useViewer.ts
 * @see hooks/useAnonymousAuthor.ts
 */
export default function ArtworkDetailShell({ artwork }: ArtworkDetailShellProps) {
  const router = useRouter();
  const { cookieId } = useAnonymousAuthor();

  // IIIF: sorgente attiva — di default quella del museo, sovrascrivibile con input custom
  const [activeIiifUrl, setActiveIiifUrl] = useState(artwork.iiifInfoUrl);

  const { containerRef, isReady, getCurrentViewport } = useViewer(activeIiifUrl);

  // UX: stato layout — fullscreen nasconde la sidebar
  const [isFullscreen, setIsFullscreen] = useState(false);

  // UX: form IIIF custom
  const [iiifInput, setIiifInput] = useState('');
  const [iiifValidating, setIiifValidating] = useState(false);
  const [iiifError, setIiifError] = useState<string | null>(null);
  const [iiifValidated, setIiifValidated] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // IIIF: valida l'URL inserito dall'utente controllando che sia un info.json valido
  const validateIiifUrl = useCallback(async () => {
    const url = iiifInput.trim();
    if (!url) return;

    setIiifValidating(true);
    setIiifError(null);
    setIiifValidated(false);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as Record<string, unknown>;
      // IIIF: verifica minima — il file deve avere contesto IIIF e dimensioni immagine
      const hasContext =
        typeof json['@context'] === 'string' && (json['@context'] as string).includes('iiif.io');
      const hasDimensions = 'width' in json && 'height' in json;

      if (!hasContext || !hasDimensions) {
        throw new Error('URL non valido: manca @context IIIF o width/height');
      }

      setActiveIiifUrl(url);
      setIiifValidated(true);
    } catch (err) {
      setIiifError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIiifValidating(false);
    }
  }, [iiifInput]);

  // UX: naviga all'editor passando l'ID composito dell'opera
  const handleCreaStoria = useCallback(() => {
    // AUTH: cookieId garantisce che l'autore sia identificato prima di creare la storia
    if (!cookieId) return;
    router.push(`/editor/${artwork.id}`);
  }, [router, artwork.id, cookieId]);

  // UX: naviga all'editor con la sorgente IIIF custom
  const handleCreaStoriaCustom = useCallback(() => {
    if (!cookieId || !iiifValidated) return;
    const encoded = encodeURIComponent(iiifInput.trim());
    router.push(`/editor/custom?iiif=${encoded}`);
  }, [router, cookieId, iiifValidated, iiifInput]);

  return (
    <div className="flex flex-col flex-1">
      {/* Barra top: breadcrumb + toggle fullscreen */}
      <div className="flex items-center justify-between px-4 py-3 md:px-8 border-b-2 border-[#2a2a2a]">
        <Link
          href="/"
          className="text-[10px] font-mono tracking-[0.3em] uppercase text-zinc-600 hover:text-[#e8c832] transition-colors flex items-center gap-2"
        >
          ← Gallery
        </Link>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="text-[10px] font-mono tracking-[0.3em] uppercase text-zinc-600 hover:text-[#e8c832] transition-colors"
          aria-label={isFullscreen ? 'Esci da fullscreen' : 'Espandi viewer'}
        >
          {isFullscreen ? '⊠ RIDUCI' : '⊡ ESPANDI'}
        </button>
      </div>

      {/* Layout principale */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ─── VIEWER ────────────────────────────────────────────────── */}
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-black'
              : 'lg:w-2/3 h-[55vw] lg:h-auto min-h-0 border-b-2 lg:border-b-0 lg:border-r-2 border-[#2a2a2a]'
          }
        >
          {/* UX: pulsante exit fullscreen sovrapposto al viewer */}
          {isFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-black/70 border-2 border-[#e8c832] text-[#e8c832] font-mono text-[10px] tracking-widest uppercase hover:bg-[#e8c832] hover:text-black transition-colors"
            >
              ✕ ESCI
            </button>
          )}

          <GigapixelViewer containerRef={containerRef} isReady={isReady} className="h-full" />
        </div>

        {/* ─── SIDEBAR ────────────────────────────────────────────────── */}
        {!isFullscreen && (
          <aside className="lg:w-1/3 overflow-y-auto flex flex-col">
            {/* Metadati opera */}
            <div className="px-6 py-6 border-b-2 border-[#2a2a2a]">
              {/* Museo badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-[#e8c832] block shrink-0" />
                <span className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-500">
                  {artwork.museum.shortName} — {artwork.museum.city}
                </span>
              </div>

              {/* Titolo */}
              <h1
                className="font-mono font-bold uppercase text-[#f0ede8] leading-tight mb-2"
                style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', letterSpacing: '-0.02em' }}
              >
                {artwork.title}
              </h1>

              {/* Artista + data */}
              <p className="text-sm text-zinc-400 font-mono mb-1">
                {artwork.artist}
                {artwork.date ? <span className="text-zinc-600"> · {artwork.date}</span> : null}
              </p>

              {/* Separatore */}
              <div className="mt-4 mb-4 h-0.5 bg-[#2a2a2a]" />

              {/* Dettagli tecnici */}
              <dl className="space-y-1.5">
                {artwork.medium && (
                  <div className="flex gap-3">
                    <dt className="text-[9px] font-mono tracking-widest uppercase text-zinc-600 w-20 shrink-0 pt-0.5">
                      Tecnica
                    </dt>
                    <dd className="text-xs text-zinc-400 font-mono">{artwork.medium}</dd>
                  </div>
                )}
                {artwork.dimensions && (
                  <div className="flex gap-3">
                    <dt className="text-[9px] font-mono tracking-widest uppercase text-zinc-600 w-20 shrink-0 pt-0.5">
                      Dimensioni
                    </dt>
                    <dd className="text-xs text-zinc-400 font-mono">{artwork.dimensions}</dd>
                  </div>
                )}
                {artwork.department && (
                  <div className="flex gap-3">
                    <dt className="text-[9px] font-mono tracking-widest uppercase text-zinc-600 w-20 shrink-0 pt-0.5">
                      Dipartimento
                    </dt>
                    <dd className="text-xs text-zinc-400 font-mono">{artwork.department}</dd>
                  </div>
                )}
              </dl>

              {/* Link sorgente museo */}
              <a
                href={artwork.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-[9px] font-mono tracking-[0.2em] uppercase text-zinc-600 hover:text-[#e8c832] transition-colors"
              >
                ↗ Scheda {artwork.museum.shortName}
              </a>
            </div>

            {/* CTA principale — crea storia */}
            <div className="px-6 py-5 border-b-2 border-[#2a2a2a]">
              <button
                type="button"
                onClick={handleCreaStoria}
                className="w-full py-3 bg-[#e8c832] text-black font-mono font-bold text-xs tracking-[0.25em] uppercase hover:bg-[#f0d040] transition-colors"
              >
                + Crea storia da quest&apos;opera
              </button>
            </div>

            {/* Viewport debug — solo dev, utile per catturare coordinate */}
            {process.env.NODE_ENV === 'development' && (
              <div className="px-6 py-3 border-b-2 border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={() => {
                    const vp = getCurrentViewport();
                    if (vp) console.log('[viewport]', JSON.stringify(vp, null, 2));
                  }}
                  className="text-[9px] font-mono tracking-widest uppercase text-zinc-700 hover:text-zinc-500 transition-colors"
                >
                  ⌘ Log viewport (dev)
                </button>
              </div>
            )}

            {/* IIIF: form sorgente custom */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-[#2a2a2a] block shrink-0" />
                <span className="text-[9px] font-mono tracking-[0.3em] uppercase text-zinc-600">
                  Sorgente IIIF custom
                </span>
              </div>
              <p className="text-[10px] text-zinc-700 font-mono mb-3 leading-relaxed">
                Hai un&apos;opera con endpoint IIIF? Incolla l&apos;URL del file{' '}
                <code className="text-zinc-600">info.json</code>.
              </p>

              {/* IIIF: input URL */}
              <div className="flex gap-0">
                <input
                  type="url"
                  value={iiifInput}
                  onChange={(e) => {
                    setIiifInput(e.target.value);
                    setIiifError(null);
                    setIiifValidated(false);
                  }}
                  placeholder="https://…/info.json"
                  className="flex-1 min-w-0 border-2 border-[#2a2a2a] bg-[#111] py-2 px-3 text-xs text-[#f0ede8] font-mono placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                  aria-label="URL info.json IIIF"
                />
                <button
                  type="button"
                  onClick={validateIiifUrl}
                  disabled={iiifValidating || !iiifInput.trim()}
                  className="px-3 py-2 border-2 border-l-0 border-[#2a2a2a] bg-[#111] text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[10px] tracking-widest uppercase transition-colors whitespace-nowrap"
                >
                  {iiifValidating ? '…' : 'Carica'}
                </button>
              </div>

              {/* Feedback validazione */}
              {iiifError && <p className="mt-2 text-[10px] font-mono text-red-500">{iiifError}</p>}
              {iiifValidated && (
                <div className="mt-3">
                  <p className="text-[10px] font-mono text-[#e8c832] mb-2">
                    ✓ Sorgente IIIF valida — viewer aggiornato
                  </p>
                  <button
                    type="button"
                    onClick={handleCreaStoriaCustom}
                    className="w-full py-2 border-2 border-[#e8c832] text-[#e8c832] font-mono font-bold text-[10px] tracking-[0.25em] uppercase hover:bg-[#e8c832] hover:text-black transition-colors"
                  >
                    + Crea storia da questa URL
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
