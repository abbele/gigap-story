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

| Categoria              | Scelta                             |
| ---------------------- | ---------------------------------- |
| Framework              | Next.js 16 (App Router) + React 19 |
| Linguaggio             | TypeScript 5                       |
| Package manager        | pnpm                               |
| CSS                    | Tailwind CSS v4                    |
| Componenti             | Custom (no component library)      |
| Viewer gigapixel       | OpenSeadragon                      |
| Animazioni transizioni | GSAP                               |
| Data fetching          | TanStack Query (React Query)       |
| Editor testo           | Tiptap                             |
| Drag & drop            | @dnd-kit/sortable                  |
| Database               | Supabase (PostgreSQL)              |
| Deploy                 | Vercel                             |
| CI/CD                  | GitHub Actions                     |
| Repo                   | GitHub (MIT)                       |

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

Esegui le migration SQL su Supabase (vedi `supabase/migrations/`) poi:

```bash
pnpm dev
```

Apri [http://localhost:3000](http://localhost:3000).

## Stato attuale

| Componente                                  | Stato     |
| ------------------------------------------- | --------- |
| API musei aggregata (`/api/museums/search`) | ✅        |
| Gallery masonry con infinite scroll         | ✅        |
| Ricerca testuale con debounce               | ✅        |
| Filtri per museo (chip multi-select)        | ✅        |
| Pagina dettaglio opera + viewer IIIF        | 🚧 Fase 3 |
| Editor autoriale (waypoint, testi)          | 🚧 Fase 5 |
| Player narrazione pubblica                  | 🚧 Fase 6 |

## Struttura cartelle

```
app/
├── page.tsx                    # Homepage con Gallery
├── providers.tsx               # TanStack Query provider
├── artwork/[id]/page.tsx       # Dettaglio opera + viewer (Fase 3)
├── editor/[artworkId]/page.tsx # Editor storia (Fase 5)
├── story/[id]/page.tsx         # Fruizione pubblica storia (Fase 6)
├── stories/page.tsx            # Listing storie pubbliche (Fase 6)
└── api/
    ├── museums/                # Aggregazione e normalizzazione musei ✅
    └── stories/                # CRUD storie (Fase 5)
components/
├── gallery/                    # Gallery masonry, card, filtri, infinite scroll ✅
├── viewer/                     # OpenSeadragon wrapper e overlay (Fase 3-4)
├── editor/                     # Editor autoriale (Fase 5)
├── player/                     # Player narrazione (Fase 4)
└── stories/                    # Listing storie pubbliche (Fase 6)
hooks/
├── useMuseumSearch.ts          # useInfiniteQuery per la gallery ✅
└── ...                         # useViewer, useStory, useAnonymousAuthor (fasi future)
lib/
├── museums/                    # Adapter e transformer per ogni museo ✅
├── supabase/                   # Client e queries (Fase 5)
├── iiif/                       # Utility IIIF (Fase 3)
└── cookies/                    # Gestione autore anonimo (Fase 3)
types/
├── museum.ts                   # UnifiedArtwork, MuseumAdapter, ecc. ✅
└── story.ts                    # Waypoint, Story (Fase 5)
```

## Licenza

MIT

## Crediti e contesto

Questo progetto nasce nell'ambito delle Digital Humanities. Si ispira a Storiiies (Cogapp), Annona (NCSU Libraries), e al lavoro di storytelling IIIF presentato a Museums and the Web 2018. I dati delle opere provengono dalle API pubbliche dei rispettivi musei — ogni opera è attribuita e linkata alla fonte originale.
