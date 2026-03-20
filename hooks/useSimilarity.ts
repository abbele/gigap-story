'use client';

// AI: Hook per la ricerca di similarità visiva tra opere (Fase 9 — Connessioni nascoste).
//
// Flusso:
//   1. Al primo utilizzo: carica public/data/embeddings.json + modello CLIP nel browser
//   2. Riceve un'immagine base64 (thumbnailDataUrl del waypoint)
//   3. Genera l'embedding CLIP dell'immagine (stesso modello usato offline)
//   4. Calcola cosine similarity con tutti gli embedding nell'indice
//   5. Restituisce i top-K risultati
//
// Privacy: l'immagine non lascia mai il browser — CLIP gira in ONNX Runtime Web.
// Modello: Xenova/clip-vit-base-patch32 (~170MB, scaricato una volta sola e messo in cache).

import { useState, useCallback, useRef } from 'react';
import type { EmbeddingEntry, SimilarityResult } from '@/lib/ai/similarity';
import { findTopK } from '@/lib/ai/similarity';

type SimilarityStatus =
  | 'idle'
  | 'loading-model'
  | 'loading-index'
  | 'ready'
  | 'searching'
  | 'error';

export interface UseSimilarityReturn {
  /** Stato corrente del hook */
  status: SimilarityStatus;
  /** True se il modello e l'indice sono pronti */
  ready: boolean;
  /** True durante il caricamento del modello o dell'indice */
  isLoading: boolean;
  /** Cerca le K opere più simili all'immagine base64 fornita */
  findSimilar: (imageBase64: string, k?: number, excludeId?: string) => Promise<SimilarityResult[]>;
  /** Messaggio di errore, se presente */
  error: string | null;
}

// AI: singleton del modello e dell'indice — caricati una sola volta per sessione
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clipModelSingleton: any = null;
let embeddingIndexSingleton: EmbeddingEntry[] | null = null;

/**
 * @description Hook per la ricerca di similarità visiva tra opere d'arte.
 * Usa CLIP (Xenova/clip-vit-base-patch32) via Transformers.js — tutto nel browser.
 *
 * @example
 * const { findSimilar, isLoading } = useSimilarity();
 * const results = await findSimilar(waypoint.thumbnailDataUrl, 8, artwork.id);
 *
 * @see scripts/generate-embeddings.ts — script offline che genera l'indice
 * @see lib/ai/similarity.ts — tipi e funzione cosineSimilarity
 */
export function useSimilarity(): UseSimilarityReturn {
  const [status, setStatus] = useState<SimilarityStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // PERF: ref per il modello — evita re-render durante il caricamento
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(clipModelSingleton);
  const indexRef = useRef<EmbeddingEntry[] | null>(embeddingIndexSingleton);

  /**
   * Carica il modello CLIP e l'indice degli embedding se non già in memoria.
   * Le due operazioni partono in parallelo.
   */
  const ensureReady = useCallback(async (): Promise<boolean> => {
    if (modelRef.current && indexRef.current) {
      console.log('[similarity] già pronto (singletons in memoria)');
      return true;
    }

    setError(null);

    try {
      console.log('[similarity] caricamento modello+indice…');
      // AI: import dinamico per evitare SSR — @xenova/transformers usa APIs browser-only
      const [{ pipeline }, indexResponse] = await Promise.all([
        !modelRef.current
          ? (setStatus('loading-model'), import('@xenova/transformers'))
          : import('@xenova/transformers'),
        !indexRef.current
          ? (setStatus('loading-index'), fetch('/data/embeddings.json'))
          : Promise.resolve(null),
      ]);

      if (!modelRef.current) {
        setStatus('loading-model');
        const model = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
          quantized: false,
        });
        modelRef.current = model;
        clipModelSingleton = model;
      }

      if (!indexRef.current && indexResponse) {
        setStatus('loading-index');
        if (!indexResponse.ok) {
          throw new Error('Indice embedding non trovato. Esegui prima: pnpm generate:embeddings');
        }
        const index = (await indexResponse.json()) as EmbeddingEntry[];
        indexRef.current = index;
        embeddingIndexSingleton = index;
      }

      setStatus('ready');
      return true;
    } catch (err) {
      console.error('[similarity] ensureReady errore:', err);
      const message = err instanceof Error ? err.message : 'Errore caricamento AI';
      setError(message);
      setStatus('error');
      return false;
    }
  }, []);

  const findSimilar = useCallback(
    async (imageBase64: string, k = 8, excludeId?: string): Promise<SimilarityResult[]> => {
      console.log('[similarity] findSimilar chiamato, imageBase64 length:', imageBase64?.length);
      const ready = await ensureReady();
      console.log(
        '[similarity] ensureReady →',
        ready,
        'model:',
        !!modelRef.current,
        'index:',
        indexRef.current?.length ?? 'null',
      );
      if (!ready || !modelRef.current || !indexRef.current) {
        console.warn('[similarity] non pronto — abort');
        return [];
      }

      setStatus('searching');
      setError(null);

      try {
        // AI: genera l'embedding del crop — stesso modello usato offline → vettori compatibili
        console.log('[similarity] generazione embedding…');
        const output = await modelRef.current(imageBase64, {
          pooling: 'mean',
          normalize: true,
        });
        const queryEmbedding = Array.from(output.data as Float32Array);
        console.log('[similarity] embedding generato, dims:', queryEmbedding.length);

        // PERF: brute-force O(n×d) — con n≤2000 è ~10ms nel main thread
        const results = findTopK(queryEmbedding, indexRef.current, k, excludeId);
        console.log('[similarity] top-k risultati:', results.length, results[0]);

        setStatus('ready');
        return results;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore ricerca similarità';
        console.error('[similarity] errore:', err);
        setError(message);
        setStatus('error');
        return [];
      }
    },
    [ensureReady],
  );

  return {
    status,
    ready: status === 'ready',
    isLoading: status === 'loading-model' || status === 'loading-index',
    findSimilar,
    error,
  };
}
