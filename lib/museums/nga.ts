// MUSEUM_API: National Gallery of Art (Washington D.C.)
// Search:   https://api.nga.gov/art/tms/objects (pubblica, no key)
// IIIF:     https://api.nga.gov/iiif/{iiifId}/info.json
// Auth:     pubblica, nessuna API key richiesta
// Limiti:   rate limit non documentato — usa max 50 risultati per richiesta
// Doc:      https://api.nga.gov/

import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { calcAspectRatio, cleanText } from './transformer';

const BASE_URL = 'https://api.nga.gov';

interface NgaObject {
  objectId: number;
  title: string;
  displayDate: string | null;
  medium: string | null;
  dimensions: string | null;
  attribution: string | null;
  iiifThumbUrl: string | null;
  // MUSEUM_API: l'ID per l'endpoint IIIF è diverso dall'objectId
  iiifId?: string;
  imageUrl?: string | null;
  // Campo aggiuntivo dalla risposta API
  classification?: string | null;
  subClassification?: string | null;
  departmentAbbr?: string | null;
  // Per le dimensioni immagine
  width?: number | null;
  height?: number | null;
}

/**
 * Estrae l'iiifId dal thumbnail URL se presente.
 * Pattern NGA: https://api.nga.gov/iiif/{uuid}/full/.../default.jpg
 */
function extractIiifId(thumbUrl: string | null): string | null {
  if (!thumbUrl) return null;
  const match = thumbUrl.match(/\/iiif\/([^/]+)\//);
  return match?.[1] ?? null;
}

export const ngaAdapter: MuseumAdapter = {
  provider: 'nga',

  async search(params: MuseumSearchParams) {
    const offset = (params.page - 1) * params.limit;

    const url = new URL(`${BASE_URL}/art/tms/objects`);
    url.searchParams.set('classifications', 'Painting');
    url.searchParams.set('hasImage', '1');
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('only_open_access', '1');
    if (params.query) url.searchParams.set('q', params.query);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`NGA API ${res.status}: ${res.statusText}`);

    const json = await res.json();

    // TRANSFORMER: filtra subito le opere senza iiifThumbUrl (non hanno IIIF)
    const items: NgaObject[] = (json.data ?? json.items ?? []).filter(
      (o: NgaObject) => !!o.iiifThumbUrl || !!o.imageUrl,
    );

    return { items, total: json.pagination?.totalRecords ?? json.total ?? items.length };
  },

  async getArtwork(id: string) {
    const res = await fetch(`${BASE_URL}/art/tms/objects/${id}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`NGA API ${res.status}`);
    const json = await res.json();
    return json.data ?? json;
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const o = raw as NgaObject;

    // IIIF: estrai l'ID IIIF dal thumbnail URL
    const iiifId = o.iiifId ?? extractIiifId(o.iiifThumbUrl ?? null);
    if (!iiifId) throw new Error(`NGA ${o.objectId}: nessun iiifId estraibile`);

    const iiifBase = `${BASE_URL}/iiif/${iiifId}`;

    return {
      id: `nga_${o.objectId}`,
      provider: 'nga',
      title: cleanText(o.title) || 'Senza titolo',
      artist: cleanText(o.attribution) || 'Anonimo',
      date: cleanText(o.displayDate) || '',
      medium: cleanText(o.medium) || '',
      dimensions: cleanText(o.dimensions) || undefined,
      imageUrl: `${iiifBase}/full/400,/0/default.jpg`,
      imageUrlLarge: `${iiifBase}/full/843,/0/default.jpg`,
      iiifInfoUrl: `${iiifBase}/info.json`,
      sourceUrl: `https://www.nga.gov/collection/art-object-page.${o.objectId}.html`,
      museum: {
        name: 'National Gallery of Art',
        shortName: 'NGA',
        city: 'Washington D.C.',
        country: 'USA',
      },
      department: cleanText(o.departmentAbbr) || undefined,
      classification: 'Painting',
      aspectRatio: calcAspectRatio(o.width, o.height),
    };
  },
};
