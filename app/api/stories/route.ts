// SUPABASE: /api/stories — listing storie e creazione nuova bozza.
//
// GET /api/stories
//   Query params:
//     page     - pagina (default 1)
//     limit    - risultati per pagina (default 20, max 40)
//     provider - filtro museo: 'chicago' | 'rijksmuseum' | 'wellcome' | 'ycba'
//     sort     - 'recent' (default) | 'popular'
//     status   - 'published' (default) | 'draft' (richiede header x-author-cookie-id)
//   Risposta: { stories: Story[], total: number, page: number, hasMore: boolean }
//
// POST /api/stories
//   Header:  x-author-cookie-id (obbligatorio — AUTH)
//   Body:    { artwork: UnifiedArtwork, imageSource: string }
//   Risposta: Story (bozza appena creata), status 201

import type { NextRequest } from 'next/server';
import type { UnifiedArtwork } from '@/types/museum';
import { getPublishedStoriesPage, getDraftsByAuthor, createStory } from '@/lib/supabase/stories';

// Dinamico — le storie cambiano frequentemente
export const revalidate = 0;

const VALID_PROVIDERS = new Set(['chicago', 'rijksmuseum', 'wellcome', 'ycba']);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') ?? 'published';

  // AUTH: le bozze richiedono identificazione tramite header
  if (status === 'draft') {
    const authorCookieId = request.headers.get('x-author-cookie-id');
    if (!authorCookieId) {
      return Response.json({ error: 'Autore non identificato' }, { status: 401 });
    }
    try {
      const drafts = await getDraftsByAuthor(authorCookieId);
      return Response.json({ stories: drafts, total: drafts.length });
    } catch (err) {
      console.error('[GET /api/stories?status=draft]', err);
      return Response.json({ error: 'Errore interno' }, { status: 500 });
    }
  }

  // Storie pubblicate — nessuna auth necessaria
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const limit = Math.min(40, Math.max(1, parseInt(sp.get('limit') ?? '20', 10) || 20));
  const providerParam = sp.get('provider') ?? undefined;
  const sortParam = sp.get('sort') === 'popular' ? 'popular' : ('recent' as const);

  // MUSEUM_API: provider non valido ignorato silenziosamente
  const provider = providerParam && VALID_PROVIDERS.has(providerParam) ? providerParam : undefined;

  try {
    const { stories, total } = await getPublishedStoriesPage({
      page,
      limit,
      provider,
      sort: sortParam,
    });
    return Response.json({
      stories,
      total,
      page,
      hasMore: (page - 1) * limit + stories.length < total,
    });
  } catch (err) {
    console.error('[GET /api/stories]', err);
    return Response.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // AUTH: l'autore deve essere identificato tramite cookie anonimo
  const authorCookieId = request.headers.get('x-author-cookie-id');
  if (!authorCookieId) {
    return Response.json({ error: 'Autore non identificato' }, { status: 401 });
  }

  let body: { artwork?: UnifiedArtwork; imageSource?: string };
  try {
    body = (await request.json()) as { artwork?: UnifiedArtwork; imageSource?: string };
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  if (!body.artwork || !body.imageSource) {
    return Response.json({ error: 'artwork e imageSource sono obbligatori' }, { status: 400 });
  }

  try {
    const story = await createStory({
      authorCookieId,
      artwork: body.artwork,
      imageSource: body.imageSource,
    });
    return Response.json(story, { status: 201 });
  } catch (err) {
    console.error('[POST /api/stories]', err);
    return Response.json({ error: 'Errore interno' }, { status: 500 });
  }
}
