// SUPABASE: /api/stories/[id] — lettura, aggiornamento ed eliminazione di una storia.
//
// GET /api/stories/:id
//   Restituisce la storia se pubblicata (404 per bozze).
//   Incrementa view_count in background tramite RPC atomica.
//   Risposta: Story
//
// PUT /api/stories/:id
//   Header:  x-author-cookie-id (obbligatorio — AUTH)
//   Body:    Partial<Pick<Story, 'title' | 'description' | 'waypoints' | 'status' | ...>>
//   Risposta: Story aggiornata
//
// DELETE /api/stories/:id
//   Header:  x-author-cookie-id (obbligatorio — AUTH)
//   Risposta: 204 No Content

import type { NextRequest } from 'next/server';
import type { Story } from '@/types/story';
import { getStoryById, updateStory, deleteStory, incrementViewCount } from '@/lib/supabase/stories';

// Dinamico — il view_count cambia a ogni visita
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStoryById(id);

  if (!story) {
    return Response.json({ error: 'Storia non trovata' }, { status: 404 });
  }

  // AUTH: le bozze non sono accessibili pubblicamente via GET
  if (story.status !== 'published') {
    return Response.json({ error: 'Storia non trovata' }, { status: 404 });
  }

  // PERF: fire and forget — non blocca la risposta
  incrementViewCount(id).catch((err) => {
    console.warn('[GET /api/stories/:id] Fallito incremento view_count:', err);
  });

  return Response.json(story);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // AUTH: verifica identità autore tramite header
  const authorCookieId = request.headers.get('x-author-cookie-id');
  if (!authorCookieId) {
    return Response.json({ error: 'Autore non identificato' }, { status: 401 });
  }

  const existing = await getStoryById(id);
  if (!existing) {
    return Response.json({ error: 'Storia non trovata' }, { status: 404 });
  }

  // AUTH: solo l'autore originale può modificare la storia
  if (existing.authorCookieId !== authorCookieId) {
    return Response.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  let body: Partial<
    Pick<
      Story,
      'title' | 'description' | 'waypoints' | 'status' | 'coverThumbnail' | 'authorDisplayName'
    >
  >;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  // Validazione pubblicazione: richiede titolo non vuoto e almeno 2 waypoint
  if (body.status === 'published') {
    if (!body.title?.trim() && !existing.title?.trim()) {
      return Response.json({ error: 'Il titolo è obbligatorio per pubblicare' }, { status: 422 });
    }
    const waypoints = body.waypoints ?? existing.waypoints;
    if (waypoints.length < 2) {
      return Response.json(
        { error: 'Sono necessari almeno 2 waypoint per pubblicare' },
        { status: 422 },
      );
    }
  }

  try {
    const updated = await updateStory(id, body);
    return Response.json(updated);
  } catch (err) {
    console.error('[PUT /api/stories/:id]', err);
    return Response.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // AUTH: verifica identità autore tramite header
  const authorCookieId = request.headers.get('x-author-cookie-id');
  if (!authorCookieId) {
    return Response.json({ error: 'Autore non identificato' }, { status: 401 });
  }

  const existing = await getStoryById(id);
  if (!existing) {
    return Response.json({ error: 'Storia non trovata' }, { status: 404 });
  }

  // AUTH: solo l'autore può eliminare la storia
  if (existing.authorCookieId !== authorCookieId) {
    return Response.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  try {
    await deleteStory(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/stories/:id]', err);
    return Response.json({ error: 'Errore interno' }, { status: 500 });
  }
}
