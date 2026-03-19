// SUPABASE: GET /api/stories/[id] — singola storia pubblica + incremento view_count.
// Restituisce 404 se la storia non esiste o non è pubblicata.
// Il view_count viene incrementato in modo atomico tramite RPC Supabase.
//
// GET /api/stories/:id
// Risposta: Story (tipizzata)

import type { NextRequest } from 'next/server';
import { getStoryById, incrementViewCount } from '@/lib/supabase/stories';

// Dinamico — il view_count cambia a ogni visita
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await getStoryById(id);

  if (!story) {
    return Response.json({ error: 'Storia non trovata' }, { status: 404 });
  }

  if (story.status !== 'published') {
    // AUTH: le bozze non sono accessibili pubblicamente
    return Response.json({ error: 'Storia non trovata' }, { status: 404 });
  }

  // PERF: incrementa il contatore in background — non blocca la risposta
  incrementViewCount(id).catch((err) => {
    console.warn('[GET /api/stories/:id] Fallito incremento view_count:', err);
  });

  return Response.json(story);
}
