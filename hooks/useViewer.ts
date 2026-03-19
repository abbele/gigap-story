'use client';

// IIIF: Hook per il controllo del viewer OpenSeadragon.
// Inizializza OSD in modo dinamico (browser-only) nel containerRef,
// espone metodi per navigare, leggere e catturare il viewport corrente.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Waypoint } from '@/types/story';

/** Coordinate del viewport nel sistema OSD (image width = 1.0) */
export interface ViewerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseViewerReturn {
  /** Ref da assegnare al div container del viewer */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** True dopo che OSD ha caricato e reso l'immagine */
  isReady: boolean;
  /** Naviga al rettangolo specificato con animazione OSD */
  goToViewport: (rect: ViewerRect, duration?: number, transition?: Waypoint['transition']) => void;
  /** Restituisce il viewport corrente in coordinate OSD */
  getCurrentViewport: () => ViewerRect | null;
  /** Cattura il canvas OSD come PNG base64 (per thumbnail waypoint) */
  captureViewport: () => string | null;
}

/**
 * @description Inizializza e controlla un'istanza OpenSeadragon.
 * L'import di OSD è dinamico (no SSR). Il `containerRef` restituito
 * deve essere assegnato al div container prima che OSD venga montato.
 *
 * La navigazione supporta transizioni a due step se il rapporto di zoom
 * tra posizione corrente e destinazione supera 3x.
 *
 * @param iiifInfoUrl URL del file info.json IIIF (es. "https://.../info.json")
 *
 * @example
 * const { containerRef, isReady, goToViewport } = useViewer(artwork.iiifInfoUrl);
 * return <GigapixelViewer containerRef={containerRef} isReady={isReady} />;
 *
 * @see components/viewer/GigapixelViewer.tsx
 */
export function useViewer(iiifInfoUrl: string): UseViewerReturn {
  const containerRef = useRef<HTMLDivElement>(null);

  // IIIF: viewer OSD — useRef per evitare re-render a ogni interazione
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);

  // IIIF: riferimento al modulo OSD per creare istanze Rect nella callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osdModuleRef = useRef<any>(null);

  const [isReady, setIsReady] = useState(false);

  // IIIF: inizializzazione OSD — dipende da iiifInfoUrl per ricaricare se cambia sorgente
  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: OpenSeadragon.Viewer | null = null;
    let destroyed = false;

    import('openseadragon').then((mod) => {
      if (destroyed || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const OSD = (mod.default ?? mod) as any;
      osdModuleRef.current = OSD;

      viewer = new OSD.Viewer({
        element: containerRef.current,
        tileSources: iiifInfoUrl,
        // UX: nessun controllo nativo — li gestiamo noi
        showNavigationControl: false,
        showZoomControl: false,
        showHomeControl: false,
        showFullPageControl: false,
        showRotationControl: false,
        showSequenceControl: false,
        // PERF: configurazione animazione — molla reattiva per transizioni fluide
        springStiffness: 12,
        animationTime: 1.0,
        visibilityRatio: 0.8,
        minZoomImageRatio: 0.3,
        maxZoomPixelRatio: 4,
        // UX: abilita gesture multi-touch su mobile
        gestureSettingsMouse: { clickToZoom: false },
        gestureSettingsTouch: { pinchRotate: false },
      }) as OpenSeadragon.Viewer;

      viewer.addHandler('open', () => {
        if (!destroyed) {
          viewerRef.current = viewer;
          setIsReady(true);
        }
      });

      // UX: segnala errore di caricamento senza crash
      viewer.addHandler('open-failed', () => {
        console.error('[useViewer] Fallito il caricamento della sorgente IIIF:', iiifInfoUrl);
      });
    });

    // PERF: ResizeObserver — OSD risponde ai cambi dimensione del container
    // (es. toggle fullscreen) senza dover gestire eventi window.resize
    const resizeObserver = new ResizeObserver(() => {
      viewerRef.current?.forceRedraw();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      destroyed = true;
      resizeObserver.disconnect();
      viewer?.destroy();
      viewerRef.current = null;
      setIsReady(false);
    };
  }, [iiifInfoUrl]);

  const goToViewport = useCallback(
    (rect: ViewerRect, duration = 1.2, transition: Waypoint['transition'] = 'ease') => {
      const viewer = viewerRef.current;
      const OSD = osdModuleRef.current;
      if (!viewer || !OSD) return;

      // IIIF: le coordinate del waypoint sono già in sistema viewport OSD
      const target = new OSD.Rect(rect.x, rect.y, rect.width, rect.height);

      const currentZoom = viewer.viewport.getZoom(true);
      const currentBounds = viewer.viewport.getBounds(true);

      // UX: calcola zoom approssimativo della destinazione per decidere la strategia
      const viewportWidth = viewer.viewport.getBounds(true).width;
      const targetZoom = viewportWidth / rect.width;
      const zoomRatio =
        Math.max(currentZoom, targetZoom) / Math.min(currentZoom, targetZoom || 0.001);

      if (zoomRatio > 3 && transition !== 'linear') {
        // UX: transizione a 2 step — zoom out sull'unione, poi zoom in sul target.
        // Evita il disorientamento quando la distanza o il cambio di scala è estremo.
        const OSDRect = OSD.Rect;
        const unionRect = new OSDRect(
          Math.min(currentBounds.x, rect.x),
          Math.min(currentBounds.y, rect.y),
          Math.max(currentBounds.x + currentBounds.width, rect.x + rect.width) -
            Math.min(currentBounds.x, rect.x),
          Math.max(currentBounds.y + currentBounds.height, rect.y + rect.height) -
            Math.min(currentBounds.y, rect.y),
        );
        viewer.viewport.fitBoundsWithConstraints(unionRect);

        // PERF: durata step 1 proporzionale al duration totale (mai oltre 1.5s)
        const step1Ms = Math.min(duration * 0.5 * 1000, 1500);
        setTimeout(() => {
          viewerRef.current?.viewport.fitBoundsWithConstraints(target);
        }, step1Ms);
      } else {
        // UX: 'linear' = immediato, tutti gli altri usano l'animazione spring di OSD
        const immediate = transition === 'linear';
        viewer.viewport.fitBoundsWithConstraints(target, immediate);
      }
    },
    [],
  );

  const getCurrentViewport = useCallback((): ViewerRect | null => {
    const viewer = viewerRef.current;
    if (!viewer) return null;
    const bounds = viewer.viewport.getBounds(true);
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }, []);

  const captureViewport = useCallback((): string | null => {
    const viewer = viewerRef.current;
    if (!viewer) return null;
    try {
      // IIIF: OSD renderizza su canvas — toDataURL cattura la vista corrente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = (viewer.drawer as any).canvas as HTMLCanvasElement | undefined;
      return canvas?.toDataURL('image/png') ?? null;
    } catch {
      return null;
    }
  }, []);

  return { containerRef, isReady, goToViewport, getCurrentViewport, captureViewport };
}
