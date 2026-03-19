// MUSEUM_API: Wellcome Collection (Londra)
// Search:   https://api.wellcomecollection.org/catalogue/v2/works
// IIIF:     https://iiif.wellcomecollection.org/image/{imageId}/info.json
// Auth:     pubblica, nessuna API key richiesta
// Limiti:   max 100 risultati per pagina (pageSize)
// Doc:      https://developers.wellcomecollection.org/docs/catalogue
//
// NOTA: il catalogo Wellcome include materiale eterogeneo (libri, fotografie, dipinti).
// Filtriamo con workType=k (Pictures/Artworks) e verifichiamo la presenza di un thumbnail.

import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { calcAspectRatio, cleanText } from './transformer';

const BASE_URL = 'https://api.wellcomecollection.org/catalogue/v2';
const IIIF_IMG_BASE = 'https://iiif.wellcomecollection.org/image';

interface WellcomeWork {
  id: string;
  title: string;
  contributors?: { agent: { label: string } }[];
  productionDates?: { label: string }[];
  description?: string;
  thumbnail?: {
    url: string;
    width?: number;
    height?: number;
  };
  subjects?: { label: string }[];
}

/**
 * Estrae l'imageId dal thumbnail URL della Wellcome Collection.
 * Pattern: https://iiif.wellcomecollection.org/thumbs/{imageId}/full/...
 * oppure:  https://iiif.wellcomecollection.org/image/{imageId}/full/...
 */
function extractImageId(thumbnailUrl: string): string | null {
  const match = thumbnailUrl.match(/wellcomecollection\.org\/(?:thumbs|image)\/([^/]+)\//);
  return match?.[1] ?? null;
}

export const wellcomeAdapter: MuseumAdapter = {
  provider: 'wellcome',

  async search(params: MuseumSearchParams) {
    const url = new URL(`${BASE_URL}/works`);
    // MUSEUM_API: workType=k → "Pictures" include dipinti, acquerelli, illustrazioni
    url.searchParams.set('workType', 'k');
    url.searchParams.set('pageSize', String(Math.min(params.limit, 100)));
    url.searchParams.set('page', String(params.page));
    // MUSEUM_API: include validi v2 — 'production' sostituisce 'productionDates', 'images' è opzionale
    // Il campo thumbnail è restituito di default senza bisogno di include esplicito
    url.searchParams.set('include', 'contributors,production,subjects');
    if (params.query) url.searchParams.set('query', params.query);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`Wellcome API ${res.status}: ${res.statusText}`);

    const json = await res.json();

    // TRANSFORMER: filtriamo le opere senza thumbnail (impossibile costruire iiifInfoUrl)
    const items: WellcomeWork[] = (json.results ?? []).filter(
      (w: WellcomeWork) => !!w.thumbnail?.url && extractImageId(w.thumbnail.url),
    );

    return { items, total: json.totalResults ?? items.length };
  },

  async getArtwork(id: string) {
    const url = `${BASE_URL}/works/${id}?include=contributors,productionDates,subjects,thumbnail`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Wellcome API ${res.status}`);
    return res.json();
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const w = raw as WellcomeWork;

    if (!w.thumbnail?.url) throw new Error(`Wellcome ${w.id}: nessun thumbnail`);
    const imageId = extractImageId(w.thumbnail.url);
    if (!imageId) throw new Error(`Wellcome ${w.id}: imageId non estraibile da ${w.thumbnail.url}`);

    const iiifBase = `${IIIF_IMG_BASE}/${imageId}`;
    const artist = w.contributors?.[0]?.agent?.label ?? 'Anonimo';
    const date = w.productionDates?.[0]?.label ?? '';
    const tags = w.subjects?.map((s) => s.label).filter(Boolean);

    return {
      id: `wellcome_${w.id}`,
      provider: 'wellcome',
      title: cleanText(w.title) || 'Senza titolo',
      artist: cleanText(artist) || 'Anonimo',
      date: cleanText(date) || '',
      medium: '',
      imageUrl: `${iiifBase}/full/400,/0/default.jpg`,
      imageUrlLarge: `${iiifBase}/full/843,/0/default.jpg`,
      iiifInfoUrl: `${iiifBase}/info.json`,
      sourceUrl: `https://wellcomecollection.org/works/${w.id}`,
      museum: {
        name: 'Wellcome Collection',
        shortName: 'WC',
        city: 'Londra',
        country: 'UK',
      },
      tags: tags?.length ? tags : undefined,
      classification: 'Painting',
      aspectRatio: calcAspectRatio(w.thumbnail?.width, w.thumbnail?.height),
    };
  },
};
