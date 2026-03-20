# AI — Modulo di assistenza alla creazione

Questo documento descrive il funzionamento del modulo AI di Gigapixel Storyteller: architettura, flusso delle richieste, scelte tecniche e guida alla configurazione.

---

## Cosa fa

Il modulo aggiunge due funzioni AI all'editor autoriale:

### 1. Suggerisci testo (`✦ Suggerisci`)

Disponibile nel WaypointEditor per ogni singolo waypoint. Genera un testo narrativo di 2-4 frasi in italiano, calibrato sulla posizione del waypoint nella storia (apertura, corpo, chiusura) e sui metadati dell'opera.

### 2. Auto-story (`✦ Auto-story`)

Disponibile nell'EditorShell. Genera in un colpo solo un piano narrativo completo: 3-8 waypoint, ognuno con un titolo di focus e un testo suggerito. L'autore vede l'anteprima, può accettarla tutta con "Applica tutti" e poi navigare il dipinto per aggiornare il viewport di ciascun waypoint.

---

## Architettura

```
Browser (editor)
  │
  ├── WaypointEditor
  │     └── "✦ Suggerisci" → POST /api/ai/suggest
  │
  └── EditorShell
        └── "✦ Auto-story" → POST /api/ai/auto-story
                               │
                               └── lib/ai/client.ts
                                     └── fetch → Provider LLM (Groq / OpenAI / Ollama / ...)
```

Le API routes vivono **server-side** (App Router Next.js). La chiave API non è mai esposta al browser.

---

## Flusso: Suggerisci testo

```
1. Utente apre un waypoint nell'editor e clicca "✦ Suggerisci"
2. EditorShell.handleSuggestText() prepara il body:
     { artworkTitle, artworkArtist, artworkDate,
       waypointIndex, totalWaypoints, existingText }
3. POST /api/ai/suggest (server)
4. La route costruisce due messaggi:
     - system: ruolo del mediatore culturale
     - user:   opera + posizione waypoint + testo esistente
5. chatComplete() → fetch POST {baseUrl}/chat/completions
6. Il provider LLM risponde con il testo generato
7. La route restituisce { text: string }
8. EditorShell chiama onChange({ text }) → aggiorna Tiptap
```

**Contestualizzazione della posizione**: il prompt varia in base all'indice del waypoint:

- Waypoint 0 → "È il waypoint di apertura — deve introdurre l'opera"
- Waypoint finale → "È il waypoint conclusivo — deve chiudere il percorso"
- Waypoint intermedi → "Approfondisce un aspetto specifico"

---

## Flusso: Auto-story

```
1. Utente clicca "✦ Auto-story" (nessun waypoint necessario)
2. EditorShell.handleAutoStory() prepara il body:
     { artworkTitle, artworkArtist, artworkDate, artworkMedium, waypointCount: 6 }
3. POST /api/ai/auto-story (server)
4. La route chiede al modello un array JSON:
     [{ title: "...", text: "..." }, ...]
5. Il JSON viene estratto con regex (alcuni modelli aggiungono testo extra)
6. La route restituisce { suggestions: WaypointSuggestion[] }
7. EditorShell mostra il pannello anteprima
8. "Applica tutti" → crea N waypoint con:
     - viewport = vista corrente del viewer (da aggiornare manualmente)
     - text = testo suggerito dall'AI
     - duration = 5s, transition = ease
```

**Perché i viewport non sono generati**: l'AI non ha accesso all'immagine né alle coordinate IIIF. I viewport richiedono che l'autore navighi nel dipinto e catturi la vista. L'AI si occupa solo della parte testuale/narrativa.

---

## lib/ai/client.ts — Scelte tecniche

### Nessuna dipendenza esterna

Usiamo `fetch` nativo invece dell'SDK `openai` o di Vercel AI SDK. Motivazioni:

- Zero dipendenze aggiuntive in `package.json`
- L'API OpenAI-compatible è stabile e semplice (un solo endpoint: `POST /chat/completions`)
- Qualsiasi provider supporta questo formato — non siamo vincolati a nessuno

### Interfaccia OpenAI-compatible

Quasi tutti i provider LLM moderni implementano l'API OpenAI-compatible:

