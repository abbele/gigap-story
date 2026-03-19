// MUSEUM_API: Pagina editor storia — Server Component.
// Fetcha l'opera via adapter (bypass HTTP), carica eventuale bozza esistente,
// e passa tutto a EditorShell (Client Component).
//
// URL pattern:
//   /editor/chicago_12345            — nuova storia da quest'opera
//   /editor/chicago_12345?storyId=uuid — riapri bozza esistente

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { UnifiedArtwork, MuseumAdapter } from '@/types/museum';
import { parseCompositeId } from '@/lib/museums/transformer';
import { chicagoAdapter } from '@/lib/museums/chicago';
import { rijksmuseumAdapter } from '@/lib/museums/rijksmuseum';
import { wellcomeAdapter } from '@/lib/museums/wellcome';
import { ycbaAdapter } from '@/lib/museums/ycba';
import { getStoryById } from '@/lib/supabase/stories';
import type { Story } from '@/types/story';
import EditorShell from '@/components/editor/EditorShell';

// Dinamico — ogni visita è una sessione di editing unica
export const dynamic = 'force-dynamic';

const ADAPTERS: Record<string, MuseumAdapter> = {
  chicago: chicagoAdapter,
  rijksmuseum: rijksmuseumAdapter,
  wellcome: wellcomeAdapter,
  ycba: ycbaAdapter,
};

// PERF: React.cache deduplica la fetch tra generateMetadata e render
const getArtwork = cache(async (id: string): Promise<UnifiedArtwork | null> => {
  const parsed = parseCompositeId(id);
  if (!parsed) return null;

  const adapter = ADAPTERS[parsed.provider];
  if (!adapter) return null;

  try {
    const raw = await adapter.getArtwork(parsed.localId);
    return adapter.transformToUnified(raw);
  } catch (err) {
    console.error(`[editor/${id}] Errore fetch opera:`, err);
    return null;
  }
});

/**
 * @description Genera i metadati della pagina editor.
 * Titolo dinamico in base all'opera selezionata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ artworkId: string }>;
}): Promise<Metadata> {
  const { artworkId } = await params;
  const artwork = await getArtwork(artworkId);

  if (!artwork) return { title: 'Editor — Gigapixel Storyteller' };

  return {
    title: `Editor — ${artwork.title} — Gigapixel Storyteller`,
    // UX: noindex — le pagine editor non devono essere indicizzate dai motori di ricerca
    robots: { index: false, follow: false },
  };
}

/**
 * @description Pagina editor storia.
 * Carica l'opera e la bozza opzionale, poi renderizza EditorShell.
 * Se artworkId non esiste o non è supportato, restituisce 404.
 *
 * @example
 * // Nuova storia: /editor/rijksmuseum_200100988
 * // Riapri bozza: /editor/rijksmuseum_200100988?storyId=uuid
 *
 * @see components/editor/EditorShell.tsx
 */
export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ artworkId: string }>;
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { artworkId } = await params;
  const { storyId } = await searchParams;

  const artwork = await getArtwork(artworkId);
  if (!artwork) notFound();

  // SUPABASE: carica bozza esistente se storyId è presente nel URL
  let initialStory: Story | null = null;
  if (storyId) {
    const story = await getStoryById(storyId);
    // AUTH: passiamo la storia solo se è una bozza — le storie pubblicate non si ri-editano
    if (story?.status === 'draft') {
      initialStory = story;
    }
  }

  return (
    // UX: h-[100dvh] per occupare l'intera viewport senza scroll della pagina
    <div className="h-[100dvh] overflow-hidden">
      <EditorShell artwork={artwork} initialStory={initialStory} />
    </div>
  );
}
