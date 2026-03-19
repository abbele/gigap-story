// MUSEUM_API: Yale Center for British Art (New Haven, CT)
// Accesso:  OAI-PMH → https://collections.britishart.yale.edu/oai
// IIIF:     https://images.collections.yale.edu/iiif/2/ycba:obj:{id}/info.json
// Manifest: https://manifests.collections.yale.edu/ycba/obj/{id}
// Auth:     pubblica, nessuna API key richiesta
// Strategia: OAI-PMH non ha una vera ricerca testuale — harvestiamo i record
//            (prima pagina OAI, ~100 opere), li cachiamo 24h e filtriamo in-memory.
//            Il parser XML è custom via regex: evita dipendenze esterne in ambiente Node.js.
// Doc:      https://britishart.yale.edu/collections-data-sharing

import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { unstable_cache } from 'next/cache';
import { cleanText } from './transformer';

const OAI_ENDPOINT = 'https://collections.britishart.yale.edu/oai';
const IIIF_IMG_BASE = 'https://images.collections.yale.edu/iiif/2';
const MANIFEST_BASE = 'https://manifests.collections.yale.edu/ycba/obj';

interface YcbaRecord {
  id: string;
  title: string;
  creator: string;
  date: string;
  description: string;
}

/**
 * Parser minimale per l'XML OAI-PMH Dublin Core.
 * MUSEUM_API: Node.js non ha DOMParser nativo — usiamo regex su campi Dublin Core noti.
 * Formato atteso: <dc:title>, <dc:creator>, <dc:date>, <dc:description>, <dc:identifier>
 */
function parseOaiDcRecords(xml: string): YcbaRecord[] {
  const records: YcbaRecord[] = [];

  // Estrae ogni blocco <record>...</record>
  const recordRegex = /<record>([\s\S]*?)<\/record>/g;
  let recordMatch: RegExpExecArray | null;

  while ((recordMatch = recordRegex.exec(xml)) !== null) {
    const block = recordMatch[1];

    // Salta i record con status deleted
    if (/<header\s+status="deleted"/.test(block)) continue;

    const id = extractFirst(block, 'identifier');
    const title = extractFirst(block, 'title');
    const creator = extractFirst(block, 'creator');
    const date = extractFirst(block, 'date');
    const description = extractFirst(block, 'description');

    // MUSEUM_API: l'identifier OAI-PMH ha il formato "oai:collections.britishart.yale.edu:{id}"
    const localId = id?.split(':').pop();
    if (!localId || !title) continue;

    records.push({
      id: localId,
      title,
      creator: creator ?? '',
      date: date ?? '',
      description: description ?? '',
    });
  }

  return records;
}

/** Estrae il primo valore di un tag Dublin Core (con o senza prefisso dc:). */
function extractFirst(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<(?:dc:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:dc:)?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? cleanText(match[1]) : undefined;
}

/**
 * Harvest OAI-PMH: recupera la prima pagina di record di tipo "Paintings".
 * PERF: cachato 24h con unstable_cache — il catalogo YCBA cambia raramente.
 * TODO: @fase-futura implementare la paginazione completa con resumptionToken
 *        per harvestare l'intero catalogo dipinti (~3000 opere).
 */
const fetchYcbaRecords = unstable_cache(
  async (): Promise<YcbaRecord[]> => {
    const url = new URL(OAI_ENDPOINT);
    url.searchParams.set('verb', 'ListRecords');
    url.searchParams.set('metadataPrefix', 'oai_dc');
    url.searchParams.set('set', 'Paintings');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`YCBA OAI-PMH ${res.status}: ${res.statusText}`);

    const xml = await res.text();
    return parseOaiDcRecords(xml);
  },
  ['ycba-oai-harvest'],
  // PERF: TTL 24h — i dati cambiano raramente
  { revalidate: 86400, tags: ['ycba'] },
);

export const ycbaAdapter: MuseumAdapter = {
  provider: 'ycba',

  async search(params: MuseumSearchParams) {
    const allRecords = await fetchYcbaRecords();

    // MUSEUM_API: filtro testuale in-memory su titolo e creator
    const query = params.query?.toLowerCase();
    const filtered = query
      ? allRecords.filter(
          (r) => r.title.toLowerCase().includes(query) || r.creator.toLowerCase().includes(query),
        )
      : allRecords;

    const start = (params.page - 1) * params.limit;
    const page = filtered.slice(start, start + params.limit);

    return { items: page, total: filtered.length };
  },

  async getArtwork(id: string) {
    const allRecords = await fetchYcbaRecords();
    const record = allRecords.find((r) => r.id === id);
    if (!record) throw new Error(`YCBA: opera ${id} non trovata`);
    return record;
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const r = raw as YcbaRecord;
    if (!r.id) throw new Error('YCBA: id mancante');

    // IIIF: pattern image server Yale — formato URN ycba:obj:{id}
    const iiifId = `ycba:obj:${r.id}`;
    const iiifBase = `${IIIF_IMG_BASE}/${iiifId}`;

    return {
      id: `ycba_${r.id}`,
      provider: 'ycba',
      title: cleanText(r.title) || 'Senza titolo',
      artist: cleanText(r.creator) || 'Anonimo',
      date: cleanText(r.date) || '',
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
    };
  },
};
