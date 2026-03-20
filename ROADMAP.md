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

  type MuseumProvider = 'chicago' | 'rijksmuseum' | 'wellcome' | 'ycba';

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

- [x] Implementare i 4 adapter museali in `lib/museums/`:

  **Chicago** (`chicago.ts`):
  - Search: `https://api.artic.edu/api/v1/artworks/search`
  - Params: `q`, `fields` (seleziona solo i campi necessari), `limit`, `page`
  - IIIF: `https://www.artic.edu/iiif/2/{image_id}/info.json`
  - Manifest: `https://api.artic.edu/api/v1/artworks/{id}/manifest.json`
  - Filtro solo dipinti: `query.term.classification_title: "Painting"` + `query.term.is_public_domain: true`
  - Doc: https://api.artic.edu/docs/

  **Rijksmuseum** (`rijksmuseum.ts`) — architettura Data Services 2025:
  - Search: `https://data.rijksmuseum.nl/search/collection?type=painting&title={query}`
  - Metadati: OAI-PMH GetRecord → `https://data.rijksmuseum.nl/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier=...`
  - IIIF: Micrio — `https://iiif.micr.io/{micrioId}/info.json`
  - Doc: https://data.rijksmuseum.nl/docs/iiif/image

  **Wellcome Collection** (`wellcome.ts`):
  - Search: `https://api.wellcomecollection.org/catalogue/v2/works`
  - Params: `query`, `workType=k` (k = pictures/artworks), `pageSize`, `page`
  - IIIF Image: estratto dai manifest linkati nella risposta API
  - IIIF Manifest: campo `thumbnail.url` → costruisci manifest URL
  - Doc: https://developers.wellcomecollection.org/docs/catalogue
  - Nota: il catalogo include anche materiale non-pittorico — filtra per `workType=k` e verifica presenza `thumbnail`

  **Yale Center for British Art** (`ycba.ts`):
  - Accesso: IIIF Presentation API 3 (OAI-PMH dismesso nel 2023)
  - IIIF Manifest: `https://manifests.collections.yale.edu/ycba/obj/{id}`
  - Strategia: fetch parallelo di ~40 manifest da ID noti → cache 24h (`unstable_cache`), filtro in-memory
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

- **Criterio completamento**: ✅ `GET /api/museums/search?q=portrait&limit=20` restituisce risultati da **4 musei** (Chicago, Rijksmuseum, Wellcome, YCBA) in formato `UnifiedArtwork` unificato

---

## Fase 2 — Gallery UI (Settimane 2-3)

- [x] Homepage (`app/page.tsx`):
  - Header con logo e titolo
  - Barra di ricerca testuale con debounce 300ms
  - Filtri: chip per museo (multi-select), contatore risultati

