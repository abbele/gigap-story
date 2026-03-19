# Roadmap

## Fase 0 — Setup e infrastruttura (Settimana 1)

- [x] Setup linting e pre-commit hooks:

  ```bash
  pnpm add -D eslint prettier husky lint-staged @typescript-eslint/eslint-plugin @typescript-eslint/parser
  pnpm exec husky init
  ```

  Configura `lint-staged` in `package.json`:

  ```json
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,json,md}": ["prettier --write"]
  }
  ```

- [x] Installazione dipendenze core:

  ```bash
  pnpm add openseadragon gsap @tanstack/react-query @tiptap/react @tiptap/pm @tiptap/starter-kit @dnd-kit/core @dnd-kit/sortable js-cookie
  pnpm add -D @types/openseadragon @types/js-cookie
  ```

- [x] Setup Supabase:
  - Crea un nuovo progetto su [supabase.com](https://supabase.com) (free tier, regione EU West)
  - Installa il client: `pnpm add @supabase/supabase-js`
  - Aggiungi a `.env.local`:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
    ```
  - Crea le tabelle con le migration SQL (vedi sezione Database sotto)
  - **Nota sicurezza**: le autorizzazioni per bozze e storie sono gestite nelle API routes Next.js tramite il cookie `x-author-cookie-id`. Supabase RLS è disabilitato per semplicità. Vedi `// TODO: @fase-futura RLS` nella roadmap.

- [x] Setup GitHub + repository:
  - Crea repository pubblico su GitHub: `gigap-story`
  - Aggiungi `.gitignore` (già generato da create-next-app)
  - Aggiungi a `.gitignore`: `.env.local`, `.env*.local`
  - Push del commit iniziale: `git remote add origin ... && git push -u origin main`
  - Configura branch protection su `main`: richiedi PR + 1 review + CI verde

- [x] Setup CI/CD con GitHub Actions:
      Crea `.github/workflows/ci.yml`:

  ```yaml
  name: CI
  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]
  jobs:
    lint-and-build:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
          with:
            version: latest
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm lint
        - run: pnpm build
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
  ```

  - Aggiungi i secret GitHub (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Settings → Secrets → Actions.

- [x] Deploy Vercel:
  - Connetti il repository GitHub a Vercel (import project)
  - Configura le env vars in Vercel Dashboard: stesse variabili di `.env.local`
  - Ogni push su `main` fa deploy automatico in produzione
  - Ogni PR genera un preview URL automatico (Vercel Preview Deployments)

- [x] Setup struttura cartelle:

  ```
  src/
  ├── app/
  │   ├── page.tsx                    # Homepage con Gallery
  │   ├── artwork/[id]/page.tsx       # Dettaglio opera + viewer
  │   ├── editor/[artworkId]/page.tsx # Editor storia (+ ?storyId=xxx per edit bozza)
  │   ├── story/[id]/page.tsx         # Fruizione pubblica storia
  │   ├── stories/page.tsx            # Listing storie pubbliche
  │   └── api/
  │       ├── museums/
  │       │   ├── search/route.ts     # Endpoint unificato: aggrega e normalizza
  │       │   └── artwork/[id]/route.ts # Dettaglio opera singola
  │       └── stories/
  │           ├── route.ts            # GET listing, POST create
  │           └── [id]/route.ts       # GET / PUT / DELETE singola storia
  ├── components/
  │   ├── gallery/
  │   ├── viewer/
  │   ├── editor/
  │   ├── player/
  │   ├── stories/
  │   └── ui/                         # Componenti condivisi custom (no library)
  ├── hooks/
  │   ├── useViewer.ts
  │   ├── useStory.ts
  │   ├── useMuseumSearch.ts
  │   ├── useAnonymousAuthor.ts
  │   └── useAnimation.ts
  ├── lib/
  │   ├── museums/
  │   │   ├── transformer.ts
  │   │   ├── chicago.ts
  │   │   ├── rijksmuseum.ts
  │   │   ├── nga.ts
  │   │   ├── wellcome.ts
  │   │   └── ycba.ts
  │   ├── supabase/
  │   │   ├── client.ts
  │   │   ├── stories.ts
  │   │   └── types.ts
  │   ├── iiif/
  │   │   └── manifest.ts
  │   ├── animation/
  │   │   └── viewport.ts
  │   └── cookies/
  │       └── author.ts
  └── types/
      ├── museum.ts
      └── story.ts
  ```

- [x] Definire i tipi TypeScript fondamentali in `types/`:

  ```typescript
  // === src/types/museum.ts ===

  type MuseumProvider = 'chicago' | 'rijksmuseum' | 'nga' | 'wellcome' | 'ycba';

  interface UnifiedArtwork {
    id: string; // Provider-prefixed: "chicago_12345"
    provider: MuseumProvider;
    title: string;
    artist: string;
    date: string; // "c. 1503" o "1889"
    medium: string; // "Oil on canvas"
    dimensions?: string;
    imageUrl: string; // Thumbnail per gallery card
    imageUrlLarge: string; // Immagine ad alta risoluzione
    iiifInfoUrl: string; // IIIF info.json URL (obbligatorio — filtriamo le opere senza)
    iiifManifestUrl?: string; // IIIF manifest URL se disponibile
    sourceUrl: string; // Link al sito del museo per l'opera
    museum: {
      name: string; // "Art Institute of Chicago"
      shortName: string; // "AIC"
      city: string;
      country: string;
    };
    tags?: string[];
    department?: string;
    classification?: string; // "Painting", "Drawing", ecc.
    aspectRatio?: number; // width/height per il masonry layout
  }

  interface MuseumSearchParams {
    query?: string;
    provider?: MuseumProvider[];
    classification?: string;
    dateRange?: { from: number; to: number };
    page: number;
    limit: number;
  }

  interface MuseumSearchResult {
    artworks: UnifiedArtwork[];
    total: number;
    page: number;
    hasMore: boolean;
    providers: { provider: MuseumProvider; count: number }[];
  }

  interface MuseumAdapter {
    provider: MuseumProvider;
    search(params: MuseumSearchParams): Promise<{ items: unknown[]; total: number }>;
    getArtwork(id: string): Promise<unknown>;
    transformToUnified(raw: unknown): UnifiedArtwork;
  }

  // === src/types/story.ts ===

  interface Waypoint {
    id: string;
    viewport: { x: number; y: number; width: number; height: number };
    text: string; // Rich text HTML (da Tiptap)
    duration: number; // Secondi di permanenza
    transition: 'ease' | 'linear' | 'spring';
    thumbnailDataUrl?: string; // Base64 thumbnail della vista
  }

  type StoryStatus = 'draft' | 'published';

  interface Story {
    id: string; // UUID da Supabase
    status: StoryStatus;
    title: string;
    description: string;
    authorCookieId: string;
    authorDisplayName?: string;
    artwork: UnifiedArtwork;
    imageSource: string; // IIIF info.json URL
    waypoints: Waypoint[];
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    viewCount?: number;
    coverThumbnail?: string; // Thumbnail del primo waypoint
  }

  // === src/types/author.ts ===

  interface AnonymousAuthor {
    cookieId: string; // UUID v4 salvato in cookie client-side
    displayName?: string;
  }
  ```

- [x] Setup database Supabase — esegui su SQL Editor di Supabase:

  ```sql
  -- Tabella storie
  create table stories (
    id uuid default gen_random_uuid() primary key,
    status text not null default 'draft' check (status in ('draft', 'published')),
    title text not null default 'Senza titolo',
    description text default '',
    author_cookie_id text not null,
    author_display_name text,
    artwork_data jsonb not null,        -- UnifiedArtwork serializzato
    image_source text not null,         -- IIIF info.json URL
    waypoints jsonb not null default '[]',
    cover_thumbnail text,
    view_count integer default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    published_at timestamptz
  );

  create index idx_stories_status on stories(status);
  create index idx_stories_author on stories(author_cookie_id);
  create index idx_stories_published on stories(published_at desc) where status = 'published';

  -- RLS disabilitata — i permessi sono gestiti nelle API routes Next.js
  -- TODO: @fase-futura — migrare a RLS nativo Supabase (vedi sezione apposita in fondo)
  ```

  Salva il file SQL in `supabase/migrations/001_init.sql` e committalo.

- **Criterio completamento**: progetto avviabile con `pnpm dev`, CI verde su GitHub, Supabase connesso, preview Vercel funzionante

---

## Fase 1 — Museum API Aggregator e Transformer (Settimane 1-2)

- [x] Implementare i 5 adapter museali in `lib/museums/`:

  **Chicago** (`chicago.ts`):
  - Search: `https://api.artic.edu/api/v1/artworks/search`
  - Params: `q`, `fields` (seleziona solo i campi necessari), `limit`, `page`
  - IIIF: `https://www.artic.edu/iiif/2/{image_id}/info.json`
  - Manifest: `https://api.artic.edu/api/v1/artworks/{id}/manifest.json`
  - Filtro solo dipinti: `query.term.classification_title: "Painting"` + `query.term.is_public_domain: true`
  - Doc: https://api.artic.edu/docs/

  **Rijksmuseum** (`rijksmuseum.ts`):
  - Search: Linked Art Search API — `https://data.rijksmuseum.nl/search` (no key)
  - IIIF Image: `https://lh3.googleusercontent.com/...` o endpoint nativo
  - IIIF Manifest: `https://www.rijksmuseum.nl/api/iiif/{objectnumber}/manifest.json`
  - IIIF Discovery: `https://data.rijksmuseum.nl/api/iiif/changeDiscovery` per harvest bulk
  - Filtro tipo: `type=painting` nelle query Linked Art
  - Doc: https://data.rijksmuseum.nl/

  **National Gallery of Art** (`nga.ts`):
  - Search: `https://api.nga.gov/art/tms/objects` (pubblica, no key)
  - IIIF: `https://api.nga.gov/iiif/{uuid}/info.json`
  - Filtro: `classification=Painting` + `hasImage=true`
  - Open data su GitHub: https://github.com/NationalGalleryOfArt/opendata
  - Doc: https://api.nga.gov/

  **Wellcome Collection** (`wellcome.ts`):
  - Search: `https://api.wellcomecollection.org/catalogue/v2/works`
  - Params: `query`, `workType=k` (k = pictures/artworks), `pageSize`, `page`
  - IIIF Image: estratto dai manifest linkati nella risposta API
  - IIIF Manifest: campo `thumbnail.url` → costruisci manifest URL
  - Doc: https://developers.wellcomecollection.org/docs/catalogue
  - Nota: il catalogo include anche materiale non-pittorico — filtra per `workType=k` e verifica presenza `thumbnail`

  **Yale Center for British Art** (`ycba.ts`):
  - Accesso: OAI-PMH + IIIF manifests (nessuna REST search in tempo reale)
  - OAI-PMH endpoint: `https://collections.britishart.yale.edu/oai?verb=ListRecords&metadataPrefix=oai_dc&set=Paintings`
  - IIIF Manifest: `https://manifests.collections.yale.edu/ycba/obj/{id}`
  - Strategia: **harvest una tantum** via OAI-PMH → salva lista opere in cache (`unstable_cache` o file statico), poi filtra in-memory. Non è real-time ma è sufficiente per il progetto.
  - Doc: https://britishart.yale.edu/collections-data-sharing

- [x] Implementare il **transformer** (`lib/museums/transformer.ts`):
  - Ogni adapter implementa `MuseumAdapter`
  - `transformToUnified()` mappa i campi specifici dell'API in `UnifiedArtwork`
  - Gestisci edge case: artista sconosciuto → `"Anonimo"`, date mancanti → `""`, `iiifInfoUrl` assente → scarta l'opera
  - Filtra obbligatoriamente le opere senza `iiifInfoUrl`: questo progetto richiede IIIF per il viewer

- [x] Implementare le **API routes**:
  - `GET /api/museums/search` — aggrega tutti i musei in parallelo (`Promise.allSettled`), timeout 5s per provider, cache 1h
  - `GET /api/museums/artwork/[id]` — parse del prefix (`chicago_12345` → adapter Chicago con id `12345`)

- [x] Caching:
  - `revalidate = 3600` a livello di route segment per search e artwork
  - Per YCBA: `unstable_cache` con TTL 24h per l'harvest OAI-PMH

- **Criterio completamento**: `GET /api/museums/search?q=rembrandt&limit=20` restituisce risultati da almeno 3 musei in formato `UnifiedArtwork` unificato

---

## Fase 2 — Gallery UI (Settimane 2-3)

- [ ] Homepage (`src/app/page.tsx`):
  - Header con logo e titolo
  - Barra di ricerca testuale con debounce 300ms
  - Filtri: chip per museo (multi-select), contatore risultati

- [ ] **Masonry layout** (`<ArtworkGallery />`):
  - CSS columns Tailwind: `columns-2 md:columns-3 lg:columns-4 xl:columns-5`
  - `break-inside-avoid` su ogni card
  - Fade-in staggered con GSAP `stagger`

- [ ] **Artwork Card** (`<ArtworkCard />`):
  - Immagine lazy (`loading="lazy"`)
  - Overlay hover: titolo, artista, badge museo
  - Skeleton shimmer durante caricamento
  - Click → `/artwork/[id]`

- [ ] **Infinite scroll** con `useInfiniteQuery` (TanStack Query):
  - Intersection Observer su elemento sentinella
  - Reset query su cambio filtri o ricerca

- **Criterio completamento**: gallery con 100+ opere da 3+ musei, masonry fluido, infinite scroll, filtro per museo funzionante

---

## Fase 3 — Pagina dettaglio opera e avvio editor (Settimana 3-4)

- [ ] Pagina `/artwork/[id]` con viewer OpenSeadragon + metadati + CTA "Crea una storia"
- [ ] Input IIIF custom: campo per URL `info.json` da fonti esterne, con validazione
- [ ] **Cookie autore anonimo** (`src/lib/cookies/author.ts` + `src/hooks/useAnonymousAuthor.ts`):
  - Genera UUID v4 al primo accesso, salva in cookie `author_id` (`maxAge: 365d`, `sameSite: lax`)
  - Hook `useAnonymousAuthor()` restituisce `{ cookieId, displayName, setDisplayName }`
  - Nome display opzionale salvato in localStorage

- **Criterio completamento**: pagina dettaglio con viewer funzionante, pulsante "Crea storia" naviga all'editor con l'artwork precaricato

---

## Fase 4 — Core Viewer e navigazione animata (Settimana 4-5)

- [ ] `<GigapixelViewer />` wrapper di OpenSeadragon
- [ ] Hook `useViewer`:
  - `goToViewport(rect, duration, easing)` — animazione via GSAP
  - `getCurrentViewport()` — restituisce la vista corrente
  - `captureViewport()` — snapshot via `canvas.toDataURL()`
- [ ] Hook `useStory`: `currentWaypointIndex`, `isPlaying`, `next()`, `prev()`, `play()`, `pause()`
- [ ] `<StoryPlayer />`:
  - Overlay testo (bottom), indicatore progresso (dots), controlli play/pausa/avanti/indietro
  - Keyboard: frecce, spazio — Touch: swipe
- [ ] Transizioni fluide:
  - Se zoom cambia >3x: transizione 2-step (zoom out → pan → zoom in)
  - Durata proporzionale alla distanza (0.8s–3s)

- **Criterio completamento**: storia di 5 waypoint navigabile con animazioni fluide

---

## Fase 5 — Editor autoriale (Settimane 5-6)

- [ ] Pagina `/editor/[artworkId]` split-screen: viewer 60% / pannello 40%
- [ ] Lista waypoint drag-and-drop (`@dnd-kit/sortable`): card con thumbnail + testo + durata
- [ ] Pulsante "Cattura vista" → crea waypoint con viewport corrente
- [ ] Editor testo Tiptap (toolbar: bold, italic, link)
- [ ] Configurazione waypoint: durata (slider 1-15s), transizione (select)
- [ ] **Salvataggio bozza su Supabase**:
  - Prima apertura: `POST /api/stories` → crea bozza `draft`
  - Autosave ogni 30s: `PUT /api/stories/[id]`
  - Il cookie `author_cookie_id` viene passato nell'header `x-author-cookie-id`
  - L'API route confronta l'header con `author_cookie_id` del record prima di ogni write
  - Indicatore stato: "Salvato ✓" / "Salvando…" / "Non salvato ⚠️"
- [ ] **Pulsante "Pubblica"**:
  - Validazione: almeno 2 waypoint, titolo non vuoto
  - Dialog di conferma → `PUT /api/stories/[id]` con `status: 'published'`
  - Mostra link `/story/[id]` con pulsante copia
- [ ] **Le mie bozze**: lista filtrata per `author_cookie_id`, riapre l'editor, elimina

- **Criterio completamento**: flusso completo crea → salva → pubblica → link funzionante

---

## Fase 6 — Fruizione pubblica e pagina storie (Settimane 6-7)

- [ ] Pagina `/story/[id]`: fullscreen viewer + testo, carica solo storie `published`, 404 se draft
- [ ] `generateMetadata()` per Open Graph (titolo, descrizione, thumbnail primo waypoint)
- [ ] Incrementa `view_count` via `UPDATE` atomico
- [ ] Pagina `/stories`: grid masonry di card storie pubblicate, filtri per museo e ordinamento
- [ ] Link condivisibile: pulsante copia URL, share su X/WhatsApp (URL-based, no SDK)
- [ ] Accessibilità: `aria-live="polite"` sul testo waypoint, focus management, alt text immagini

- **Criterio completamento**: flusso end-to-end gallery → opera → editor → pubblica → fruizione pubblica con link condivisibile

---

## Fase 7 — AI assistant (Settimana 8, opzionale)

- [ ] API route `/api/ai/suggest`: riceve crop base64 + metadati opera → chiama LLM → restituisce testo suggerito
- [ ] UI: pulsante "✨ Suggerisci testo" nell'editor di ogni waypoint
- [ ] "Auto-story": LLM suggerisce 5-8 waypoint analizzando l'opera
- [ ] Text-to-speech con Web Speech API (opzionale)

- **Criterio completamento**: "suggerisci testo" produce testi ragionevoli per 3 opere diverse

---

## Fase 8 — Polish, demo, documentazione (Settimana 9)

- [ ] Creare 3-5 storie demo pre-pubblicate (Rembrandt/Rijksmuseum, opera NGA, opera Chicago)
- [ ] Video demo 2 minuti
- [ ] README finale con screenshot e GIF animate
- [ ] Aggiornare `API.md` con tutti gli endpoint
- [ ] `CONTRIBUTING.md` e issue templates GitHub
- [ ] Verificare accessibilità (Lighthouse score ≥ 90)
- [ ] Pubblicazione GitHub pubblica + MIT license

---

## Fase futura — Migrazione a RLS nativo Supabase

Attualmente le autorizzazioni su bozze e storie sono gestite nelle API routes Next.js, che controllano manualmente il cookie `author_cookie_id` prima di ogni operazione di scrittura. Questo è sufficiente per ora ma meno robusto di RLS.

Quando il progetto matura, migrare a:

```sql
-- Abilita RLS
alter table stories enable row level security;

-- Storie pubblicate: leggibili da tutti
create policy "Storie pubbliche leggibili da tutti"
  on stories for select
  using (status = 'published');

-- Bozze: leggibili solo dall'autore tramite header custom
create policy "Bozze leggibili solo dall'autore"
  on stories for select
  using (
    status = 'draft'
    and author_cookie_id = (current_setting('request.headers', true)::json->>'x-author-cookie-id')
  );

create policy "Chiunque può creare storie"
  on stories for insert with check (true);

create policy "Solo l'autore può modificare"
  on stories for update
  using (author_cookie_id = (current_setting('request.headers', true)::json->>'x-author-cookie-id'));

create policy "Solo l'autore può eliminare"
  on stories for delete
  using (author_cookie_id = (current_setting('request.headers', true)::json->>'x-author-cookie-id'));
```

**Prerequisito**: testare che il client Supabase passi correttamente l'header `x-author-cookie-id` a ogni request. Supabase supporta header custom tramite `createClient` con `global.headers`.
