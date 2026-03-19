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
 * Il sentinel è sempre nel DOM (non dentro gli early return) così l'observer può
 * essere configurato al primo mount e non va mai perso.
 * `fetchNextPage` di TanStack Query è già un no-op se non c'è pagina successiva
 * o se un fetch è già in corso — non serve guardia esplicita nel callback.
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

  // PERF: IntersectionObserver sul sentinel — chiama fetchNextPage() quando
  // l'utente si avvicina al fondo della pagina (rootMargin 200px di anticipo).
  // Il sentinel è SEMPRE nel DOM così l'observer non va mai riconfigurato.
  // TanStack Query garantisce che fetchNextPage() sia no-op se non c'è pagina
  // successiva o se un fetch è già in corso: nessuna guardia esplicita necessaria.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage();
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // UX: fetchNextPage è stabile in TanStack Query — dipendenza sicura
  }, [fetchNextPage]);

  return (
    <div>
      {/* Stato: caricamento iniziale */}
      {isLoading && (
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <ArtworkCardSkeleton key={i} index={i} />
          ))}
        </div>
      )}

      {/* Stato: errore di rete o API */}
      {isError && (
        <div className="py-20 text-center text-zinc-500">
          <p className="text-sm">Errore nel caricamento delle opere.</p>
          <p className="text-xs mt-1 text-zinc-400">Riprova tra qualche secondo.</p>
        </div>
      )}

      {/* Stato: nessun risultato */}
      {!isLoading && !isError && artworks.length === 0 && (
        <div className="py-20 text-center text-zinc-500">
          <p className="text-sm">Nessuna opera trovata.</p>
          <p className="text-xs mt-1 text-zinc-400">
            Prova con parole chiave diverse o cambia i filtri museo.
          </p>
        </div>
      )}

      {/* Opere caricate */}
      {artworks.length > 0 && (
        <>
          {/* Contatore risultati */}
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
        </>
      )}

      {/* PERF: sentinel sempre nel DOM — l'IntersectionObserver lo osserva dal primo mount */}
      <div ref={sentinelRef} className="h-px" aria-hidden="true" />

      {/* Messaggio di fine lista */}
      {!hasNextPage && artworks.length > 0 && (
        <p className="py-8 text-center text-xs text-zinc-400">Tutte le opere caricate</p>
      )}
    </div>
  );
}
