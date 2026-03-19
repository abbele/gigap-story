// MUSEUM_API: Pagina dettaglio opera — Server Component.
// Fetcha l'opera direttamente dall'adapter (bypass HTTP) con React.cache
// per deduplicare la chiamata tra generateMetadata e il render della pagina.

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { UnifiedArtwork, MuseumAdapter } from '@/types/museum';
import { parseCompositeId } from '@/lib/museums/transformer';
import { chicagoAdapter } from '@/lib/museums/chicago';
import { rijksmuseumAdapter } from '@/lib/museums/rijksmuseum';
import { wellcomeAdapter } from '@/lib/museums/wellcome';
import { ycbaAdapter } from '@/lib/museums/ycba';
import ArtworkDetailShell from '@/components/viewer/ArtworkDetailShell';

// PERF: cache 1h — i metadati di un'opera cambiano raramente
export const revalidate = 3600;

const ADAPTERS: Record<string, MuseumAdapter> = {
  chicago: chicagoAdapter,
  rijksmuseum: rijksmuseumAdapter,
  wellcome: wellcomeAdapter,
  ycba: ycbaAdapter,
};

// PERF: React.cache deduplica la chiamata all'adapter tra generateMetadata e il render.
// Entrambi ricevono lo stesso Promise senza doppia fetch di rete.
const getArtwork = cache(async (id: string): Promise<UnifiedArtwork | null> => {
  const parsed = parseCompositeId(id);
  if (!parsed) return null;

  const adapter = ADAPTERS[parsed.provider];
  if (!adapter) return null;

  try {
    const raw = await adapter.getArtwork(parsed.localId);
    return adapter.transformToUnified(raw);
  } catch (err) {
    console.error(`[artwork/${id}] Errore fetch:`, err);
    return null;
  }
});

/**
 * @description Genera i metadati Open Graph per la pagina dettaglio opera.
 * Usa la stessa chiamata di getArtwork (deduplicata via React.cache).
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artwork = await getArtwork(id);

  if (!artwork) {
    return { title: 'Opera non trovata — Gigapixel Storyteller' };
  }

  const description = [artwork.artist, artwork.date, artwork.museum.name]
    .filter(Boolean)
    .join(' · ');

  return {
    title: `${artwork.title} — Gigapixel Storyteller`,
    description,
    openGraph: {
      title: artwork.title,
      description,
      images: artwork.imageUrlLarge ? [{ url: artwork.imageUrlLarge }] : [],
    },
  };
}

/**
 * @description Pagina dettaglio opera.
 * Server Component: fetcha l'opera e passa a ArtworkDetailShell (Client Component).
 * Usa notFound() se l'opera non esiste o il provider non è supportato.
 *
 * @example
 * // Navigazione: /artwork/chicago_123456
 *
 * @see components/viewer/ArtworkDetailShell.tsx
 */
export default async function ArtworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artwork = await getArtwork(id);

  if (!artwork) notFound();

  return (
    // UX: flex-1 fa sì che il layout occupi tutta l'altezza disponibile
    // (il layout root ha min-h-full flex flex-col)
    <div className="flex flex-col flex-1">
      <ArtworkDetailShell artwork={artwork} />
    </div>
  );
}
