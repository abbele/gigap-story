'use client';

// UX: Hook per la gestione della riproduzione di una storia.
// Tiene traccia dell'indice corrente, dello stato play/pause,
// e orchestra la navigazione automatica tra waypoint tramite goToViewport.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Waypoint } from '@/types/story';
import type { ViewerRect } from './useViewer';

interface UseStoryParams {
  waypoints: Waypoint[];
  /** Naviga il viewer al viewport del waypoint — da useViewer */
  goToViewport: (rect: ViewerRect, duration?: number, transition?: Waypoint['transition']) => void;
  /** True quando OSD ha finito di caricare l'immagine */
  isViewerReady: boolean;
}

interface UseStoryReturn {
  /** Indice del waypoint corrente (0-based) */
  currentWaypointIndex: number;
  /** True durante la riproduzione automatica */
  isPlaying: boolean;
  next: () => void;
  prev: () => void;
  play: () => void;
  pause: () => void;
  /** Salta direttamente a un waypoint specifico */
  goToWaypoint: (index: number) => void;
}

/**
 * @description Gestisce lo stato di riproduzione di una storia.
 * Quando `isPlaying`, avanza automaticamente al waypoint successivo
 * dopo `waypoints[currentIndex].duration` secondi.
 * Al cambio di indice naviga automaticamente al viewport del waypoint.
 *
 * @example
 * const { currentWaypointIndex, isPlaying, next, prev, play, pause } = useStory({
 *   waypoints: story.waypoints,
 *   goToViewport,
 *   isViewerReady,
 * });
 *
 * @see hooks/useViewer.ts
 * @see components/viewer/StoryPlayer.tsx
 */
export function useStory({
  waypoints,
  goToViewport,
  isViewerReady,
}: UseStoryParams): UseStoryReturn {
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Ref per il timer auto-avanzamento — evita chiusure stale
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref per l'indice corrente — usato nel callback del timer senza dipendenze stale.
  // Aggiornato in effect (non durante il render) per rispettare le regole dei ref.
  const indexRef = useRef(currentWaypointIndex);
  useEffect(() => {
    indexRef.current = currentWaypointIndex;
  }, [currentWaypointIndex]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // UX: naviga al viewport del waypoint corrente quando l'indice cambia
  // o quando il viewer diventa pronto (primo waypoint al caricamento)
  useEffect(() => {
    if (!isViewerReady || waypoints.length === 0) return;
    const wp = waypoints[currentWaypointIndex];
    if (!wp) return;
    goToViewport(wp.viewport, 1.2, wp.transition);
  }, [currentWaypointIndex, isViewerReady, waypoints, goToViewport]);

  // UX: auto-avanzamento durante la riproduzione
  useEffect(() => {
    clearTimer();
    if (!isPlaying || waypoints.length === 0) return;

    const wp = waypoints[currentWaypointIndex];
    if (!wp) return;

    timerRef.current = setTimeout(() => {
      const next = indexRef.current + 1;
      if (next < waypoints.length) {
        setCurrentWaypointIndex(next);
      } else {
        // UX: fine storia — si ferma sull'ultimo waypoint
        setIsPlaying(false);
      }
    }, wp.duration * 1000);

    return clearTimer;
  }, [isPlaying, currentWaypointIndex, waypoints, clearTimer]);

  // Pulizia al dismount
  useEffect(() => clearTimer, [clearTimer]);

  const next = useCallback(() => {
    clearTimer();
    setCurrentWaypointIndex((i) => Math.min(i + 1, waypoints.length - 1));
  }, [waypoints.length, clearTimer]);

  const prev = useCallback(() => {
    clearTimer();
    setCurrentWaypointIndex((i) => Math.max(i - 1, 0));
  }, [clearTimer]);

  const play = useCallback(() => {
    if (waypoints.length === 0) return;
    // UX: se è all'ultimo waypoint, ricomincia dall'inizio
    if (currentWaypointIndex === waypoints.length - 1) {
      setCurrentWaypointIndex(0);
    }
    setIsPlaying(true);
  }, [currentWaypointIndex, waypoints.length]);

  const pause = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
  }, [clearTimer]);

  const goToWaypoint = useCallback(
    (index: number) => {
      if (index < 0 || index >= waypoints.length) return;
      clearTimer();
      setIsPlaying(false);
      setCurrentWaypointIndex(index);
    },
    [waypoints.length, clearTimer],
  );

  return { currentWaypointIndex, isPlaying, next, prev, play, pause, goToWaypoint };
}
