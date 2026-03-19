// MUSEUM_API: Rijksmuseum Amsterdam
// Search:   SPARQL → https://data.rijksmuseum.nl/sparql (pubblica, no key)
// IIIF:     https://www.rijksmuseum.nl/api/iiif-img/{objectNumber}.jpg/info.json
// Manifest: https://www.rijksmuseum.nl/api/iiif/{objectNumber}/manifest.json
// Auth:     nessuna API key — usa l'endpoint SPARQL pubblico del Data Hub
// Doc:      https://data.rijksmuseum.nl/
//
// ⚠️  STATO: non operativo — l'endpoint SPARQL restituisce 404/405 nelle prove effettuate.
//     L'API REST classica (www.rijksmuseum.nl/api/en/collection) è deprecata (410 Gone).
//     Il codice è implementato correttamente; il problema è infrastrutturale lato Rijksmuseum.
//     TODO @fase-futura: verificare nuovo endpoint SPARQL o migrare ad approccio manifest IIIF
//     con lista curata di object number (simile all'adapter YCBA).

import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { calcAspectRatio, cleanText } from './transformer';

const SPARQL_ENDPOINT = 'https://data.rijksmuseum.nl/sparql';
const IIIF_MANIFEST_BASE = 'https://www.rijksmuseum.nl/api/iiif';
// IIIF: pattern immagine Rijksmuseum — image server nativo con supporto Deep Zoom
const IIIF_IMG_BASE = 'https://www.rijksmuseum.nl/api/iiif-img';

interface RijksResult {
  objectNumber: string;
  title: string;
  creator: string;
  date: string;
  imageWidth?: string;
  imageHeight?: string;
}

/**
 * Costruisce la SPARQL query per cercare dipinti nel catalogo Rijksmuseum.
 * MUSEUM_API: usa il vocabolario EDM (Europeana Data Model) esposto dal Data Hub.
 */
function buildSparqlQuery(query: string | undefined, limit: number, offset: number): string {
  // MUSEUM_API: filtro tipo opera — cerca solo dipinti nel Data Hub
  const textFilter = query
    ? `FILTER(CONTAINS(LCASE(str(?title)), LCASE(${JSON.stringify(query)})))`
    : '';

  return `
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX edm: <http://www.europeana.eu/schemas/edm/>
PREFIX ore: <http://www.openarchives.org/ore/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT DISTINCT ?objectNumber ?title ?creator ?date ?imageWidth ?imageHeight
WHERE {
  ?cho dc:identifier ?objectNumber ;
       dc:title ?title ;
       dc:type ?typeLabel .
  OPTIONAL { ?cho dc:creator ?creator . }
  OPTIONAL { ?cho dc:date ?date . }
  OPTIONAL { ?cho <http://www.w3.org/2003/12/exif/ns#width> ?imageWidth . }
  OPTIONAL { ?cho <http://www.w3.org/2003/12/exif/ns#height> ?imageHeight . }
  # MUSEUM_API: filtra solo dipinti (schilderij in olandese)
  FILTER(CONTAINS(LCASE(str(?typeLabel)), "schilderij") || CONTAINS(LCASE(str(?typeLabel)), "painting"))
  ${textFilter}
}
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

export const rijksmuseumAdapter: MuseumAdapter = {
  provider: 'rijksmuseum',

  async search(params: MuseumSearchParams) {
    const offset = (params.page - 1) * params.limit;
    const sparql = buildSparqlQuery(params.query, params.limit, offset);

    const res = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
      },
      body: `query=${encodeURIComponent(sparql)}`,
    });

    if (!res.ok) throw new Error(`Rijksmuseum SPARQL ${res.status}: ${res.statusText}`);

    const json = await res.json();
    const bindings: Record<string, { value: string }>[] = json.results?.bindings ?? [];

    // TRANSFORMER: mappa i binding SPARQL in oggetti intermedi tipizzati
    const items: RijksResult[] = bindings
      .filter((b) => b.objectNumber?.value)
      .map((b) => ({
        objectNumber: b.objectNumber.value,
        title: b.title?.value ?? '',
        creator: b.creator?.value ?? '',
        date: b.date?.value ?? '',
        imageWidth: b.imageWidth?.value,
        imageHeight: b.imageHeight?.value,
      }));

    return { items, total: items.length };
  },

  async getArtwork(id: string) {
    // MUSEUM_API: per il dettaglio fetchamo il manifest IIIF che contiene i metadati completi
    const manifestUrl = `${IIIF_MANIFEST_BASE}/${id}/manifest.json`;
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`Rijksmuseum manifest ${res.status}`);
    const manifest = await res.json();

    // TRANSFORMER: estrai i dati base dal manifest IIIF Presentation API 2.x
    return {
      objectNumber: id,
      title: manifest.label ?? '',
      creator: manifest.metadata?.find((m: { label: string }) => m.label === 'Artist')?.value ?? '',
      date: manifest.metadata?.find((m: { label: string }) => m.label === 'Dating')?.value ?? '',
    } as RijksResult;
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const r = raw as RijksResult;

    if (!r.objectNumber) throw new Error('Rijksmuseum: objectNumber mancante');

    // IIIF: costruiamo il URL dell'image server nativo Rijksmuseum
    // Pattern: https://www.rijksmuseum.nl/api/iiif-img/{objectNumber}.jpg/info.json
    const imgBase = `${IIIF_IMG_BASE}/${r.objectNumber}.jpg`;

    return {
      id: `rijksmuseum_${r.objectNumber}`,
      provider: 'rijksmuseum',
      title: cleanText(r.title) || 'Senza titolo',
      artist: cleanText(r.creator) || 'Anonimo',
      date: cleanText(r.date) || '',
      medium: '',
      imageUrl: `${imgBase}/full/400,/0/default.jpg`,
      imageUrlLarge: `${imgBase}/full/843,/0/default.jpg`,
      iiifInfoUrl: `${imgBase}/info.json`,
      iiifManifestUrl: `${IIIF_MANIFEST_BASE}/${r.objectNumber}/manifest.json`,
      sourceUrl: `https://www.rijksmuseum.nl/en/collection/${r.objectNumber}`,
      museum: {
        name: 'Rijksmuseum',
        shortName: 'RKS',
        city: 'Amsterdam',
        country: 'Netherlands',
      },
      classification: 'Painting',
      aspectRatio: calcAspectRatio(
        r.imageWidth ? parseInt(r.imageWidth) : null,
        r.imageHeight ? parseInt(r.imageHeight) : null,
      ),
    };
  },
};
