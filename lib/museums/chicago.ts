// MUSEUM_API: Art Institute of Chicago
// Search:   POST https://api.artic.edu/api/v1/artworks/search (Elasticsearch)
// IIIF:     https://www.artic.edu/iiif/2/{image_id}/info.json
// Manifest: https://api.artic.edu/api/v1/artworks/{id}/manifest.json
// Auth:     pubblica, nessuna API key richiesta
// Limiti:   ~60 req/min. Filtra solo dipinti pubblici (is_public_domain + artwork_type_title)
// Doc:      https://api.artic.edu/docs/

import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { calcAspectRatio, cleanText } from './transformer';

const BASE_URL = 'https://api.artic.edu/api/v1';
const IIIF_BASE = 'https://www.artic.edu/iiif/2';

// MUSEUM_API: selezioniamo solo i campi necessari per minimizzare il payload
const FIELDS = [
  'id',
  'title',
  'artist_title',
  'date_display',
  'medium_display',
  'dimensions',
  'image_id',
  'thumbnail',
  'artwork_type_title',
  'style_title',
  'department_title',
  'is_public_domain',
].join(',');

const HEADERS = {
  'Content-Type': 'application/json',
  // MUSEUM_API: AIC richiede uno User-Agent identificativo per i client che usano l'API
  'AIC-User-Agent': 'gigap-story/0.1 (https://gigap-story.vercel.app)',
};

interface ChicagoArtwork {
  id: number;
  title: string;
  artist_title: string | null;
  date_display: string | null;
  medium_display: string | null;
  dimensions: string | null;
  image_id: string | null;
  thumbnail: { width: number; height: number; alt_text?: string } | null;
  artwork_type_title: string | null;
  style_title: string | null;
  department_title: string | null;
  is_public_domain: boolean;
}

export const chicagoAdapter: MuseumAdapter = {
  provider: 'chicago',

  async search(params: MuseumSearchParams) {
    // MUSEUM_API: costruisce la query Elasticsearch — filtro obbligatorio per dipinti pubblici
    const mustClauses: unknown[] = [
      { term: { is_public_domain: true } },
      // MUSEUM_API: usa il subfield .keyword per term queries su campi text in Elasticsearch
      { term: { 'artwork_type_title.keyword': 'Painting' } },
    ];
    if (params.query) {
      mustClauses.push({
        multi_match: {
          query: params.query,
          fields: ['title^3', 'artist_title^2', 'style_title'],
        },
      });
    }

    const body = {
      query: { bool: { must: mustClauses } },
      // PERF: richiedi solo i campi dichiarati
      _source: FIELDS.split(','),
    };

    const url = new URL(`${BASE_URL}/artworks/search`);
    url.searchParams.set('fields', FIELDS);
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('page', String(params.page));

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Chicago API ${res.status}: ${res.statusText}`);

    const json = await res.json();
    // IIIF: filtriamo subito le opere senza image_id per evitare trasformazioni inutili
    const items = (json.data ?? []).filter((a: ChicagoArtwork) => !!a.image_id);

    return { items, total: json.pagination?.total ?? 0 };
  },

  async getArtwork(id: string) {
    const url = `${BASE_URL}/artworks/${id}?fields=${FIELDS}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Chicago API ${res.status}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const a = raw as ChicagoArtwork;

    // IIIF: obbligatorio — scarta opere senza image_id
    if (!a.image_id) throw new Error(`Chicago ${a.id}: nessun image_id`);

    const iiifBase = `${IIIF_BASE}/${a.image_id}`;

    return {
      id: `chicago_${a.id}`,
      provider: 'chicago',
      title: cleanText(a.title) || 'Senza titolo',
      artist: cleanText(a.artist_title) || 'Anonimo',
      date: cleanText(a.date_display) || '',
      medium: cleanText(a.medium_display) || '',
      dimensions: cleanText(a.dimensions) || undefined,
      // IIIF: thumbnail 400px per le card gallery, large 843px per il dettaglio
      imageUrl: `${iiifBase}/full/400,/0/default.jpg`,
      imageUrlLarge: `${iiifBase}/full/843,/0/default.jpg`,
      iiifInfoUrl: `${iiifBase}/info.json`,
      iiifManifestUrl: `${BASE_URL}/artworks/${a.id}/manifest.json`,
      sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
      museum: {
        name: 'Art Institute of Chicago',
        shortName: 'AIC',
        city: 'Chicago',
        country: 'USA',
      },
      tags: a.style_title ? [a.style_title] : undefined,
      department: cleanText(a.department_title) || undefined,
      classification: 'Painting',
      // UX: aspect ratio dal thumbnail per il calcolo dell'altezza card nel masonry layout
      aspectRatio: calcAspectRatio(a.thumbnail?.width, a.thumbnail?.height),
    };
  },
};
