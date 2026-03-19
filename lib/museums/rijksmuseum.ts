// MUSEUM_API: Rijksmuseum Amsterdam — nuova architettura Data Services 2025
// Search:   https://data.rijksmuseum.nl/search/collection?type=painting&title=...
//           Restituisce IDs Linked Data (es. https://id.rijksmuseum.nl/200100988)
// Metadati: OAI-PMH GetRecord → https://data.rijksmuseum.nl/oai?verb=GetRecord&...
//           Dublin Core con titolo, artista, data, formato, micrioId (da dc:relation)
// IIIF:     https://iiif.micr.io/{micrioId}/info.json  (Micrio, compatibile OSD)
// Auth:     nessuna API key — tutto pubblico
// Doc:      https://data.rijksmuseum.nl/docs/iiif/image
//
// Flusso:
//   1. Search API → lista di IDs Linked Data
//   2. OAI-PMH GetRecord (parallelo) → metadati Dublin Core per ogni ID
//   3. Estrai micrioId da dc:relation → costruisci IIIF info.json

import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { cleanText, calcAspectRatio } from './transformer';

const SEARCH_BASE = 'https://data.rijksmuseum.nl/search/collection';
const OAI_BASE = 'https://data.rijksmuseum.nl/oai';
const MICRIO_BASE = 'https://iiif.micr.io';

interface RMASearchResponse {
  orderedItems: { id: string }[];
  next?: string;
}

interface OaiRecord {
  numericId: string;
  objectNumber: string;
  title: string;
  creator: string;
  date: string;
  micrioId: string;
  medium: string;
}

// --- XML parsing ---

/** Estrae il primo valore di un tag Dublin Core dall'XML OAI-PMH. */
function extractFirst(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<dc:${tag}[^>]*>([^<]*)<\\/dc:${tag}>`, 'i'));
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

/** Estrae tutti i valori di un tag Dublin Core (es. dc:format può essere multiplo). */
function extractAll(xml: string, tag: string): string[] {
  const regex = new RegExp(`<dc:${tag}[^>]*>([^<]*)<\\/dc:${tag}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    const val = decodeXmlEntities(m[1].trim());
    if (val) results.push(val);
  }
  return results;
}

/** Decodifica le entità XML più comuni. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Parsa un record OAI-PMH oai_dc.
 * Restituisce null se mancano titolo o micrioId (necessario per il IIIF viewer).
 *
 * MUSEUM_API: dc:relation contiene l'URL immagine Micrio con il format:
 * "https://iiif.micr.io/{micrioId}/full/max/0/default.jpg"
 * Da cui estraiamo il micrioId per costruire info.json.
 */
function parseOaiDcXml(xml: string, numericId: string): OaiRecord | null {
  const title = extractFirst(xml, 'title');
  if (!title) return null;

  // IIIF: micrioId estratto dall'URL immagine in dc:relation
  const relation = extractFirst(xml, 'relation');
  const micrioMatch = relation.match(/iiif\.micr\.io\/([^/]+)/);
  if (!micrioMatch) return null;

  const formats = extractAll(xml, 'format');

  return {
    numericId,
    objectNumber: extractFirst(xml, 'identifier'),
    title,
    creator: extractFirst(xml, 'creator'),
    date: extractFirst(xml, 'date'),
    micrioId: micrioMatch[1],
    // TRANSFORMER: dc:format può essere multiplo (es. "doek", "olieverf") → join
    medium: formats.join(', '),
  };
}

/**
 * Fetch OAI-PMH GetRecord per un singolo ID Linked Data numerico.
 * Restituisce null in caso di errore o dati mancanti.
 */
async function fetchOaiRecord(numericId: string): Promise<OaiRecord | null> {
  try {
    const identifier = `https://id.rijksmuseum.nl/${numericId}`;
    const url = `${OAI_BASE}?verb=GetRecord&metadataPrefix=oai_dc&identifier=${encodeURIComponent(identifier)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();
    return parseOaiDcXml(xml, numericId);
  } catch {
    return null;
  }
}

/** Estrae il numeric ID dall'URL Linked Data del Rijksmuseum. */
function extractNumericId(linkedDataId: string): string | null {
  return linkedDataId.split('/').pop() ?? null;
}

export const rijksmuseumAdapter: MuseumAdapter = {
  provider: 'rijksmuseum',

  async search(params: MuseumSearchParams) {
    // MUSEUM_API: Step 1 — ottieni lista IDs dalla Search API
    const searchUrl = new URL(SEARCH_BASE);
    searchUrl.searchParams.set('type', 'painting');
    if (params.query) searchUrl.searchParams.set('title', params.query);

    // PERF: la Search API restituisce 100 items per pagina senza offset;
    // per la paginazione usiamo `next` ma per semplicità usiamo solo la prima pagina
    const res = await fetch(searchUrl.toString());
    if (!res.ok) throw new Error(`Rijksmuseum Search API ${res.status}: ${res.statusText}`);

    const json: RMASearchResponse = await res.json();

    // PERF: la Search API restituisce al massimo 100 items in un colpo solo.
    // Usiamo params.page per sliceare offset diversi così ogni pagina ottiene IDs distinti.
    // Over-fetch x3 per compensare i record senza micrioId (scartati da parseOaiDcXml).
    const offset = (params.page - 1) * params.limit;
    const ids = json.orderedItems
      .slice(offset, Math.min(offset + params.limit * 3, json.orderedItems.length))
      .map((item) => extractNumericId(item.id))
      .filter((id): id is string => !!id);

    if (ids.length === 0) return { items: [], total: 0 };

    // MUSEUM_API: Step 2 — fetch OAI-PMH in parallelo per ogni ID
    const records = await Promise.all(ids.map(fetchOaiRecord));

    // TRANSFORMER: scarta i record null (senza immagine o dati incompleti)
    const items = records.filter((r): r is OaiRecord => r !== null).slice(0, params.limit);

    return { items, total: json.orderedItems.length };
  },

  async getArtwork(id: string) {
    const record = await fetchOaiRecord(id);
    if (!record) throw new Error(`Rijksmuseum: opera ${id} non trovata`);
    return record;
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const r = raw as OaiRecord;
    if (!r.micrioId) throw new Error(`Rijksmuseum ${r.numericId}: micrioId mancante`);

    // IIIF: Micrio è un server IIIF Image API standard, compatibile con OpenSeadragon
    const iiifBase = `${MICRIO_BASE}/${r.micrioId}`;

    return {
      id: `rijksmuseum_${r.numericId}`,
      provider: 'rijksmuseum',
      title: cleanText(r.title) || 'Senza titolo',
      artist: cleanText(r.creator) || 'Anonimo',
      date: cleanText(r.date) || '',
      medium: cleanText(r.medium) || '',
      imageUrl: `${iiifBase}/full/400,/0/default.jpg`,
      imageUrlLarge: `${iiifBase}/full/843,/0/default.jpg`,
      iiifInfoUrl: `${iiifBase}/info.json`,
      iiifManifestUrl: `https://www.rijksmuseum.nl/api/iiif/${r.objectNumber}/manifest.json`,
      sourceUrl: `https://www.rijksmuseum.nl/en/collection/${r.objectNumber}`,
      museum: {
        name: 'Rijksmuseum',
        shortName: 'RKS',
        city: 'Amsterdam',
        country: 'Netherlands',
      },
      classification: 'Painting',
      aspectRatio: calcAspectRatio(null, null),
    };
  },
};