| Provider        | Base URL                                | Gratuito            | Note                                    |
| --------------- | --------------------------------------- | ------------------- | --------------------------------------- |
| **Groq**        | `https://api.groq.com/openai/v1`        | ✅ Sì (free tier)   | Default. Modelli Llama velocissimi      |
| **OpenAI**      | `https://api.openai.com/v1`             | ❌ No               | GPT-4o, GPT-4 Turbo                     |
| **Ollama**      | `http://localhost:11434/v1`             | ✅ Sì (locale)      | Nessuna API key necessaria              |
| **OpenRouter**  | `https://openrouter.ai/api/v1`          | ✅ Parziale         | Accesso a 100+ modelli con un'unica key |
| **Together AI** | `https://api.together.xyz/v1`           | ✅ Crediti iniziali | Llama, Mixtral                          |
| **Fireworks**   | `https://api.fireworks.ai/inference/v1` | ✅ Crediti iniziali | Veloce, economico                       |

### Perché Groq come default

- **Gratuito**: il free tier Groq non richiede carta di credito e ha limiti generosi (6k req/min su `llama-3.1-8b-instant`)
- **Veloce**: latenza ~200-400ms contro 1-3s di OpenAI — importante per UX interattiva
- **Qualità sufficiente**: `llama-3.1-8b-instant` produce testi italiani fluenti per testi brevi (2-4 frasi)

### Perché non Vercel AI SDK

Il progetto non usa streaming. I testi generati sono brevi (max 200 token per `suggest`, 900 per `auto-story`) e la risposta completa arriva in ~400ms con Groq. Lo streaming aggiungerebbe complessità senza beneficio percepibile.

### Gestione del JSON in auto-story

Alcuni modelli avvolgono il JSON in backtick o aggiungono frasi. La route usa:

```typescript
const match = raw.match(/\[[\s\S]*\]/);
```

per estrarre l'array JSON anche da output non perfettamente formattati.

---

## Configurazione

### .env.local

```env
# Provider (default: Groq — gratuito)
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...          # Groq: https://console.groq.com/keys
AI_MODEL=llama-3.1-8b-instant

# Alternativa: OpenAI
# AI_BASE_URL=https://api.openai.com/v1
# AI_API_KEY=sk-...
# AI_MODEL=gpt-4o-mini

# Alternativa: Ollama locale (nessuna key necessaria)
# AI_BASE_URL=http://localhost:11434/v1
# AI_MODEL=llama3.2

# Alternativa: OpenRouter (accesso a 100+ modelli)
# AI_BASE_URL=https://openrouter.ai/api/v1
# AI_API_KEY=sk-or-...
# AI_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

### Vercel (produzione)

Aggiungere le variabili d'ambiente nel dashboard Vercel:
`Settings → Environment Variables → AI_BASE_URL / AI_API_KEY / AI_MODEL`

Le variabili **non** hanno prefisso `NEXT_PUBLIC_` — sono server-only e non vengono mai esposte al browser.

### Se AI_API_KEY non è impostata

Il pulsante "✦ Suggerisci" e "✦ Auto-story" sono sempre visibili nell'editor. Se la chiave non è configurata, la route restituisce HTTP 503 con `{ error: 'AI non configurata — imposta AI_API_KEY in .env.local' }` e l'editor mostra il messaggio di errore inline.

---

## File coinvolti

| File                                   | Ruolo                                                    |
| -------------------------------------- | -------------------------------------------------------- |
| `lib/ai/client.ts`                     | Config da env, `chatComplete()` generico                 |
| `app/api/ai/suggest/route.ts`          | POST → testo per singolo waypoint                        |
| `app/api/ai/auto-story/route.ts`       | POST → piano completo 3-8 waypoint                       |
| `components/editor/WaypointEditor.tsx` | Pulsante "✦ Suggerisci", loading state                   |
| `components/editor/EditorShell.tsx`    | Pulsante "✦ Auto-story", pannello anteprima, callback AI |

---

## Fase 9 — Connessioni visive (CLIP embeddings)

### Cosa fa

Quando il curatore apre un waypoint nell'editor, il pannello "Connessioni visive" cerca opere in tutta la gallery che siano visivamente simili al dettaglio catturato. L'AI non genera testo — scopre relazioni visive latenti tra dipinti di musei diversi.

### Architettura

```
OFFLINE (script Node.js)                    BROWSER (editor)
─────────────────────────────               ──────────────────────────────────
scripts/generate-embeddings.ts              useSimilarity hook
  │                                           │
  ├── Fetch ~2000 opere dalla gallery         ├── Dynamic import @xenova/transformers
  ├── Per ogni opera: scarica thumbnail       ├── Fetch /data/embeddings.json  (1 volta)
  ├── CLIP ViT-B/32 (Transformers.js Node)    ├── CLIP ViT-B/32 (ONNX Runtime Web)
  └── Scrive public/data/embeddings.json      ├── Genera embedding del crop waypoint
                                              ├── Cosine similarity O(n×d) ~10ms
                                              └── Top-8 risultati → UI pannello
