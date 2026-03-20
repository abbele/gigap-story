// AI: tipi e funzioni matematiche per la ricerca di similarità visiva.
// Usato sia dal hook browser (useSimilarity) che dallo script offline (generate-embeddings).

import type { MuseumProvider } from '@/types/museum';

/**
 * Singola entry nel file di indice degli embedding.
 * Generato offline da scripts/generate-embeddings.ts e servito come file statico.
 */
export interface EmbeddingEntry {
  artworkId: string;
  provider: MuseumProvider;
  title: string;
  artist: string;
  thumbnailUrl: string;
  /** Vettore CLIP ViT-B/32: 512 dimensioni, normalizzato L2 */
  embedding: number[];
}

/**
 * Risultato di una ricerca per similarità.
 * Come EmbeddingEntry ma con il punteggio di similarità coseno invece del vettore.
 */
export interface SimilarityResult {
  artworkId: string;
  provider: MuseumProvider;
  title: string;
  artist: string;
  thumbnailUrl: string;
  /** Similarità coseno [0, 1] — 1 = identico */
  similarity: number;
}

/**
 * @description Calcola la similarità coseno tra due vettori di uguale dimensione.
 * Entrambi i vettori devono essere normalizzati L2 (uscita standard di CLIP).
 * Con vettori normalizzati il prodotto scalare è già la similarità coseno.
 *
 * @param a Vettore query (embedding del crop)
 * @param b Vettore indice (embedding di un'opera)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  // AI: CLIP normalizza i vettori — dot product ≡ cosine similarity
  return Math.max(0, Math.min(1, dot));
}

/**
 * @description Cerca le top-k opere più simili al vettore query nell'indice.
 * Escludi l'opera di origine (stessa artworkId) se presente nell'indice.
 *
 * @param query Embedding del crop del waypoint
 * @param index Array completo degli embedding indicizzati
 * @param k Numero massimo di risultati
 * @param excludeId ID opera da escludere dai risultati (l'opera corrente)
 */
export function findTopK(
  query: number[],
  index: EmbeddingEntry[],
  k: number,
  excludeId?: string,
): SimilarityResult[] {
  // PERF: calcolo brute-force O(n×d) — con n≤2000 e d=512 è ~10ms nel main thread
  const scored = index
    .filter((entry) => entry.artworkId !== excludeId)
    .map((entry) => ({
      artworkId: entry.artworkId,
      provider: entry.provider,
      title: entry.title,
      artist: entry.artist,
      thumbnailUrl: entry.thumbnailUrl,
      similarity: cosineSimilarity(query, entry.embedding),
    }));

  // Ordina per similarità decrescente, prendi i top k
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