- [x] **Masonry layout** (`<ArtworkGallery />`):
  - CSS columns Tailwind: `columns-2 md:columns-3 lg:columns-4 xl:columns-5`
  - `break-inside-avoid` su ogni card
  - Fade-in con GSAP al mount di ogni card (stagger naturale dall'ordine di rendering)

- [x] **Artwork Card** (`<ArtworkCard />`):
  - `next/image fill unoptimized` con container aspect-ratio
  - Overlay hover: titolo, artista, badge museo (CSS puro)
  - Skeleton shimmer durante caricamento immagine
  - Click → `/artwork/[id]`

- [x] **Infinite scroll** con `useInfiniteQuery` (TanStack Query v5):
  - IntersectionObserver su sentinel sempre nel DOM (non dentro early return)
  - Reset automatico al cambio query/filtri grazie alla queryKey di TanStack Query
  - `fetchNextPage()` è no-op se `hasNextPage=false` — nessuna guardia esplicita necessaria
  - **⚠️ TODO: rivedere** — comportamento del sentinel, gestione errori durante i batch successivi, UX edge case da verificare

- [x] **Providers** (`app/providers.tsx`): QueryClientProvider con `staleTime: 60s`

- **Criterio completamento**: ✅ gallery con opere da 4 musei, masonry fluido, infinite scroll, filtro per museo funzionante

---

## Fase 3 — Pagina dettaglio opera e avvio editor (Settimana 3-4)

- [x] Pagina `/artwork/[id]` con viewer OpenSeadragon + metadati + CTA "Crea una storia"
- [x] Input IIIF custom: campo per URL `info.json` da fonti esterne, con validazione
- [x] **Cookie autore anonimo** (`src/lib/cookies/author.ts` + `src/hooks/useAnonymousAuthor.ts`):
  - Genera UUID v4 al primo accesso, salva in cookie `author_id` (`maxAge: 365d`, `sameSite: lax`)
  - Hook `useAnonymousAuthor()` restituisce `{ cookieId, displayName, setDisplayName }`
  - Nome display opzionale salvato in localStorage

- **Criterio completamento**: ✅ pagina dettaglio con viewer funzionante, pulsante "Crea storia" naviga all'editor con l'artwork precaricato

---

## Fase 4 — Core Viewer e navigazione animata (Settimana 4-5)

- [x] `<GigapixelViewer />` wrapper di OpenSeadragon
- [x] Hook `useViewer`:
  - `goToViewport(rect, duration, easing)` — animazione via OSD nativo (`fitBoundsWithConstraints`)
  - `getCurrentViewport()` — restituisce la vista corrente
  - `captureViewport()` — snapshot via `canvas.toDataURL()`
- [x] Hook `useStory`: `currentWaypointIndex`, `isPlaying`, `next()`, `prev()`, `play()`, `pause()`
- [x] `<StoryPlayer />`:
  - Overlay testo (bottom), indicatore progresso (dots), controlli play/pausa/avanti/indietro
  - Keyboard: frecce, spazio — Touch: swipe
- [x] Transizioni fluide:
  - Se zoom cambia >3x: transizione 2-step (union bounding box → target)
  - Durata proporzionale alla distanza (0.8s–3s)

- **Criterio completamento**: ✅ storia di 6 waypoint navigabile con animazioni fluide (demo: La Ronda di Notte)

---

## Fase 5 — Editor autoriale (Settimane 5-6)

- [x] Pagina `/editor/[artworkId]` split-screen: viewer 60% / pannello 40%
- [x] Lista waypoint drag-and-drop (`@dnd-kit/sortable`): card con thumbnail + testo + durata
- [x] Pulsante "Cattura vista" → crea waypoint con viewport corrente + thumbnail canvas
- [x] Editor testo Tiptap v3 (toolbar: bold, italic, link)
- [x] Configurazione waypoint: durata (slider 1-15s), transizione (select ease/spring/linear)
- [x] **Salvataggio bozza su Supabase**:
  - Prima save: `POST /api/stories` → crea bozza `draft`
  - Autosave ogni 30s: `PUT /api/stories/[id]`
  - Header `x-author-cookie-id` su ogni write — API route verifica prima di aggiornare
  - Hook `useEditorAutosave` gestisce il ciclo di vita: storyId, saveStatus, save, markUnsaved
  - Indicatore stato: "✓ Salvato" / "↺ Salvando…" / "● Non salvato" / "⚠ Errore"
- [x] **Pulsante "Pubblica"** (`PublishDialog`):
  - Validazione client: titolo non vuoto + almeno 2 waypoint
  - `PUT /api/stories/[id]` con `status: 'published'` (validazione anche server-side)
  - Post-pubblicazione: link `/story/[id]` con pulsante copia
- [x] **Le mie bozze** (`DraftsList`): overlay laterale, riapri (`?storyId=`), elimina
- [x] API routes: `POST /api/stories`, `PUT /api/stories/[id]`, `DELETE /api/stories/[id]`
  - AUTH: tutte le write verificano `x-author-cookie-id` contro `author_cookie_id` del record

- **Criterio completamento**: ✅ flusso completo crea → cattura → scrivi → salva → pubblica → link funzionante

---

## Fase 6 — Fruizione pubblica e pagina storie (Settimane 6-7)

- [x] Pagina `/story/[id]`: fullscreen viewer + testo, carica solo storie `published`, 404 se draft
- [x] `generateMetadata()` per Open Graph (titolo, descrizione, thumbnail primo waypoint)
- [x] Incrementa `view_count` via RPC atomica (`increment_view_count`) — fire and forget
- [x] Pagina `/stories`: grid masonry di card storie pubblicate, filtri per museo e ordinamento
- [x] API route `GET /api/stories` (listing con filtri provider/sort) + `GET /api/stories/[id]`
- [x] Link condivisibile: pulsante copia URL, share su X/WhatsApp (URL-based, no SDK)
- [x] Accessibilità: `aria-live="polite"` + `aria-atomic` sul testo waypoint in `StoryPlayer`
- [x] Migrazione `002_grants.sql`: GRANT espliciti per il ruolo `anon` su tabella e RPC
  - **Nota**: eseguire `002_grants.sql` su Supabase SQL Editor per risolvere "permission denied"

- **Criterio completamento**: ✅ flusso gallery → opera → fruizione pubblica con link condivisibile (editor Fase 5 ancora da completare per il flusso create → publish)

---

## Fase 7 — AI assistant (Settimana 8, opzionale)

- [x] `lib/ai/client.ts`: client generico OpenAI-compatible via fetch nativo (Groq, OpenAI, Ollama, OpenRouter)
- [x] Configurazione tramite env: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — zero dipendenze extra
- [x] API route `POST /api/ai/suggest`: metadati opera + posizione waypoint → testo narrativo suggerito
- [x] API route `POST /api/ai/auto-story`: metadati opera → array di 3-8 `{ title, text }` per l'intera storia
- [x] UI: pulsante "✦ Suggerisci" nel WaypointEditor — sostituisce il testo nel Tiptap editor
- [x] UI: pulsante "✦ Auto-story" nell'EditorShell — pannello preview con tutti i waypoint generati → "Applica tutti"
- [ ] Text-to-speech con Web Speech API (opzionale — rimandato)

- **Criterio completamento**: ✅ "suggerisci testo" produce testi ragionevoli su Groq free tier; auto-story genera 6 waypoint coerenti
- **Nota**: vedi [AI.md](AI.md) per dettagli di configurazione, flusso e scelte architetturali

---

## Fase 9 — AI: Connessioni nascoste tra opere (Settimane 10-12)

### Contesto e filosofia

L'AI qui non genera contenuto — scopre relazioni. Quando il curatore seleziona un dettaglio in un waypoint, il sistema cerca visualmente dettagli simili in tutte le opere della gallery. Questo trasforma la piattaforma da "racconta un'opera" a "racconta le connessioni tra le opere", che è ciò che fanno i grandi curatori.

Fonti di ispirazione:

- [MosAIc (MIT CSAIL + Microsoft)](https://news.mit.edu/2020/algorithm-finds-hidden-connections-between-paintings-met-museum-0729)
- [Met Art Explorer network graph](https://www.metmuseum.org/perspectives/met-microsoft-mit-exploring-art-open-access-ai-whats-next)
- [Algorithmic Ways of Seeing (arXiv)](https://arxiv.org/html/2403.19174v1)
- [Visual link retrieval in painting datasets](https://link.springer.com/article/10.1007/s11042-020-09995-z)

### 9.1 — Generazione embedding per le opere in gallery

- [x] Scegliere il modello per gli embedding visivi:
  - **Scelta**: `@xenova/transformers` (Transformers.js, ONNX Runtime Web) — stesso modello offline e browser
  - Modello: `Xenova/clip-vit-base-patch32` — vettori 512 dimensioni, fp32, normalizzati L2
  - Privacy by design: il crop non lascia mai il browser; zero costi server; offline-capable
  - Vedi [AI.md](AI.md) per il confronto dettagliato con HF Inference API e pgvector
- [x] Pipeline di indicizzazione (`pnpm generate:embeddings`):
  1. Fetch ~2000 opere dalla gallery (Chicago/Wellcome/YCBA: 250 a museo; Rijksmuseum: tutte via cursor pagination)
  2. Per ogni opera: scarica thumbnail, genera embedding CLIP (`quantized: false`)
  3. Salva in `public/data/embeddings.json`: array di `EmbeddingEntry { artworkId, embedding: number[512], provider, title, artist, thumbnailUrl }`
  - Dimensione tipica: ~4-8MB per 2000 opere — gestibile come file statico Next.js
  - Rijksmuseum: cursor pagination nativa (`next` URL) — indicizza TUTTE le opere (1000-3000)
- [x] `lib/ai/similarity.ts`: tipi `EmbeddingEntry`, `SimilarityResult`; `cosineSimilarity()` (dot product su vettori normalizzati); `findTopK()` brute-force O(n×d)

### 9.2 — Ricerca per similarità visiva da un dettaglio

- [x] `hooks/useSimilarity.ts`: hook browser che gestisce l'intero ciclo di vita
  - Singletons di modulo per modello CLIP e indice embedding (caricati una volta per sessione)
  - `ensureReady()`: dynamic import `@xenova/transformers` + fetch `/data/embeddings.json` in parallelo
  - `findSimilar(imageBase64, k, excludeId)`: genera embedding query → `findTopK()` → top-k risultati
  - Status: `idle | loading-model | loading-index | ready | searching | error`
- [x] `next.config.ts`: webpack alias `sharp: false`, `onnxruntime-node: false` per il bundle browser

### 9.3 — UI "Connessioni visive" nell'editor

- [x] Pannello espandibile "Connessioni visive" nel `WaypointEditor`:
  - Visibile solo se il waypoint ha `thumbnailDataUrl` (crop disponibile)
  - Al click: chiama `onFindSimilar(thumbnailDataUrl)` → loading state
  - Risultati: griglia 2 colonne con thumbnail, titolo, artista, provider badge, score %
  - Toggle: secondo click nasconde il pannello
- [x] `EditorShell`: instanzia `useSimilarity()`, passa `handleFindSimilar` e `handleExplainConnection` come prop al `WaypointEditor`
- [x] API route `POST /api/ai/explain-connection`: titolo+artista delle due opere + similarity score → 1-2 frasi in italiano
  - Prompt calibrato sul similarity score: alta (≥0.85) / significativa (≥0.70) / sottile (<0.70)
  - Risposta: `{ explanation: string }`
- [x] UI: pulsante "✦ Spiega connessione" per ogni card risultato — genera la spiegazione inline
- [ ] Nel player (`StoryPlayer`): layout split per waypoint di tipo "connection" (opera corrente + opera connessa)
- [ ] Tipo waypoint esteso per le connessioni (opzionale — da valutare in fase 8 polish)

### 9.4 — Pagina "Esplora connessioni" (bonus)

- [ ] Nuova pagina `/explore`: grafo visuale (D3 force-directed) delle opere più simili
  - Ogni nodo = un'opera, archi = similarità > soglia configurabile
  - Click su arco → affiancamento delle due opere con score
  - Ispirazione: Met Art Explorer network graph
- [ ] Pura esplorazione visiva, nessun authoring richiesto
- [ ] "Wow factor" per il portfolio: connessioni tra migliaia di opere di 4 musei diversi

### 9.5 — Documentazione e demo

- [ ] Sezione "Connessioni nascoste" nel README
- [ ] Screenshot/GIF del pannello connessioni nell'editor e del grafo `/explore`
- [ ] Nota esplicita: "L'AI non genera narrativa — identifica relazioni visive. La narrazione resta nelle mani del curatore."

### Stack aggiuntivo per questa fase

| Tecnologia                  | Uso                                                        | Stato          |
| --------------------------- | ---------------------------------------------------------- | -------------- |
| `@xenova/transformers`      | Embedding CLIP offline (script) + browser (hook)           | ✅ Installato  |
| `pgvector` (Supabase)       | Alternativa scalabile a file statico — non usato (n≤2000)  | Non necessario |
| `comlink`                   | Web Worker ergonomico — non necessario (~10ms brute-force) | Non necessario |
| `d3-force` + `d3-selection` | Grafo `/explore`                                           | 🔜 Fase 9.4    |

### Criterio completamento

- L'utente cattura un waypoint → riceve 4-8 opere visivamente simili in < 3 secondi
- Può aggiungere una connessione alla storia → nel player appare il confronto visivo affiancato
- La pagina `/explore` mostra un grafo navigabile delle connessioni tra opere

---

## Fase 8 — Polish, demo, documentazione (Settimana 9)

- [x] Demo story "La Ronda di Notte" (Rembrandt/Rijksmuseum) — 6 waypoint, inserita con `pnpm seed:demo`
- [ ] Aggiungere storie demo per Wellcome e Chicago
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
