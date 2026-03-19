// SUPABASE: query per la tabella stories.
// AUTH: ogni operazione di scrittura richiede authorCookieId che viene confrontato
// con author_cookie_id del record. Le API routes devono passarlo come header
// "x-author-cookie-id" e verificarlo prima di chiamare queste funzioni.

import type { Story, Waypoint } from '@/types/story';
import type { UnifiedArtwork } from '@/types/museum';
import { supabase } from './client';
import type { Json } from './types';
/** Recupera tutte le storie pubblicate, ordinate per data di pubblicazione. */
export async function getPublishedStories(page = 1, limit = 20): Promise<Story[]> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return (data ?? []).map(rowToStory);
}

/** Recupera una storia per ID. Restituisce null se non trovata. */
export async function getStoryById(id: string): Promise<Story | null> {
  const { data, error } = await supabase.from('stories').select('*').eq('id', id).single();

  if (error) return null;
  return rowToStory(data);
}

/** Recupera le bozze di un autore specifico. */
export async function getDraftsByAuthor(authorCookieId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('author_cookie_id', authorCookieId)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rowToStory);
}

/** Crea una nuova bozza. */
export async function createStory(params: {
  authorCookieId: string;
  artwork: UnifiedArtwork;
  imageSource: string;
}): Promise<Story> {
  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_cookie_id: params.authorCookieId,
      artwork_data: params.artwork as unknown as Json,
      image_source: params.imageSource,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToStory(data);
}

/** Aggiorna una storia (titolo, waypoint, stato, ecc.). */
export async function updateStory(
  id: string,
  updates: Partial<
    Pick<
      Story,
      'title' | 'description' | 'waypoints' | 'status' | 'coverThumbnail' | 'authorDisplayName'
    >
  >,
): Promise<Story> {
  const { data, error } = await supabase
    .from('stories')
    .update({
      title: updates.title,
      description: updates.description,
      waypoints: updates.waypoints as unknown as Json,
      status: updates.status,
      cover_thumbnail: updates.coverThumbnail,
      author_display_name: updates.authorDisplayName,
      updated_at: new Date().toISOString(),
      published_at: updates.status === 'published' ? new Date().toISOString() : undefined,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToStory(data);
}

/** Elimina una storia. */
export async function deleteStory(id: string): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', id);
  if (error) throw error;
}

/** Incrementa view_count in modo atomico tramite RPC. */
export async function incrementViewCount(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_view_count', { story_id: id });
  if (error) throw error;
}

// TRANSFORMER: converte una riga del database nel tipo Story usato nel client
function rowToStory(row: {
  id: string;
  status: 'draft' | 'published';
  title: string;
  description: string;
  author_cookie_id: string;
  author_display_name: string | null;
  artwork_data: Json;
  image_source: string;
  waypoints: Json;
  cover_thumbnail: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}): Story {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    description: row.description,
    authorCookieId: row.author_cookie_id,
    authorDisplayName: row.author_display_name ?? undefined,
    artwork: row.artwork_data as unknown as UnifiedArtwork,
    imageSource: row.image_source,
    waypoints: row.waypoints as unknown as Waypoint[],
    coverThumbnail: row.cover_thumbnail ?? undefined,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
  };
}
