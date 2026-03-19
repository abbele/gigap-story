// Tipi unificati per le opere e i musei aggregati

export type MuseumProvider = 'chicago' | 'rijksmuseum' | 'nga' | 'wellcome' | 'ycba';

export interface UnifiedArtwork {
  /** ID prefissato dal provider: es. "chicago_12345" */
  id: string;
  provider: MuseumProvider;
  title: string;
  artist: string;
  /** Stringa libera: "c. 1503", "1889", "XVII sec." */
  date: string;
  /** Es. "Oil on canvas" */
  medium: string;
  dimensions?: string;
  /** URL immagine thumbnail per la gallery card */
  imageUrl: string;
  /** URL immagine ad alta risoluzione */
  imageUrlLarge: string;
  // IIIF: obbligatorio — le opere senza iiifInfoUrl vengono scartate dal transformer
  iiifInfoUrl: string;
  /** IIIF Presentation manifest URL, se disponibile */
  iiifManifestUrl?: string;
  /** Link diretto all'opera sul sito del museo */
  sourceUrl: string;
  museum: {
    name: string;
    /** Sigla breve: "AIC", "RKS", "NGA", "WC", "YCBA" */
    shortName: string;
    city: string;
    country: string;
  };
  tags?: string[];
  department?: string;
  /** Es. "Painting", "Drawing" */
  classification?: string;
  // UX: usato dal masonry layout per calcolare l'altezza della card prima del caricamento immagine
  aspectRatio?: number;
}

export interface MuseumSearchParams {
  query?: string;
  /** Se omesso, cerca su tutti i provider */
  provider?: MuseumProvider[];
  classification?: string;
  dateRange?: { from: number; to: number };
  page: number;
  /** Risultati per pagina, max 40 */
  limit: number;
}

export interface MuseumSearchResult {
  artworks: UnifiedArtwork[];
  total: number;
  page: number;
  hasMore: boolean;
  /** Breakdown risultati per museo, utile per mostrare badge contatori nei filtri */
  providers: { provider: MuseumProvider; count: number }[];
}

// MUSEUM_API: interfaccia che ogni adapter museale deve implementare
export interface MuseumAdapter {
  provider: MuseumProvider;
  search(params: MuseumSearchParams): Promise<{ items: unknown[]; total: number }>;
  getArtwork(id: string): Promise<unknown>;
  // TRANSFORMER: converte il formato nativo del museo in UnifiedArtwork
  transformToUnified(raw: unknown): UnifiedArtwork;
}
