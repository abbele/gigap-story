// SUPABASE: GET /api/stories — listing storie pubblicate con filtri e paginazione.
//
// GET /api/stories
// Query params:
//   page     - pagina (default 1)
//   limit    - risultati per pagina (default 20, max 40)
//   provider - filtro museo: 'chicago' | 'rijksmuseum' | 'wellcome' | 'ycba' (opzionale)
//   sort     - ordinamento: 'recent' (default) | 'popular'
//
// Risposta: { stories: Story[], total: number, page: number, hasMore: boolean }

import type { NextRequest } from 'next/server';
import { getPublishedStoriesPage } from '@/lib/supabase/stories';

// Dinamico — le storie cambiano frequentemente
export const revalidate = 60;

const VALID_PROVIDERS = new Set(['chicago', 'rijksmuseum', 'wellcome', 'ycba']);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const limit = Math.min(40, Math.max(1, parseInt(sp.get('limit') ?? '20', 10) || 20));
  const providerParam = sp.get('provider') ?? undefined;
  const sortParam = sp.get('sort') === 'popular' ? 'popular' : ('recent' as const);

  // MUSEUM_API: filtra provider non validi silenziosamente
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
