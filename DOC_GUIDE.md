# Guida alla Documentazione

## Filosofia
Questo progetto ha tre pubblici: **sviluppatori** (codice), **professionisti culturali** (README e UX), e **musei/istituzioni** (architettura e interoperabilità). La documentazione parla a tutti e tre.

## Regole per l'agente

### Architettura e pattern
- Il pattern **adapter/transformer** per le API musei è fondamentale. Ogni volta che aggiungi un nuovo museo, segui lo stesso pattern: adapter che implementa `MuseumAdapter` → transformer in `UnifiedArtwork`.
- Documenta ogni adapter con un commento che indica: URL base, tipo di accesso (REST / Linked Art / OAI-PMH / IIIF Discovery), limiti dell'API (rate limit, paginazione max), e peculiarità.
- Le API routes Next.js sono il "backend": gestiscono aggregazione, caching, e persistenza. Non mettere logica di business nei componenti React.
- La gestione delle autorizzazioni per bozze e storie avviene **esclusivamente nelle API routes** tramite confronto del cookie `x-author-cookie-id`. Non delegare questa logica al client né a Supabase RLS (per ora — vedi ROADMAP).

### Componenti e hook
- JSDoc in italiano con `@description`, `@example`, `@see`.
- Props TypeScript documentate (no `any`, mai).
- Nessuna component library esterna: ogni componente è custom. Se un pattern si ripete 3+ volte, valuta di astrarlo in un componente condiviso in `src/components/ui/`.
- Commenta "perché" per ogni decisione non ovvia — il "cosa" è già nel codice.

### Supabase
- Documenta ogni query in un commento sopra la funzione.
- Spiega esplicitamente l'assenza di RLS e il motivo (pragmatismo / portfolio), con riferimento alla voce di ROADMAP per la migrazione futura.
- Il cookie `author_cookie_id` è il meccanismo di identità: documentalo in ogni punto del codice dove viene letto o scritto.

### Commenti nel codice
- **Lingua**: italiano.
- Prefissi obbligatori:
  - `// MUSEUM_API:` — logica specifica di un'API museo
  - `// TRANSFORMER:` — normalizzazione dati in `UnifiedArtwork`
  - `// IIIF:` — protocollo IIIF (manifest, info.json, tile URL)
  - `// SUPABASE:` — query o logica di persistenza
  - `// AUTH:` — gestione cookie autore anonimo e controllo accesso
  - `// UX:` — decisioni di design o comportamento UI
  - `// PERF:` — ottimizzazioni (caching, lazy loading, debounce, ecc.)
  - `// TODO: @fase N` — lavoro futuro associato a una fase della roadmap

### README
- Aggiornalo ad ogni fase completata.
- La tabella dei musei supportati deve riflettere lo stato reale (✅ funzionante / 🚧 in corso / ❌ non disponibile).
- Aggiungi screenshot: gallery, editor, player, pagina storie.

### Glossario (`GLOSSARY.md`)
Mantieni aggiornato il glossario con questi termini e altri che emergono durante lo sviluppo:
- **Waypoint** — singola fermata narrativa: viewport + testo + durata
- **Manifest IIIF** — documento JSON che descrive una risorsa (opera) e le sue immagini secondo lo standard IIIF Presentation API
- **info.json** — documento JSON che descrive le capacità di un server IIIF Image API per una specifica immagine (dimensioni, formati, livelli di zoom)
- **Deep zoom / Tiling** — tecnica di suddivisione dell'immagine in tile a diverse risoluzioni per lo streaming progressivo
- **Tile** — porzione rettangolare di immagine servita dal server IIIF
- **Adapter** — classe che incapsula la logica di comunicazione con l'API di un singolo museo
- **Transformer** — funzione che converte il formato nativo di un museo in `UnifiedArtwork`
- **UnifiedArtwork** — tipo TypeScript condiviso che rappresenta un'opera indipendentemente dal museo di provenienza
- **Masonry layout** — layout a colonne con altezze variabili basate sull'aspect ratio dell'immagine
- **Cookie autore** — UUID v4 salvato in un cookie client-side che identifica l'autore anonimo tra le sessioni
- **Linked Art** — profilo applicativo di JSON-LD basato su CIDOC-CRM, usato dal Rijksmuseum per esporre i metadati
- **OAI-PMH** — Open Archives Initiative Protocol for Metadata Harvesting, usato da Yale YCBA per l'accesso bulk ai metadati

### API documentation (`API.md`)
Per ogni API route, documenta:
- Endpoint e metodo HTTP
- Query params o body (con tipi TypeScript)
- Risposta (struttura JSON)
- Codici di errore e significato
- Esempio curl completo

```markdown
### GET /api/museums/search

Aggrega e normalizza i risultati da tutti i musei (o un sottoinsieme).

**Query params**
| Param | Tipo | Default | Descrizione |
|-------|------|---------|-------------|
| q | string | — | Ricerca testuale |
| provider | string[] | tutti | Filtro musei: `chicago`, `rijksmuseum`, `nga`, `wellcome`, `ycba` |
| page | number | 1 | Pagina |
| limit | number | 20 | Risultati per pagina (max 40) |

**Risposta 200**
\`\`\`json
{
  "artworks": [...],
  "total": 342,
  "page": 1,
  "hasMore": true,
  "providers": [
    { "provider": "chicago", "count": 8 },
    { "provider": "rijksmuseum", "count": 6 }
  ]
}
\`\`\`

**Errori**
- `400` — parametri non validi
- `504` — tutti i provider hanno superato il timeout

**Esempio**
\`\`\`bash
curl "https://gigap-story.vercel.app/api/museums/search?q=rembrandt&limit=20"
\`\`\`
```
