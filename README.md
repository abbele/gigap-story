# Gigapixel Storyteller

**[gigap-story.vercel.app](https://gigap-story.vercel.app)**

## Cos'è

Gigapixel Storyteller è una piattaforma web open source per creare e fruire narrazioni visive guidate all'interno di dipinti ad altissima risoluzione (gigapixel). Aggrega opere da 4 musei internazionali in una gallery unificata, e permette a chiunque di scegliere un'opera e costruirci sopra un percorso narrativo animato — zoomando nei dettagli, raccontando storie, e pubblicandolo per il mondo.

## A chi è rivolto

### Utenti finali (fruizione)

- **Appassionati d'arte** che vogliono esplorare un'opera come mai prima, guidati da una narrazione
- **Studenti** di storia dell'arte che studiano le opere nei dettagli
- **Visitatori virtuali** di musei che non possono recarsi fisicamente sul posto
- **Persone con disabilità motorie** che beneficiano di una fruizione digitale ricca e accessibile

### Utenti autori (creazione)

- **Curatori museali** che vogliono creare esperienze digitali senza scrivere codice
- **Docenti** di storia dell'arte che preparano lezioni interattive
- **Divulgatori culturali** (blogger, influencer, giornalisti) che creano contenuti su opere d'arte
- **Restauratori** che documentano un intervento guidando lo spettatore nei dettagli

## Perché esiste

Le immagini gigapixel dei dipinti sono straordinarie ma restano confinate in viewer statici dove l'utente zooma a caso senza contesto. Il potenziale narrativo è enorme: ogni dettaglio ha una storia. Questo tool trasforma il dato grezzo in esperienza culturale.

## Flusso utente

### 1. Esplora la Gallery

La homepage presenta una gallery masonry di opere aggregate da 4 musei. Puoi filtrare per museo, artista, epoca, tecnica. Scroll infinito. Ogni card mostra: immagine, titolo, artista, museo di provenienza.

### 2. Scegli un'opera

Click su una card → pagina dettaglio opera con viewer gigapixel. Da qui puoi:

- Esplorare liberamente con zoom e pan
- Cliccare "Crea una storia" per entrare nell'editor

### 3. Oppure: incolla un link IIIF

Se hai un'immagine IIIF da un'altra fonte (es: un museo che non è nella gallery), puoi incollare l'URL `info.json` e iniziare da lì.

### 4. Crea la storia

Editor split-screen: viewer a sinistra, pannello a destra. Naviga, cattura viste, scrivi i testi, riordina i waypoint.

### 5. Salva come bozza o pubblica

- **Bozza**: salvata su Supabase, associata al tuo browser (cookie anonimo). Visibile solo a te.
- **Pubblica**: la storia diventa pubblica, ottieni un link condivisibile `/story/[id]` e appare nella pagina "Storie".

### 6. Esplora le storie degli altri

Pagina `/stories` con tutte le storie pubblicate. Filtri per opera, museo, autore, più recenti.

## Architettura dati

### API Musei (aggregazione)

Tutti i musei offrono API pubbliche senza autenticazione e supporto IIIF nativo. Il backend (Next.js API routes) aggrega e normalizza i dati in un formato unificato.

| Museo                       | API                           | Auth | IIIF    | Stato |
| --------------------------- | ----------------------------- | ---- | ------- | ----- |
| Art Institute of Chicago    | REST + Elasticsearch          | No   | Sì (v2) | ✅    |
| Rijksmuseum                 | Search API + OAI-PMH + Micrio | No   | Sì      | ✅    |
| Wellcome Collection         | Catalogue REST                | No   | Sì      | ✅    |
| Yale Center for British Art | IIIF Manifest + cache 24h     | No   | Sì      | ✅    |

> Vedi [MUSEUMS.md](MUSEUMS.md) per la spiegazione dettagliata di ogni protocollo e la guida all'aggiunta di nuovi musei.

### Persistenza (Supabase)

- **Storie**: tabella `stories` con JSON dei waypoint, metadati, stato (draft/published)
- **Bozze**: legate a un `author_cookie_id` (cookie anonimo, no login richiesto)
- **Autorizzazioni**: gestite nelle API routes Next.js (no RLS nativo — vedi ROADMAP per la migrazione futura)
- **Immagini**: nessun upload — le immagini restano sui server IIIF dei musei

## Tecnologie

| Categoria              | Scelta                                                       |
| ---------------------- | ------------------------------------------------------------ |
| Framework              | Next.js 16 (App Router) + React 19                           |
| Linguaggio             | TypeScript 5                                                 |
| Package manager        | pnpm                                                         |
| CSS                    | Tailwind CSS v4                                              |
| Componenti             | Custom (no component library)                                |
| Viewer gigapixel       | OpenSeadragon                                                |
| Animazioni transizioni | GSAP                                                         |
| Data fetching          | TanStack Query (React Query)                                 |
| Editor testo           | Tiptap                                                       |
| AI (opzionale)         | Qualsiasi provider OpenAI-compatible (Groq, OpenAI, Ollama…) |
| Drag & drop            | @dnd-kit/sortable                                            |
| Database               | Supabase (PostgreSQL)                                        |
| Deploy                 | Vercel                                                       |
| CI/CD                  | GitHub Actions                                               |
| Repo                   | GitHub (MIT)                                                 |

## Viewer gigapixel — ottimizzazioni OpenSeadragon

Il viewer è gestito da `hooks/useViewer.ts`. I parametri OSD sono stati calibrati per massimizzare la fluidità delle animazioni:

| Parametro           | Valore                 | Perché                                                                                                                                          |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `springStiffness`   | `6.5`                  | Molla più morbida rispetto al default (12): nessun rimbalzo, transizioni che sembrano fisicamente naturali                                      |
| `animationTime`     | `0.5`                  | Reattivo senza essere brusco — 1s era percepito come lento, 0.5s è il punto di equilibrio                                                       |
| `blendTime`         | `0.15`                 | Fade-in delle tile durante il caricamento: evita il flicker dei quadranti che appaiono di scatto                                                |
| `crossOriginPolicy` | `'Anonymous'`          | Obbligatorio per IIIF cross-origin (AIC, Wellcome, Rijksmuseum) — senza questo il canvas è tainted e `captureViewport` fallisce silenziosamente |
| `visibilityRatio`   | `0.3`                  | L'utente può pannare fino ai bordi dell'immagine senza che OSD rimbalzi al centro                                                               |
| `minZoomImageRatio` | `0.5`                  | Impedisce di zoomare così tanto da vedere solo sfondo nero attorno all'immagine                                                                 |
| `dblClickToZoom`    | `true` (mouse + touch) | Zoom rapido con doppio click/tap, comportamento atteso su gigapixel viewer                                                                      |
| `flickEnabled`      | `true` (touch)         | Pan con inerzia su mobile — sensazione nativa simile a Google Maps                                                                              |

### Transizione a 2 step

Quando il rapporto di zoom tra posizione corrente e destinazione supera 3×, `goToViewport` usa una strategia a 2 step invece di animare direttamente:

1. **Step 1**: zoom out fino al bounding box dell'unione tra posizione corrente e target — l'utente capisce dove sta andando
2. **Step 2** (dopo ≥650ms): zoom in sul target — arriva nel posto giusto con contesto

Questo evita il "teletrasporto disorientante" quando si salta tra waypoint lontani o a scale molto diverse. Il minimo di 650ms è calibrato sull'`animationTime: 0.5` (la molla ha bisogno di ~500ms + buffer per stabilizzarsi prima di partire con il secondo movimento).

### Thumbnail JPEG vs PNG

`captureViewport` produce le thumbnail dei waypoint in JPEG 0.7 anziché PNG. Un'immagine PNG della vista corrente pesa ~400KB in base64; JPEG 0.7 scende a ~30-50KB con qualità visivamente identica per una card. Questo previene un `RangeError: Invalid string length` nel logger del dev server di Next.js, che crasha quando accumula entries con payload troppo grandi.

## Protocolli e standard

- **IIIF Image API 2/3** per il rendering delle immagini
- **IIIF Presentation API 3.0** come formato di riferimento per i manifest
- **W3C Web Annotation Data Model** per le annotazioni
- **OpenSeadragon** come engine di rendering gigapixel
- **OAI-PMH** per i metadati Rijksmuseum (Data Services 2025)

## Quick start

### Prerequisiti

- Node.js 20.9+
- pnpm (`npm install -g pnpm`)
- Un progetto Supabase (free tier su [supabase.com](https://supabase.com))

Nessuna API key museale richiesta — tutti i musei supportati offrono accesso pubblico.

### Setup

```bash
git clone https://github.com/[tuo-username]/gigap-story.git
cd gigap-story
pnpm install
```

Crea `.env.local` nella root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Esegui le migration SQL su Supabase (vedi `supabase/migrations/`) **nell'ordine corretto**:

1. `001_init.sql` — crea la tabella `stories` e la funzione `increment_view_count`
2. `002_grants.sql` — concede i permessi al ruolo `anon` (necessario per lettura/scrittura)

Per abilitare il modulo AI (facoltativo), aggiungi a `.env.local`:

```env
AI_BASE_URL=https://api.groq.com/openai/v1   # default — Groq è gratuito
AI_API_KEY=gsk_...                            # API key del provider scelto
AI_MODEL=llama-3.1-8b-instant                # default Groq; cambia per altri provider
```

> Vedi [AI.md](AI.md) per la lista completa dei provider supportati e il dettaglio del flusso.

### Connessioni visive — generare l'indice di embedding (Fase 9, opzionale)

Il pannello "Connessioni visive" nell'editor cerca opere simili al dettaglio catturato in ogni waypoint. Usa CLIP (`Xenova/clip-vit-base-patch32`) sia offline (script di indicizzazione) che nel browser — nessuna API key necessaria, tutto locale.

**Passo 1: genera l'indice**

```bash
pnpm generate:embeddings
```

Lo script:

1. Scarica il modello CLIP (~170MB, solo la prima volta, in cache a `~/.cache/huggingface`)
2. Recupera le opere dalla gallery (Chicago, Wellcome, YCBA: 250 a museo; Rijksmuseum: tutte, ~1000-3000)
3. Per ogni opera: scarica il thumbnail, genera un embedding CLIP da 512 dimensioni
4. Scrive il risultato in `public/data/embeddings.json`

Opzioni disponibili:

```bash
pnpm generate:embeddings --per-museum=500      # 500 opere per Chicago/Wellcome/YCBA
pnpm generate:embeddings --output=public/data/embeddings-small.json
```

**Stima tempi**: ~30 minuti per la configurazione default (250+250+250+Rijks ~1000). Il primo run scarica il modello (~3 min in più). Le run successive sono molto più veloci grazie alla cache.

**Passo 2: distribuisci il file**

Il file `public/data/embeddings.json` viene servito da Next.js come asset statico. Includilo nel commit (è generato offline) oppure generalo in CI. Dimensione tipica: ~4-8MB per 2000 opere (512 float32 × 4 bytes × n opere + metadati).

**Come funziona nel browser**

Al primo click su "Connessioni visive" di un waypoint:

1. Il modello CLIP viene scaricato dal CDN di Hugging Face (~170MB, poi in cache del browser)
2. L'indice `embeddings.json` viene caricato una volta sola in memoria
3. L'embedding del crop viene generato in ONNX Runtime Web (~1-2s)
4. Cosine similarity brute-force contro tutti gli embedding (~10ms per 2000 opere)
5. I top-8 risultati appaiono nel pannello

**Privacy**: il crop del waypoint non lascia mai il browser — CLIP gira in locale via ONNX Runtime Web.

> Vedi [AI.md](AI.md) per la descrizione architetturale completa, le scelte tecniche e le alternative valutate.

```bash
pnpm dev
```

Per inserire la storia demo pre-pubblicata (La Ronda di Notte):

```bash
# Richiede SUPABASE_SERVICE_ROLE_KEY in .env.local
pnpm seed:demo
```

Apri [http://localhost:3000](http://localhost:3000).

## Stato attuale

Le fasi 0–7 sono completate. La fase 9 (connessioni visive AI) è in corso.

| Componente                                             | Stato | Fase |
| ------------------------------------------------------ | ----- | ---- |
| API musei aggregata (`/api/museums/search`)            | ✅    | 1    |
| Gallery masonry con infinite scroll                    | ✅    | 2    |
| Ricerca testuale con debounce                          | ✅    | 2    |
| Filtri per museo (chip multi-select)                   | ✅    | 2    |
| Pagina dettaglio opera + viewer IIIF                   | ✅    | 3    |
| Hook `useViewer` + `useStory`                          | ✅    | 4    |
| `StoryPlayer` (overlay, keyboard, touch)               | ✅    | 4    |
| Demo story: La Ronda di Notte                          | ✅    | 8    |
| Pagina pubblica `/story/[id]` + OG tags                | ✅    | 6    |
| Listing `/stories` con filtri e masonry                | ✅    | 6    |
| API `/api/stories` (listing + singola)                 | ✅    | 6    |
| Condivisione: copia URL, X, WhatsApp                   | ✅    | 6    |
| Pagina editor `/editor/[artworkId]`                    | ✅    | 5    |
| Editor Tiptap (bold, italic, link)                     | ✅    | 5    |
| Waypoint DnD (`@dnd-kit/sortable`)                     | ✅    | 5    |
| Autosave 30s + indicatore stato                        | ✅    | 5    |
| Pubblicazione + link condivisibile                     | ✅    | 5    |
| Le mie bozze (riapri, elimina)                         | ✅    | 5    |
| AI: suggerisci testo waypoint (Groq / OpenAI / Ollama) | ✅    | 7    |
| AI: auto-story 6 waypoint con un click                 | ✅    | 7    |
| AI: indice CLIP + script `pnpm generate:embeddings`    | ✅    | 9    |
| AI: `useSimilarity` hook (CLIP nel browser)            | ✅    | 9    |
| AI: pannello "Connessioni visive" nell'editor          | ✅    | 9    |
| AI: spiegazione testuale connessione (Groq)            | ✅    | 9    |
| Pagina `/explore` — grafo connessioni                  | 🔜    | 9    |

## Struttura cartelle

```
app/
├── page.tsx                    # Homepage con Gallery
├── providers.tsx               # TanStack Query provider
├── artwork/[id]/page.tsx       # Dettaglio opera + viewer ✅
├── story/[id]/page.tsx         # Fruizione pubblica storia + OG ✅
├── stories/page.tsx            # Listing storie pubbliche ✅
├── editor/[artworkId]/page.tsx # Editor storia ✅
└── api/
    ├── museums/                # Aggregazione e normalizzazione musei ✅
    └── stories/                # GET listing + GET singola + POST + PUT + DELETE ✅
components/
├── gallery/                    # Gallery masonry, card, filtri, infinite scroll ✅
├── viewer/                     # GigapixelViewer, ArtworkDetailShell, StoryPlayer ✅
├── player/                     # StoryPublicShell (fruizione fullscreen) ✅
├── stories/                    # StoriesShell, StoryCard (listing /stories) ✅
└── editor/                     # EditorShell, WaypointList, TiptapEditor, dialogs ✅
hooks/
├── useMuseumSearch.ts          # useInfiniteQuery per la gallery ✅
├── useViewer.ts                # OpenSeadragon init, goToViewport, captureViewport ✅
├── useStory.ts                 # Playback waypoint, auto-advance, play/pause ✅
├── useAnonymousAuthor.ts       # Cookie autore anonimo, displayName localStorage ✅
├── useEditorAutosave.ts        # Autosave editor: POST bozza, PUT 30s, status ✅
└── useSimilarity.ts            # CLIP nel browser: carica modello + cerca opere simili ✅
lib/
├── museums/                    # Adapter e transformer per ogni museo ✅
├── supabase/                   # Client, queries, tipi DB ✅
├── ai/                         # client.ts (LLM), similarity.ts (tipi CLIP + cosine) ✅
└── cookies/                    # Gestione autore anonimo ✅
scripts/
├── seed-demo-stories.ts        # Inserisce la storia demo Ronda di Notte ✅
└── generate-embeddings.ts      # Script offline: genera public/data/embeddings.json ✅
public/data/
└── embeddings.json             # Indice CLIP: generato con pnpm generate:embeddings
supabase/migrations/
├── 001_init.sql                # Tabella stories + funzione increment_view_count ✅
└── 002_grants.sql              # GRANT permessi al ruolo anon ✅
types/
├── museum.ts                   # UnifiedArtwork, MuseumAdapter, ecc. ✅
└── story.ts                    # Waypoint, Story ✅
```

## Licenza

MIT

## Crediti e contesto

Questo progetto nasce nell'ambito delle Digital Humanities. Si ispira a Storiiies (Cogapp), Annona (NCSU Libraries), e al lavoro di storytelling IIIF presentato a Museums and the Web 2018. I dati delle opere provengono dalle API pubbliche dei rispettivi musei — ogni opera è attribuita e linkata alla fonte originale.
