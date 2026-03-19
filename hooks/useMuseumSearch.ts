'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { MuseumProvider, MuseumSearchResult } from '@/types/museum';

export interface UseMuseumSearchParams {
  query?: string;
  providers?: MuseumProvider[];
  limit?: number;
}

/**
 * @description Recupera le opere dai musei aggregati con paginazione infinita.
 * Usa TanStack Query v5 `useInfiniteQuery` per gestire il caricamento progressivo.
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } = useMuseumSearch({ query: 'rembrandt' });
 * const artworks = data?.pages.flatMap(p => p.artworks) ?? [];
 *
 * @see /api/museums/search
 */
export function useMuseumSearch({ query, providers, limit = 20 }: UseMuseumSearchParams) {
  return useInfiniteQuery({
    // PERF: la queryKey include tutti i parametri — il cambio di query/filtri
    // invalida automaticamente la cache e riparte dalla pagina 1.
    queryKey: ['museum-search', { query, providers, limit }],

    queryFn: async ({ pageParam }) => {
      const url = new URL('/api/museums/search', window.location.origin);
      if (query) url.searchParams.set('q', query);
      if (providers?.length) {
        providers.forEach((p) => url.searchParams.append('provider', p));
      }
      url.searchParams.set('page', String(pageParam));
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Ricerca fallita: ${res.status}`);
      return res.json() as Promise<MuseumSearchResult>;
    },

    // MUSEUM_API: la prima pagina parte sempre da 1
    initialPageParam: 1,

    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasMore ? (lastPageParam as number) + 1 : undefined,
  });
}
