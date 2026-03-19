-- Migrazione iniziale: tabella stories
-- SUPABASE: RLS disabilitata — i permessi sono gestiti nelle API routes Next.js
-- tramite confronto dell'header "x-author-cookie-id" con author_cookie_id del record.
-- TODO: @fase-futura — migrare a RLS nativo Supabase (vedi ROADMAP.md, sezione "Fase futura")

create table stories (
  id uuid default gen_random_uuid() primary key,
  status text not null default 'draft' check (status in ('draft', 'published')),
  title text not null default 'Senza titolo',
  description text default '',
  -- AUTH: UUID v4 del cookie client-side dell'autore
  author_cookie_id text not null,
  author_display_name text,
  -- SUPABASE: UnifiedArtwork serializzato come JSON
  artwork_data jsonb not null,
  -- IIIF: URL del info.json usato dal viewer OpenSeadragon
  image_source text not null,
  -- SUPABASE: Waypoint[] serializzato come JSON
  waypoints jsonb not null default '[]',
  -- UX: Base64 PNG del primo waypoint, per le card in /stories
  cover_thumbnail text,
  view_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);

-- Indice per filtrare per stato (draft/published) — query più comune
create index idx_stories_status on stories (status);

-- Indice per recuperare le bozze di un autore specifico
create index idx_stories_author on stories (author_cookie_id);

-- Indice parziale per la pagina /stories (solo published, ordinati per data)
create index idx_stories_published on stories (published_at desc)
  where status = 'published';

-- PERF: funzione RPC per incrementare view_count in modo atomico,
-- evitando race conditions rispetto a un read-then-write dal client
create or replace function increment_view_count(story_id uuid)
returns void
language sql
as $$
  update stories set view_count = view_count + 1 where id = story_id;
$$;
