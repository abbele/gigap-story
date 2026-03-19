'use client';

// IIIF: Componente container per il viewer OpenSeadragon.
// È deliberatamente "stupido": riceve containerRef e isReady dal parent (useViewer)
// e si limita a fornire il div dove OSD si monta + skeleton di attesa.

import type { RefObject } from 'react';

interface GigapixelViewerProps {
  /** Ref creato da useViewer — OSD si monta su questo elemento */
  containerRef: RefObject<HTMLDivElement | null>;
  /** True dopo che OSD ha caricato l'immagine — nasconde lo skeleton */
  isReady: boolean;
  /** Classe CSS aggiuntiva per il wrapper esterno */
  className?: string;
}

/**
 * @description Contenitore del viewer OpenSeadragon.
 * Non gestisce la logica del viewer — questa è responsabilità di `useViewer`.
 * Mostra uno skeleton Bauhaus durante il caricamento IIIF.
 *
 * @example
 * const { containerRef, isReady } = useViewer(artwork.iiifInfoUrl);
 * return <GigapixelViewer containerRef={containerRef} isReady={isReady} />;
 *
 * @see hooks/useViewer.ts
 */
export default function GigapixelViewer({
  containerRef,
  isReady,
  className = '',
}: GigapixelViewerProps) {
  return (
    <div className={`relative w-full h-full bg-[#050505] overflow-hidden ${className}`}>
      {/* UX: skeleton Bauhaus — griglia geometrica visibile fino al caricamento OSD */}
      {!isReady && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          {/* Griglia decorativa — evoca la struttura del deep zoom */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(#e8c832 1px, transparent 1px), linear-gradient(90deg, #e8c832 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
          <div className="relative flex flex-col items-center gap-4">
            {/* Quadrato animato — accento Bauhaus */}
            <div className="w-8 h-8 bg-[#e8c832] animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.4em] uppercase text-zinc-600">
              Caricamento
            </span>
          </div>
        </div>
      )}

      {/* IIIF: OSD si monta su questo div — deve essere sempre nel DOM */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
