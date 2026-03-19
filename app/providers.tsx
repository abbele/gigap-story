'use client';

/**
 * @description Provider globale per TanStack Query v5.
 * Wrappa l'intera applicazione con QueryClientProvider per abilitare
 * il data fetching reattivo e la cache lato client.
 *
 * @see https://tanstack.com/query/v5/docs/react/reference/QueryClientProvider
 *
 * @example
 * // Usato in app/layout.tsx:
 * <Providers>{children}</Providers>
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  // PERF: QueryClient creato con useState invece che a livello di modulo
  // per evitare stato condiviso tra richieste server-side distinte (Next.js SSR).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // PERF: 60 secondi di staleTime per ridurre le richieste ridondanti alle API dei musei
            staleTime: 60_000,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
