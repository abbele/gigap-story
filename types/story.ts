// Tipi per le storie narrative e i waypoint

import type { UnifiedArtwork } from './museum';

export interface Waypoint {
  id: string;
  /** Rettangolo normalizzato nel sistema di coordinate OpenSeadragon (0-1) */
  viewport: { x: number; y: number; width: number; height: number };
  /** Rich text HTML prodotto da Tiptap */
  text: string;
  /** Secondi di permanenza sul waypoint durante la riproduzione automatica */
  duration: number;
  transition: 'ease' | 'linear' | 'spring';
  /** Base64 PNG della vista, generato via canvas.toDataURL() al momento della cattura */
  thumbnailDataUrl?: string;
}

export type StoryStatus = 'draft' | 'published';

export interface Story {
  /** UUID generato da Supabase */
  id: string;
  status: StoryStatus;
  title: string;
  description: string;
  // AUTH: identificatore anonimo da cookie client-side, usato per il controllo accesso nelle API routes
  authorCookieId: string;
  authorDisplayName?: string;
  /** Opera su cui è basata la storia, serializzata come UnifiedArtwork */
  artwork: UnifiedArtwork;
  /** IIIF info.json URL usato dal viewer OpenSeadragon */
  imageSource: string;
  waypoints: Waypoint[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  viewCount?: number;
  /** Thumbnail del primo waypoint, usata nelle card della pagina /stories */
  coverThumbnail?: string;
}
