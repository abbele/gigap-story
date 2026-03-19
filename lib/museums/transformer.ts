// TRANSFORMER: Utilità condivise per la normalizzazione dei dati museali.
// Questo modulo esporta helper usati da tutti gli adapter e la funzione
// aggregateSearch che chiama i provider in parallelo con timeout e fallback.

import type {
  MuseumAdapter,
  MuseumProvider,
  MuseumSearchParams,
  MuseumSearchResult,
  UnifiedArtwork,
} from '@/types/museum';

/** Rimuove tag HTML, normalizza spazi e trim. */
export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Calcola aspect ratio width/height con 3 cifre decimali. Undefined se i dati mancano. */
export function calcAspectRatio(width?: number | null, height?: number | null): number | undefined {
  if (!width || !height || height === 0) return undefined;
  return parseFloat((width / height).toFixed(3));
}

/**
 * Esegue una Promise con timeout.
 * Se la promise non si risolve entro `ms` millisecondi, rigetta con un errore.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout dopo ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

/**
 * Estrae l'ID dal formato prefissato usato in UnifiedArtwork.
 * Es: "chicago_12345" → { provider: "chicago", localId: "12345" }
 */
export function parseCompositeId(
  compositeId: string,
): { provider: MuseumProvider; localId: string } | null {
  const sep = compositeId.indexOf('_');
  if (sep === -1) return null;
  const provider = compositeId.slice(0, sep) as MuseumProvider;
  const localId = compositeId.slice(sep + 1);
  return { provider, localId };
}

/**
 * Aggrega i risultati da tutti gli adapter in parallelo con Promise.allSettled.
 * I provider che falliscono o vanno in timeout vengono ignorati silenziosamente.
 *
 * @param adapters Lista di adapter attivi
 * @param params Parametri di ricerca unificati
 */
export async function aggregateSearch(
  adapters: MuseumAdapter[],
  params: MuseumSearchParams,
): Promise<MuseumSearchResult> {
  // PERF: ogni provider riceve una quota del limit totale per bilanciare i risultati.
  // Usa adapters.length (non una costante) così il calcolo è sempre corretto
  // indipendentemente da quanti provider sono attivi o filtrati dall'utente.
  const perProvider = Math.max(4, Math.ceil(params.limit / adapters.length));
  const perProviderParams: MuseumSearchParams = { ...params, limit: perProvider };

  const settled = await Promise.allSettled(
    adapters.map(async (adapter) => {
      // PERF: timeout 5s per provider — se un museo non risponde gli altri continuano
      const { items, total } = await withTimeout(adapter.search(perProviderParams));

      const artworks = items
        .map((raw) => {
          try {
            return adapter.transformToUnified(raw);
          } catch {
            // TRANSFORMER: scarta le opere che non possono essere normalizzate (es. senza IIIF)
            return null;
          }
        })
        .filter((a): a is UnifiedArtwork => a !== null);

      return { provider: adapter.provider, artworks, total };
    }),
  );

  const artworks: UnifiedArtwork[] = [];
  const providers: { provider: MuseumProvider; count: number }[] = [];
  let total = 0;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      artworks.push(...result.value.artworks);
      providers.push({ provider: result.value.provider, count: result.value.artworks.length });
      total += result.value.total;
    }
  }

  // UX: mescola i risultati per evitare che un museo domini sempre l'inizio della lista
  const shuffled = artworks.sort(() => Math.random() - 0.5);

  return {
    artworks: shuffled,
    total,
    page: params.page,
    hasMore: shuffled.length >= params.limit,
    providers,
  };
}
