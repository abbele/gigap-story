'use client';

import { useEffect, useRef } from 'react';
import type { MuseumProvider } from '@/types/museum';
import { useMuseumSearch } from '@/hooks/useMuseumSearch';
import ArtworkCard from './ArtworkCard';
import ArtworkCardSkeleton from './ArtworkCardSkeleton';

interface ArtworkGalleryProps {
  query: string;
  providers: MuseumProvider[];
  limit?: number;
}

/**
 * @description Gallery masonry con infinite scroll.
 * Usa `useInfiniteQuery` di TanStack Query v5 per caricare le opere a pagine.
 * Un IntersectionObserver sul sentinel in fondo attiva il caricamento della pagina successiva.
 *
 * @example
 * <ArtworkGallery query="rembrandt" providers={['rijksmuseum']} />
 */
export default function ArtworkGallery({ query, providers, limit = 20 }: ArtworkGalleryProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useMuseumSearch({ query, providers, limit });

  const artworks = data?.pages.flatMap((p) => p.artworks) ?? [];
  const total = data?.pages[0]?.total;

  // PERF: IntersectionObserver sul sentinel — carica la pagina successiva
  // quando l'utente si avvicina al fondo senza che debba cliccare nulla.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isError) {
    return (
      <div className="py-20 text-center text-zinc-500">
        <p className="text-sm">Errore nel caricamento delle opere.</p>
        <p className="text-xs mt-1 text-zinc-400">Riprova tra qualche secondo.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      // UX: scheletro iniziale con 12 placeholder per ridurre la percezione di lentezza
      <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <ArtworkCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && artworks.length === 0) {
    return (
      <div className="py-20 text-center text-zinc-500">
        <p className="text-sm">Nessuna opera trovata.</p>
        <p className="text-xs mt-1 text-zinc-400">
          Prova con parole chiave diverse o cambia i filtri museo.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Contatore risultati — aggiornato in tempo reale con i filtri */}
      {total !== undefined && (
        <p className="text-xs text-zinc-400 mb-3">
          {artworks.length} di {total.toLocaleString('it-IT')} opere
        </p>
      )}

      {/* UX: masonry CSS columns — più semplice e performante di JS grid */}
      <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3">
        {artworks.map((artwork) => (
          <ArtworkCard key={artwork.id} artwork={artwork} />
        ))}

        {/* Skeleton per il caricamento delle pagine successive */}
        {isFetchingNextPage &&
          Array.from({ length: 8 }).map((_, i) => (
            <ArtworkCardSkeleton key={`skeleton-next-${i}`} index={i} />
          ))}
      </div>

      {/* PERF: sentinel invisibile — l'IntersectionObserver lo osserva per il lazy load */}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {/* UX: messaggio di fine lista */}
      {!hasNextPage && artworks.length > 0 && (
        <p className="py-8 text-center text-xs text-zinc-400">Tutte le opere caricate</p>
      )}
    </>
  );
}