```

Il modello è **lo stesso** in entrambi i contesti (`Xenova/clip-vit-base-patch32`). Questo garantisce che i vettori siano nello stesso spazio semantico — prerequisito fondamentale per confrontare embedding generati offline con embedding generati al volo nel browser.

### Flusso dettagliato: dal click ai risultati

```
1. Utente cattura un waypoint → thumbnailDataUrl (JPEG 0.7, ~30-50KB base64)
2. Apre il pannello "Connessioni visive" nel WaypointEditor
3. handleFindConnections() chiama onFindSimilar(waypoint.thumbnailDataUrl)
4. EditorShell.handleFindSimilar() delega a useSimilarity.findSimilar()
5. useSimilarity.ensureReady() (prima volta):
     - import('@xenova/transformers')          → carica ONNX Runtime Web
     - fetch('/data/embeddings.json')          → carica indice in memoria
     - pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32')
6. Embedding query: pipe(imageBase64, { pooling: 'mean', normalize: true })
     → vettore Float32Array[512], normalizzato L2
7. findTopK(queryEmbedding, index, 8, artworkId):
     - filtra l'opera corrente (excludeId)
     - dot product con ogni embedding dell'indice (≡ cosine similarity se normalizzati)
     - sort desc, slice top-8
8. Risultati: array di SimilarityResult { artworkId, title, artist, thumbnailUrl, similarity }
9. UI: griglia 2 colonne con thumbnail, titolo, artista, museum badge, score %
```

### Perché CLIP ViT-B/32

CLIP (Contrastive Language-Image Pretraining, OpenAI 2021) è addestrato a capire il contenuto visivo e semantico delle immagini. Il modello `ViT-B/32` produce vettori a 512 dimensioni che codificano composizione, colori, stile, soggetti — tutto ciò che rende due dipinti "simili" a livello visivo, indipendentemente dalla loro provenienza.

Rispetto ad alternative basate su reti convoluzionali classiche (ResNet, EfficientNet), CLIP generalizza molto meglio su immagini di opere d'arte perché è stato addestrato su testo+immagine a scala enorme: cattura anche relazioni semantiche ("paesaggio notturno", "ritratto di donna") oltre a quelle puramente visive.

### Perché @xenova/transformers invece delle alternative

#### Alternativa A: Hugging Face Inference API

```
Browser → POST https://api-inference.huggingface.co/models/...
```

- Pro: nessun download, zero latenza primo uso
- Contro:
  - Il thumbnail del waypoint viene inviato ai server HF (US) — contrario al principio privacy-by-design
  - Rate limit sul free tier (30k req/mese)
  - **Incompatibilità di vettori**: HF Inference API usa la versione FP16 del modello, lo script offline userebbe FP32 o un modello diverso → vettori in spazi semantici diversi → similarità completamente errata
  - Dipendenza da connettività e disponibilità del servizio

#### Alternativa B: Next.js API route + HF Inference API on-demand

```
Browser → POST /api/ai/similar { imageBase64 } → server → HF API
```

- Pro: nasconde la dipendenza da HF al browser
- Contro: latenza aggiuntiva (2 hop), stessa incompatibilità di vettori, rate limit moltiplicato per utente
- Non scala in produzione

#### Alternativa C: pgvector su Supabase

```sql
select artwork_id, 1 - (embedding <=> $1) as similarity
from artwork_embeddings order by embedding <=> $1 limit 8;
```

- Pro: query O(log n) con indice IVFFlat, scalabile a milioni di opere
- Contro:
  - Overkill per n ≤ 2000 — brute-force O(n×d) in ~10ms nel main thread batte il round-trip HTTP
  - Richiede estensione pgvector su Supabase, migration aggiuntiva, costo per request
  - Mantiene l'embedding sul server → nessun vantaggio privacy rispetto all'opzione locale

#### Scelta finale: @xenova/transformers

- **Privacy by design**: il crop non lascia mai il browser — CLIP gira in ONNX Runtime Web
- **Vettori compatibili garantiti**: stesso modello, stessa configurazione (`quantized: false`, `fp32`) offline e online
- **Zero costi operativi**: nessuna API key, nessun rate limit, funziona offline
- **Caching efficiente**: il modello (~170MB) viene scaricato una volta e messo in cache dal browser; l'indice JSON viene caricato una volta sola per sessione (singleton di modulo)
- **Semplicità**: un unico hook `useSimilarity` gestisce tutto il ciclo di vita (loading → ready → searching)

### Dettagli implementativi

**Vettori normalizzati L2**: sia lo script offline che il browser usano `{ normalize: true }` nel pipeline CLIP. Questo garantisce che tutti i vettori abbiano norma 1. Con vettori normalizzati, il **dot product** è identico alla cosine similarity:

```
cosine(a, b) = dot(a,b) / (||a|| × ||b||)  =  dot(a,b)  (se ||a||=||b||=1)
```

Questo permette di calcolare la similarity con un solo ciclo senza le radici quadrate della formula completa.

**Singleton di sessione**: `clipModelSingleton` e `embeddingIndexSingleton` sono variabili di modulo. Se l'utente apre più waypoint nella stessa sessione browser, il modello e l'indice vengono caricati una sola volta. I `useRef` nel hook sono sincronizzati con questi singleton per evitare re-render durante il caricamento.

**Brute-force O(n×d)**: con n=2000 e d=512, il loop di similarity richiede 1.024M operazioni floating point. Su hardware moderno (V8 JIT) ci vogliono ~10ms nel main thread. Non serve un Web Worker per questa dimensione. Se l'indice crescesse a 20.000+ opere, sarebbe il momento di valutare un worker.

**Dynamic import**: `import('@xenova/transformers')` è dinamico per evitare che SSR di Next.js tenti di eseguire codice browser-only (ONNX Runtime Web usa `WebAssembly`, `fetch`, `localStorage` — non disponibili in Node.js). Il webpack alias `onnxruntime-node: false` in `next.config.ts` impedisce al bundle browser di tentare di caricare i binding nativi Node.js.

### La collaborazione CLIP + LLM: pregi, difetti e allucinazioni

#### Come collaborano

CLIP e il LLM risolvono problemi diversi e complementari:

|                   | CLIP (visione)                   | LLM (linguaggio)                 |
| ----------------- | -------------------------------- | -------------------------------- |
| **Input**         | Pixel dell'immagine              | Testo (titoli, artisti, score)   |
| **Output**        | Vettore numerico 512-dim         | Testo in linguaggio naturale     |
| **Cosa sa**       | Struttura visiva dell'immagine   | Conoscenza enciclopedica su arte |
| **Cosa non sa**   | Nulla sul nome, storia, contesto | Nulla sull'immagine reale        |
| **Errori tipici** | Falsi positivi visivi            | Allucinazioni contestuali        |

CLIP trova la connessione. Il LLM la racconta. Il problema è che il LLM **non ha mai visto le immagini** — ragiona solo sui titoli e sui nomi degli artisti che gli passiamo nel prompt.

#### Pregi

- **Oggettività visiva**: CLIP non conosce la reputazione di un'opera. Trova affinità tra un capolavoro del Rijksmuseum e un'illustrazione medica Wellcome perché i loro pixel si assomigliano — connessioni che un umano non cercherebbe mai.
- **Trasversalità museale**: i vettori CLIP non hanno nozione di "museo" o "epoca". Una natura morta olandese del 1650 può connettersi a una fotografia scientifica del 1890 se condividono composizione e palette.
- **Scalabilità**: una volta generato l'indice, ogni ricerca costa ~10ms nel browser. Nessuna API call durante la navigazione.
- **Privacy**: il crop del waypoint non lascia il browser.
- **Spiegazione accessibile**: il LLM traduce una distanza coseno in frasi comprensibili per un pubblico non specializzato.

#### Difetti

- **CLIP non ragiona**: un'alta similarità può essere dovuta a motivi banali — stessa dimensione del file thumbnail, stesso sfondo neutro, stesso schema di colori accidentale. CLIP non distingue "simili perché stessa scuola pittorica" da "simili perché entrambe hanno molto bianco".
- **Il LLM non vede**: la spiegazione è costruita sui metadati testuali (titolo, artista), non sull'immagine. Il LLM non ha accesso al crop né ai risultati CLIP: inventa una spiegazione plausibile basandosi sulla sua conoscenza dell'opera.
- **Indice statico**: embeddings generati una volta. Se la gallery cambia, l'indice è stale finché non si rigenera.
- **95 opere nell'indice di test**: con poche opere la qualità delle connessioni è bassa — le top-8 potrebbero tutte avere similarità mediocre (0.55-0.65). Con 2000+ opere le connessioni diventano significative.

#### Allucinazioni attese

Questa è la parte più importante da capire prima di usare il sistema in produzione.

**1. Spiegazioni inventate per opere sconosciute al LLM**

Il LLM conosce bene Rembrandt, Vermeer, Caravaggio. Ma molte opere della gallery (soprattutto Wellcome e YCBA) sono poco documentate online. In questi casi il modello genera una spiegazione stilisticamente plausibile ma fattualmente vuota:

> "Entrambe le opere mostrano un uso sapiente della luce per evocare profondità emotiva." ← generico, probabilmente inventato

**2. Inversione causa-effetto**

Il LLM sa che CLIP ha trovato una connessione ad alta similarità, ma non sa perché. Può attribuire la connessione a un elemento sbagliato:

> "Le due opere condividono la tecnica a olio su tavola e la scelta di soggetti religiosi." ← CLIP in realtà ha trovato similarità per la palette, non per il soggetto

**3. Dettagli tecnici errati**

Il LLM può citare tecniche, materiali o datazioni incorretti se li "ricorda" in modo impreciso:

> "Entrambe risalgono al periodo fiammingo del XVII secolo." ← una delle due potrebbe essere italiana del XVIII

**4. Falso positive di CLIP + spiegazione coerente**

Se CLIP trova una connessione "sbagliata" (due opere visivamente simili per motivi accidentali), il LLM costruirà comunque una spiegazione convincente. Il sistema non ha modo di sapere che la connessione visiva non ha valore curatoriale.

#### Mitigazione

Il sistema è progettato per **assistere il curatore, non sostituirlo**:

- Il pulsante "✦ Spiega connessione" è esplicito: l'utente chiede una spiegazione sapendo che potrebbe essere approssimativa
- La spiegazione appare come suggerimento, non come fatto — il curatore la legge, la valuta, e decide se usarla o riscriverla nel testo del waypoint
- Il similarity score (%) è sempre visibile: il curatore può ignorare connessioni con score basso
- La nota in ROADMAP 9.5 è esplicita: "L'AI non genera narrativa — identifica relazioni visive. La narrazione resta nelle mani del curatore."

---

### Flusso: Spiega connessione

Dopo che CLIP ha trovato le opere simili, il curatore può richiedere una spiegazione testuale per ogni card:

```
1. Utente clicca "✦ Spiega connessione" su una card risultato
2. WaypointEditor.handleExplain() chiama onExplainConnection(result)
3. EditorShell.handleExplainConnection() prepara il body:
     { sourceTitle, sourceArtist,
       connectedTitle, connectedArtist, connectedProvider, similarity }
