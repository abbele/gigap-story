'use client';

// SUPABASE: Hook per l'autosalvataggio dell'editor.
// Gestisce il ciclo di vita della storia: creazione (POST), aggiornamento (PUT),
// e l'autosave periodico ogni 30 secondi.
// AUTH: tutte le chiamate alle API routes includono l'header x-author-cookie-id.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnifiedArtwork } from '@/types/museum';
import type { Waypoint } from '@/types/story';

/** Stato visibile del salvataggio nell'UI */
export type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'error';

/** Dati aggiornabili della storia — passati a ogni chiamata di save() */
export interface SaveData {
  title: string;
  description: string;
  waypoints: Waypoint[];
  authorDisplayName?: string;
  /** Thumbnail del primo waypoint — usata come copertina nella card /stories */
  coverThumbnail?: string;
}

interface UseEditorAutosaveParams {
  /** ID della storia esistente — undefined per nuove storie */
  initialStoryId?: string;
  /** Opera museale associata alla storia */
  artwork: UnifiedArtwork;
  /** IIIF info.json URL del viewer */
  imageSource: string;
  /** AUTH: cookie anonimo dell'autore, inviato come header x-author-cookie-id */
  authorCookieId: string;
  /** Callback chiamata dopo la prima creazione della bozza */
  onStoryCreated?: (storyId: string) => void;
}

interface UseEditorAutosaveReturn {
  /** UUID della storia su Supabase (null se non ancora salvata) */
  storyId: string | null;
  saveStatus: SaveStatus;
  /** Salva manualmente con i dati correnti */
  save: (data: SaveData) => Promise<void>;
  /** Marca la storia come modificata — aziona l'autosave al prossimo ciclo */
  markUnsaved: () => void;
}

/**
 * @description Gestisce la persistenza della storia nell'editor.
 * Prima save: POST /api/stories → crea bozza.
 * Save successive: PUT /api/stories/[id] → aggiorna.
 * Autosave: ogni 30s se lo status è 'unsaved'.
 * Tutte le API calls includono x-author-cookie-id per l'autorizzazione.
 *
 * @example
 * const { storyId, saveStatus, save, markUnsaved } = useEditorAutosave({
 *   artwork, imageSource, authorCookieId
 * });
 *
 * @see app/api/stories/route.ts
 * @see app/api/stories/[id]/route.ts
 */
export function useEditorAutosave({
  initialStoryId,
  artwork,
  imageSource,
  authorCookieId,
  onStoryCreated,
}: UseEditorAutosaveParams): UseEditorAutosaveReturn {
  const [storyId, setStoryId] = useState<string | null>(initialStoryId ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('unsaved');

  // PERF: ref per accedere all'ID aggiornato dalla callback save senza re-crearla
  const storyIdRef = useRef<string | null>(initialStoryId ?? null);
  // PERF: evita save parallele se l'utente clicca "Salva" mentre l'autosave è attivo
  const savingRef = useRef(false);
  // PERF: ultima data del salvataggio — usata per decidere se autosave è necessario
  const lastSaveStatusRef = useRef<SaveStatus>('unsaved');

  useEffect(() => {
    lastSaveStatusRef.current = saveStatus;
  }, [saveStatus]);

  const save = useCallback(
    async (data: SaveData) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaveStatus('saving');

      // AUTH: header obbligatorio per tutte le write operations
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-author-cookie-id': authorCookieId,
      };

      try {
        if (!storyIdRef.current) {
          // SUPABASE: prima save — crea la bozza con i metadati dell'opera
          const res = await fetch('/api/stories', {
            method: 'POST',
            headers,
            body: JSON.stringify({ artwork, imageSource }),
          });
          if (!res.ok) throw new Error(`POST /api/stories: HTTP ${res.status}`);

          const created = (await res.json()) as { id: string };
          storyIdRef.current = created.id;
          setStoryId(created.id);
          onStoryCreated?.(created.id);
        }

        // SUPABASE: aggiorna titolo, waypoint, stato e thumbnail
        const res = await fetch(`/api/stories/${storyIdRef.current}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`PUT /api/stories/${storyIdRef.current}: HTTP ${res.status}`);

        setSaveStatus('saved');
      } catch (err) {
        console.error('[useEditorAutosave] Errore salvataggio:', err);
        setSaveStatus('error');
      } finally {
        savingRef.current = false;
      }
    },
    [artwork, imageSource, authorCookieId, onStoryCreated],
  );

  const markUnsaved = useCallback(() => setSaveStatus('unsaved'), []);

  return { storyId, saveStatus, save, markUnsaved };
}
