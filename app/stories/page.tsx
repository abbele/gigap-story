// SUPABASE: Pagina listing storie pubblicate — Server Component.
// Fetcha la prima pagina direttamente dal DB (bypass HTTP).
// I filtri attivi vengono letti dai searchParams e passati a StoriesShell
// che gestisce la navigazione client-side e il caricamento di ulteriori pagine.

import type { Metadata } from 'next';
import { getPublishedStoriesPage } from '@/lib/supabase/stories';
import StoriesShell from '@/components/stories/StoriesShell';

// PERF: cache di 60s — le nuove storie devono apparire entro 1 minuto
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Storie — Gigapixel Storyteller',
  description:
    "Esplora le storie visive create su opere d'arte gigapixel da musei di tutto il mondo.",
  openGraph: {
    title: 'Storie — Gigapixel Storyteller',
    description: 'Percorsi narrativi sulle opere dei grandi musei del mondo, con zoom gigapixel.',
  },
};

/**
 * @description Pagina listing storie pubblicate.
 * Server Component: fetcha le storie con i filtri dai searchParams,
 * poi passa tutto a StoriesShell (Client Component) per i filtri interattivi.
 *
 * @example
 * // /stories
 * // /stories?provider=chicago&sort=popular
 *
 * @see components/stories/StoriesShell.tsx
 */
export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; sort?: string }>;
}) {
  const { provider, sort } = await searchParams;

  const { stories, total } = await getPublishedStoriesPage({
    page: 1,
    limit: 20,
    provider: provider ?? undefined,
    sort: sort === 'popular' ? 'popular' : 'recent',
  });

  return <StoriesShell initialStories={stories} initialTotal={total} />;
}