4. POST /api/ai/explain-connection (server)
5. La route calibra il prompt sul similarity score:
     ≥ 0.85 → "molto alta (elementi visivi evidenti)"
     ≥ 0.70 → "significativa (affinità riconoscibili)"
     <  0.70 → "sottile (risonanze meno immediate)"
6. chatComplete() → Groq/provider configurato
7. La route restituisce { explanation: string }
8. La spiegazione appare inline sotto la card, sopra l'immagine
```

**Separazione dei ruoli**: CLIP trova le connessioni visive in modo oggettivo (similarità vettoriale). Il LLM le interpreta e le verbalizza per il curatore. Il curatore resta l'autore: sceglie quali connessioni usare e scrive il testo finale nella storia.

### File coinvolti (Fase 9)

| File                                     | Ruolo                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/generate-embeddings.ts`         | Script offline: fetcha opere, genera embedding CLIP, scrive JSON              |
| `lib/ai/similarity.ts`                   | Tipi `EmbeddingEntry`, `SimilarityResult`; `cosineSimilarity()`, `findTopK()` |
| `hooks/useSimilarity.ts`                 | Hook browser: carica modello+indice, espone `findSimilar()`                   |
| `app/api/ai/explain-connection/route.ts` | POST → spiegazione testuale 1-2 frasi della connessione visiva                |
| `components/editor/WaypointEditor.tsx`   | Pannello "Connessioni visive", griglia risultati, pulsante "Spiega"           |
| `components/editor/EditorShell.tsx`      | `handleFindSimilar()`, `handleExplainConnection()`, wiring hook → props       |
| `next.config.ts`                         | Webpack alias: `sharp`, `onnxruntime-node` → `false` (browser)                |
| `public/data/embeddings.json`            | Indice statico generato offline (non in repo — generare localmente)           |
