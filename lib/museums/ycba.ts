// MUSEUM_API: Yale Center for British Art (New Haven, CT)
// Accesso:  IIIF Presentation API 3 (manifest per ogni opera)
// Manifest: https://manifests.collections.yale.edu/ycba/obj/{id}
// IIIF img: https://images.collections.yale.edu/iiif/2/ycba:{uuid}/info.json
// Auth:     pubblica, nessuna API key richiesta
//
// Strategia: l'OAI-PMH originale (britishart.yale.edu/oai) è stato dismesso.
// Usiamo i manifest IIIF Presentation API 3 direttamente: campionamento parallelo
// di un range di ID numerici noti (500–8000), fetch concorrente dei manifest,
// estrazione di titolo/artista/data/uuid-iiif. Cache 24h con unstable_cache.
//
// TODO: @fase-futura integrare il sistema LUX di Yale (lux.collections.yale.edu)
// quando la loro API pubblica JSON-LD sarà stabile.
//
// Doc: https://britishart.yale.edu/collections-data-sharing

import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { unstable_cache } from 'next/cache';
import { cleanText, calcAspectRatio } from './transformer';

const MANIFEST_BASE = 'https://manifests.collections.yale.edu/ycba/obj';
const IIIF_IMG_BASE = 'https://images.collections.yale.edu/iiif/2';

// MUSEUM_API: range di ID validi noti per la collezione dipinti YCBA
// (campionati empiricamente — oggetti fuori range o non-painting tornano 404)
const KNOWN_IDS = [
  500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100,
  2200, 2300, 2400, 2500, 3500, 3600, 3700, 4000, 4100, 4200, 4300, 5000, 5028, 5100, 5200, 5300,
  5500, 6000, 6100, 6200, 6500, 7000, 7100, 7500, 8000,
];

interface YcbaRecord {
  id: number;
  title: string;
  artist: string;
  date: string;
  imageUuid: string;
  width?: number;
  height?: number;
}

/**
 * Parsa il label YCBA — formato tipico: "Artista, anni, Titolo opera, anno"
 * Esempi:
 *   "John Constable, 1776–1837, Ploughing Scene in Suffolk, 1824 to 1825"
 *   "Walter Richard Sickert, 1860–1942, La Giuseppina, 1903 to 1904"
 */
function parseYcbaLabel(raw: unknown): { artist: string; title: string; date: string } {
  const label = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : String(raw);
  // TRANSFORMER: il pattern è "Artista, dates, Titolo, date"
  const match = label.match(/^(.+?),\s*\d{4}[–-]\d{4},\s*(.+?)(?:,\s*(\d{4}.*))?$/);
  if (match) {
    return { artist: match[1].trim(), title: match[2].trim(), date: match[3]?.trim() ?? '' };
  }
  return { artist: 'Anonimo', title: cleanText(label) || 'Senza titolo', date: '' };
}

/**
 * Estrae i dati necessari da un manifest IIIF Presentation API 3 del YCBA.
 * Restituisce null se il manifest non rappresenta un'opera con immagine IIIF.
 */
function extractFromManifest(id: number, manifest: Record<string, unknown>): YcbaRecord | null {
  try {
    // IIIF: naviga items[0].items[0].items[0].body per trovare il service
    const canvas = (manifest.items as unknown[])?.[0] as Record<string, unknown>;
    const annPage = (canvas?.items as unknown[])?.[0] as Record<string, unknown>;
    const annotation = (annPage?.items as unknown[])?.[0] as Record<string, unknown>;
    const body = annotation?.body as Record<string, unknown>;
    const services = body?.service as Record<string, unknown>[];
    const iiifService = services?.find(
      (s) => s['@type'] === 'ImageService2' || s.type === 'ImageService2',
    );
    if (!iiifService) return null;

    const serviceId = (iiifService['@id'] ?? iiifService.id) as string;
    // IIIF: estrae l'UUID dal formato "https://.../iiif/2/ycba:{uuid}"
    const uuidMatch = serviceId?.match(/ycba:([^/]+)$/);
    if (!uuidMatch) return null;
    const imageUuid = uuidMatch[1];

    const labelObj = manifest.label as Record<string, unknown> | null;
    const rawLabel =
      (Array.isArray(labelObj?.['en']) ? (labelObj?.['en'] as unknown[])[0] : labelObj?.['en']) ??
      manifest.label;
    const { artist, title, date } = parseYcbaLabel(rawLabel);

    const width = body.width as number | undefined;
    const height = body.height as number | undefined;

    return { id, title, artist, date, imageUuid, width, height };
  } catch {
    return null;
  }
}

/**
 * Fetch parallelo dei manifest YCBA.
 * PERF: cachato 24h con unstable_cache — i manifest cambiano raramente.
 */
const fetchYcbaRecords = unstable_cache(
  async (): Promise<YcbaRecord[]> => {
    const results = await Promise.allSettled(
      KNOWN_IDS.map(async (id) => {
        const res = await fetch(`${MANIFEST_BASE}/${id}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return null;
        const manifest = await res.json();
        return extractFromManifest(id, manifest);
      }),
    );

    return results
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<YcbaRecord>).value);
  },
  ['ycba-manifests-harvest'],
  // PERF: TTL 24h
  { revalidate: 86400, tags: ['ycba'] },
);

export const ycbaAdapter: MuseumAdapter = {
  provider: 'ycba',

  async search(params: MuseumSearchParams) {
    const allRecords = await fetchYcbaRecords();

    // MUSEUM_API: filtro testuale in-memory su titolo e artista
    const query = params.query?.toLowerCase();
    const filtered = query
      ? allRecords.filter(
          (r) => r.title.toLowerCase().includes(query) || r.artist.toLowerCase().includes(query),
        )
      : allRecords;

    const start = (params.page - 1) * params.limit;
    const page = filtered.slice(start, start + params.limit);

    return { items: page, total: filtered.length };
  },

  async getArtwork(id: string) {
    const numId = parseInt(id, 10);
    const allRecords = await fetchYcbaRecords();
    const record = allRecords.find((r) => r.id === numId);
    if (!record) throw new Error(`YCBA: opera ${id} non trovata nel cache`);
    return record;
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const r = raw as YcbaRecord;
    if (!r.imageUuid) throw new Error(`YCBA ${r.id}: imageUuid mancante`);

    // IIIF: URL image service con UUID estratto dal manifest
    const iiifBase = `${IIIF_IMG_BASE}/ycba:${r.imageUuid}`;

    return {
      id: `ycba_${r.id}`,
      provider: 'ycba',
      title: r.title || 'Senza titolo',
      artist: r.artist || 'Anonimo',
      date: r.date || '',
      medium: '',
      imageUrl: `${iiifBase}/full/400,/0/default.jpg`,
      imageUrlLarge: `${iiifBase}/full/843,/0/default.jpg`,
      iiifInfoUrl: `${iiifBase}/info.json`,
      iiifManifestUrl: `${MANIFEST_BASE}/${r.id}`,
      sourceUrl: `https://collections.britishart.yale.edu/catalog/tms:${r.id}`,
      museum: {
        name: 'Yale Center for British Art',
        shortName: 'YCBA',
        city: 'New Haven',
        country: 'USA',
      },
      classification: 'Painting',
      aspectRatio: calcAspectRatio(r.width, r.height),
    };
  },
};
