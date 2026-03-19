// SUPABASE: Pagina pubblica di fruizione storia — Server Component.
// Carica la storia direttamente dal DB (bypass HTTP) con React.cache per
// deduplicare la chiamata tra generateMetadata e il render della pagina.
// Restituisce 404 per storie non trovate o non pubblicate (bozze).

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStoryById, incrementViewCount } from '@/lib/supabase/stories';
import StoryPublicShell from '@/components/player/StoryPublicShell';

// Dinamico — il view_count cresce a ogni visita, non vogliamo cache di pagina
export const dynamic = 'force-dynamic';

// PERF: React.cache deduplica la query tra generateMetadata e il render
const getStory = cache(async (id: string) => getStoryById(id));

/**
 * @description Genera i metadati Open Graph per la pagina di fruizione storia.
 * Usa coverThumbnail del primo waypoint come immagine OG, se disponibile.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(id);

  if (!story || story.status !== 'published') {
    return { title: 'Storia non trovata — Gigapixel Storyteller' };
  }

  const description =
    story.description ||
    [story.artwork.artist, story.artwork.museum.name].filter(Boolean).join(' · ');

  // UX: usa il thumbnail del primo waypoint o l'immagine dell'opera come OG image
  const ogImage =
    story.coverThumbnail ??
    story.waypoints[0]?.thumbnailDataUrl ??
    story.artwork.imageUrlLarge ??
    story.artwork.imageUrl;

  return {
    title: `${story.title} — Gigapixel Storyteller`,
    description,
    openGraph: {
      title: story.title,
      description,
      images: ogImage ? [{ url: ogImage }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: story.title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

/**
 * @description Pagina pubblica di fruizione storia.
 * Server Component: carica la storia dal DB, verifica che sia pubblicata,
 * incrementa il contatore visite e renderizza StoryPublicShell.
 *
 * @example
 * // Navigazione: /story/uuid-della-storia
 *
 * @see components/player/StoryPublicShell.tsx
 */
export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStory(id);

  // AUTH: le bozze non sono accessibili dalla pagina pubblica
  if (!story || story.status !== 'published') notFound();

  // PERF: fire and forget — non blocca il render se il DB è lento o offline
  incrementViewCount(id).catch((err) => {
    console.warn('[story/:id] Fallito incremento view_count:', err);
  });

  return <StoryPublicShell story={story} />;
}
