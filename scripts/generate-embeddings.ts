/**
 * Script di indicizzazione offline: genera gli embedding CLIP per le opere della gallery.
 *
 * Uso:
 *   pnpm generate:embeddings                    # 250/museo, Rijksmuseum tutto
 *   pnpm generate:embeddings --per-museum=500   # 500 per Chicago/Wellcome/YCBA
 *   pnpm generate:embeddings --output=public/data/embeddings.json
 *
 * Il modello CLIP (Xenova/clip-vit-base-patch32, ~170MB) viene scaricato
 * automaticamente nella cache locale la prima volta (~3 min), senza API key.
 *
 * Rijksmuseum: paginazione a cursore nativa — vengono indicizzate TUTTE le opere
 * disponibili nella Search API (tipicamente 1000-3000 dipinti).
 * Ogni opera richiede una chiamata OAI-PMH (~1s) → stima 30-60 min per 1000 opere.
 *
 * Output: public/data/embeddings.json
 *   Array di EmbeddingEntry — lo stesso tipo letto da hooks/useSimilarity.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { pipeline } from '@xenova/transformers';
import { chicagoAdapter } from '../lib/museums/chicago';
import { wellcomeAdapter } from '../lib/museums/wellcome';
import { ycbaAdapter } from '../lib/museums/ycba';
import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '../types/museum';
import type { EmbeddingEntry } from '../lib/ai/similarity';

// --- Config CLI ---

const PER_MUSEUM = parseInt(
  process.argv.find((a) => a.startsWith('--per-museum='))?.split('=')[1] ?? '250',
  10,
);
const OUTPUT_PATH = resolve(
  process.argv.find((a) => a.startsWith('--output='))?.split('=')[1] ??
    'public/data/embeddings.json',
);
const BATCH_SIZE = 20;

// ── CLIP model singleton ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clipPipeline: any = null;

async function getClipPipeline() {
  if (!clipPipeline) {
    console.log('[CLIP] Caricamento Xenova/clip-vit-base-patch32…');
    console.log('[CLIP] Primo run: download ~170MB → poi in cache ~/.cache/huggingface');
    clipPipeline = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
      quantized: false, // fp32 — vettori più precisi per similarità
    });
    console.log('[CLIP] Modello pronto.\n');
  }
  return clipPipeline;
}

/** Genera embedding CLIP per un'immagine data la sua URL. */
async function generateEmbedding(imageUrl: string): Promise<number[] | null> {
  try {
    const pipe = await getClipPipeline();
    const output = await pipe(imageUrl, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (err) {
    console.warn(`  ⚠ Embedding fallito: ${(err as Error).message.slice(0, 80)}`);
    return null;
  }
}

// ── Rijksmuseum: paginazione a cursore ─────────────────────────────────────

// MUSEUM_API: la Search API Rijks restituisce al massimo 100 opere per call
// con un campo `next` (URL completa) per la pagina successiva.
interface RijksSearchPage {
  orderedItems: { id: string }[];
  next?: string;
}

/** Estrae il numeric ID dall'URL Linked Data Rijksmuseum. */
function extractNumericId(url: string): string | null {
  return url.split('/').pop() ?? null;
}

/** Parsa un record OAI-PMH Rijksmuseum e restituisce l'UnifiedArtwork se valido. */
async function fetchRijksRecord(numericId: string): Promise<UnifiedArtwork | null> {
  try {
    const identifier = encodeURIComponent(`https://id.rijksmuseum.nl/${numericId}`);
    const url = `https://data.rijksmuseum.nl/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier=${identifier}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();

    const title = xml.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/i)?.[1]?.trim();
    if (!title) return null;

    const relation = xml.match(/<dc:relation[^>]*>([^<]*)<\/dc:relation>/i)?.[1] ?? '';
    const micrioMatch = relation.match(/iiif\.micr\.io\/([^/]+)/);
    if (!micrioMatch) return null;

    const micrioId = micrioMatch[1];
    const objectNumber =
      xml.match(/<dc:identifier[^>]*>([^<]*)<\/dc:identifier>/i)?.[1]?.trim() ?? '';
    const creator = xml.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/i)?.[1]?.trim() ?? 'Anonimo';

    const iiifBase = `https://iiif.micr.io/${micrioId}`;

    return {
      id: `rijksmuseum_${numericId}`,
      provider: 'rijksmuseum',
      title: title || 'Senza titolo',
      artist: creator,
      date: xml.match(/<dc:date[^>]*>([^<]*)<\/dc:date>/i)?.[1]?.trim() ?? '',
      medium: '',
      imageUrl: `${iiifBase}/full/400,/0/default.jpg`,
      imageUrlLarge: `${iiifBase}/full/843,/0/default.jpg`,
      iiifInfoUrl: `${iiifBase}/info.json`,
      iiifManifestUrl: `https://www.rijksmuseum.nl/api/iiif/${objectNumber}/manifest.json`,
      sourceUrl: `https://www.rijksmuseum.nl/en/collection/${objectNumber}`,
      museum: { name: 'Rijksmuseum', shortName: 'RKS', city: 'Amsterdam', country: 'Netherlands' },
      classification: 'Painting',
    };
  } catch {
    return null;
  }
}

/**
 * Indicizza TUTTE le opere Rijksmuseum seguendo la paginazione a cursore nativa.
 * Ogni pagina = 100 opere, segue il campo `next` finché non è vuoto.
 */
async function fetchAllRijksmuseum(): Promise<UnifiedArtwork[]> {
  const results: UnifiedArtwork[] = [];
  let nextUrl: string | undefined = 'https://data.rijksmuseum.nl/search/collection?type=painting';
  let page = 1;

  while (nextUrl) {
    console.log(`  [rijksmuseum] Cursore pagina ${page}: ${results.length} opere finora`);

    let json: RijksSearchPage;
    try {
      const res = await fetch(nextUrl);
      if (!res.ok) break;
      json = (await res.json()) as RijksSearchPage;
    } catch (err) {
      console.warn(`  [rijksmuseum] Errore fetch cursore pagina ${page}:`, (err as Error).message);
      break;
    }

    const ids = (json.orderedItems ?? [])
      .map((item) => extractNumericId(item.id))
      .filter((id): id is string => !!id);

    if (ids.length === 0) break;

    // MUSEUM_API: fetch OAI-PMH in parallelo con concurrency limitata per non sovraccaricare
    const CONCURRENCY = 5;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const batch = ids.slice(i, i + CONCURRENCY);
      const records = await Promise.all(batch.map(fetchRijksRecord));
      const valid = records.filter((r): r is UnifiedArtwork => r !== null);
      results.push(...valid);
      // Pausa gentile tra i batch OAI-PMH
      await new Promise((r) => setTimeout(r, 300));
    }

    nextUrl = json.next;
    page++;
    // Pausa tra le pagine del cursore
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`  [rijksmuseum] Totale: ${results.length} opere indicizzate`);
  return results;
}

// ── Fetch generico per gli altri adapter ───────────────────────────────────

async function fetchArtworks(adapter: MuseumAdapter, target: number): Promise<UnifiedArtwork[]> {
  const results: UnifiedArtwork[] = [];
  let page = 1;

  while (results.length < target) {
    const params: MuseumSearchParams = {
      page,
      limit: Math.min(BATCH_SIZE, (target - results.length) * 2),
    };

    try {
      const { items, total } = await adapter.search(params);
      const artworks = items
        .map((raw) => {
          try {
            return adapter.transformToUnified(raw);
          } catch {
            return null;
          }
        })
        .filter((a): a is UnifiedArtwork => a !== null && !!a.imageUrl);

      results.push(...artworks);
      console.log(
        `  [${adapter.provider}] Pagina ${page}: +${artworks.length} (${results.length}/${target})`,
      );

      if (results.length >= target || items.length === 0 || results.length >= total) break;
    } catch (err) {
      console.warn(`  [${adapter.provider}] Errore p${page}:`, (err as Error).message);
      break;
    }

    page++;
    await new Promise((r) => setTimeout(r, 200));
  }

  return results.slice(0, target);
}

// ── Embedding loop comune ───────────────────────────────────────────────────

async function embedArtworks(
  artworks: UnifiedArtwork[],
  provider: string,
  seenIds: Set<string>,
): Promise<EmbeddingEntry[]> {
  const entries: EmbeddingEntry[] = [];
  let embedded = 0;

  for (const artwork of artworks) {
    if (seenIds.has(artwork.id)) continue;

    const embedding = await generateEmbedding(artwork.imageUrl);
    if (!embedding) continue;

    seenIds.add(artwork.id);
    entries.push({
      artworkId: artwork.id,
      provider: artwork.provider,
      title: artwork.title,
      artist: artwork.artist,
      thumbnailUrl: artwork.imageUrl,
      embedding,
    });

    embedded++;
    if (embedded % 50 === 0) {
      console.log(`  ✓ ${provider}: ${embedded}/${artworks.length} embedding`);
    }
  }

  console.log(`  ✓ ${provider}: ${embedded} embedding completati`);
  return entries;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════`);
  console.log(`║ generate-embeddings — Fase 9 Connessioni nascoste`);
  console.log(`║ Chicago / Wellcome / YCBA: ${PER_MUSEUM} opere`);
  console.log(`║ Rijksmuseum: TUTTE (paginazione a cursore nativa)`);
  console.log(`║ Output: ${OUTPUT_PATH}`);
  console.log(`╚══════════════════════════════════════════════════════\n`);

  const outputDir = dirname(OUTPUT_PATH);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const allEntries: EmbeddingEntry[] = [];
  const seenIds = new Set<string>();

  // Precaricare il modello CLIP una volta sola (non per ogni museo)
  await getClipPipeline();

  // ── Rijksmuseum: cursor pagination completo ──
  console.log('── RIJKSMUSEUM (tutte) ──');
  const rijksArtworks = await fetchAllRijksmuseum();
  allEntries.push(...(await embedArtworks(rijksArtworks, 'rijksmuseum', seenIds)));

  // ── Altri adapter: paginazione standard ──
  const others: { adapter: MuseumAdapter; label: string }[] = [
    { adapter: chicagoAdapter, label: 'CHICAGO' },
    { adapter: wellcomeAdapter, label: 'WELLCOME' },
    { adapter: ycbaAdapter, label: 'YCBA' },
  ];

  for (const { adapter, label } of others) {
    console.log(`\n── ${label} (max ${PER_MUSEUM}) ──`);
    const artworks = await fetchArtworks(adapter, PER_MUSEUM);
    allEntries.push(...(await embedArtworks(artworks, label.toLowerCase(), seenIds)));
  }

  // Salva
  console.log(`\n[FS] Scrittura ${allEntries.length} entry in ${OUTPUT_PATH}…`);
  writeFileSync(OUTPUT_PATH, JSON.stringify(allEntries), 'utf-8');

  const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(allEntries), 'utf-8') / 1024);
  console.log(`\n✓ ${allEntries.length} opere indicizzate — ${sizeKB} KB`);
  console.log(`  Distribuisci il file con il deploy o servilo via Next.js static assets.`);
}

main().catch((err) => {
  console.error('\n✗ Errore fatale:', err);
  process.exit(1);
});
