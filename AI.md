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
