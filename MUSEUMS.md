# Come i musei espongono i dati — e perché abbiamo scelto ogni approccio

Questo documento spiega, in linguaggio accessibile, i protocolli usati dai 4 musei integrati in Gigapixel Storyteller, le motivazioni tecniche che ci hanno portato a ogni scelta, e una guida pratica per aggiungere nuovi musei.

---

## Concetti di base

Prima di entrare nel dettaglio, due concetti che tornano spesso:

### Cos'è IIIF?

IIIF (International Image Interoperability Framework, si pronuncia "triple-I F") è uno standard internazionale adottato da centinaia di musei, biblioteche e archivi. Definisce due cose:

1. **IIIF Image API**: una URL standardizzata per richiedere un'immagine in qualsiasi dimensione, ritaglio o rotazione. Esempio: `https://server/image/ID/full/400,/0/default.jpg` restituisce l'immagine a 400px di larghezza. Il file `info.json` (es. `https://server/image/ID/info.json`) descrive le capacità del server (dimensioni originali, livelli di zoom disponibili, ecc.).

2. **IIIF Presentation API**: un formato JSON (chiamato _manifest_) che descrive come presentare un oggetto culturale — sequenza di immagini, metadati, annotazioni. Esempio: `https://museo.org/iiif/12345/manifest.json`.

**Perché IIIF è fondamentale per questo progetto**: OpenSeadragon (il viewer che usiamo) ha supporto nativo per IIIF Image API. Questo significa che può caricare immagini gigapixel in modo efficiente, caricando solo i _tile_ (pezzi) visibili nella viewport corrente — senza scaricare file da gigabyte interi. Un'opera senza `iiifInfoUrl` non può essere usata nel viewer, quindi la scartiamo nella fase di normalizzazione.

### Cos'è un adapter?

Ogni museo espone i dati in modo diverso. Per il nostro codice, abbiamo bisogno di un unico formato (`UnifiedArtwork`). Un **adapter** è il modulo che:

1. Sa come interrogare le API di uno specifico museo (la "search")
2. Sa come recuperare il dettaglio di una singola opera (la "getArtwork")
3. Sa come tradurre la risposta del museo nel formato unificato (la "transformToUnified")

---

## I 5 musei integrati

### 1. Art Institute of Chicago (AIC)

**File**: [lib/museums/chicago.ts](lib/museums/chicago.ts)

**Come espone i dati**: REST API moderna con motore di ricerca Elasticsearch sottostante. La ricerca avviene con `POST` e una query JSON in stile Elasticsearch. Supporto IIIF nativo e completo.

**Perché questo approccio**: L'AIC ha una delle API museali meglio documentate e più generose. La ricerca Elasticsearch permette query sofisticate (multi-campo, boost per rilevanza, filtri booleani). I filtri `is_public_domain: true` e `artwork_type_title: "Painting"` ci garantiscono solo opere di pubblico dominio e solo dipinti, senza logica extra da parte nostra.

**IIIF**: l'`image_id` nella risposta API costruisce direttamente l'URL IIIF:

```
https://www.artic.edu/iiif/2/{image_id}/info.json
```

**Limitazioni**: ~60 richieste/minuto. Il campo `artwork_type_title` non copre tutte le classificazioni — alcune opere potrebbero sfuggire.

---

### 2. Rijksmuseum (Amsterdam)

**File**: [lib/museums/rijksmuseum.ts](lib/museums/rijksmuseum.ts)

**Come espone i dati**: il Rijksmuseum ha un **Data Hub** pubblico (2025) basato su **Linked Data**. La ricerca avviene via Search API REST; i metadati vengono recuperati via **OAI-PMH** GetRecord per ogni opera; le immagini sono servite da **Micrio**, un server IIIF Image API compatibile con OpenSeadragon.

**Cos'è OAI-PMH?** Open Archives Initiative Protocol for Metadata Harvesting è uno standard per la raccolta di metadati da archivi digitali. Ogni record è identificato da un URI Linked Data (es. `https://id.rijksmuseum.nl/200100988`). Facciamo una chiamata `GetRecord` per ogni ID e otteniamo XML Dublin Core con titolo, artista, data, materiale e — crucialmente — il link Micrio da cui estraiamo il `micrioId` IIIF.

**Flusso in tre passi**:

1. `GET https://data.rijksmuseum.nl/search/collection?type=painting&title={query}` → lista di Linked Data ID
2. `GET https://data.rijksmuseum.nl/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier=https://id.rijksmuseum.nl/{id}` → XML con `dc:relation` contenente l'URL Micrio
3. Estrai `micrioId` → `https://iiif.micr.io/{micrioId}/info.json`

**IIIF**: Micrio è un server IIIF Image API standard, compatibile con OpenSeadragon:

```
https://iiif.micr.io/{micrioId}/info.json
```

**Stato attuale**: ✅ Attivo — nuova architettura Data Services 2025.

---

### 3. Wellcome Collection (Londra)

**File**: [lib/museums/wellcome.ts](lib/museums/wellcome.ts)

**Come espone i dati**: REST API moderna con paginazione e parametri GET. Il catalogo Wellcome è eterogeneo (libri, fotografie, manoscritti, opere d'arte). Usiamo il parametro `workType=k` (Pictures/Artworks) per filtrare il materiale visivo.

**Cos'è `workType=k`?** Il sistema catalografico Wellcome classifica ogni opera con un codice. `k` identifica le "Pictures" — categoria che include dipinti, acquerelli, disegni, illustrazioni. Non è limitata ai soli dipinti a olio, quindi il catalogo risultante è più ampio e variegato.

**Perché questo approccio**: API pubblica e ben documentata. La risposta include un campo `thumbnail` con un URL da cui possiamo estrarre direttamente l'ID per il server IIIF Wellcome, evitando fetch aggiuntivi. Il catalogo è ricco di materiale medico-storico e scientifico del 17°-20° secolo, che aggiunge una prospettiva diversa dagli altri musei.

**IIIF**: l'imageId si estrae dall'URL del thumbnail:

```
https://iiif.wellcomecollection.org/image/{imageId}/info.json
```

**Limitazioni**: la categoria `workType=k` non è solo pittura — include illustrazioni, fotografie, grafiche. Alcune opere potrebbero non avere thumbnail.

---

### 4. Yale Center for British Art (YCBA)

**File**: [lib/museums/ycba.ts](lib/museums/ycba.ts)

**Come espone i dati**: originariamente tramite **OAI-PMH** (dismesso nel 2023-2024), ora tramite **IIIF Presentation API 3**. Ogni opera ha un manifest JSON accessibile pubblicamente.

**Cos'è OAI-PMH?** Open Archives Initiative Protocol for Metadata Harvesting è uno standard per la _raccolta_ (harvesting) di metadati da archivi digitali. Non è pensato per la ricerca in tempo reale: è pensato per trasferire grandi volumi di metadati da un repository a un altro (es. da un museo a un aggregatore come Europeana). Il YCBA usava questo protocollo, ma l'endpoint (`collections.britishart.yale.edu/oai`) è stato dismesso.

**Approccio attuale — IIIF Manifest API**: fetchamo in parallelo una lista curata di ~40 manifest IIIF di dipinti YCBA noti. Ogni manifest è un documento JSON che descrive l'opera e include il riferimento al server IIIF Image API. Estraiamo titolo, artista, data e UUID dell'immagine da ogni manifest, cachiamo il risultato per 24h, e filtriamo in-memory per le ricerche.

Il manifest di un'opera YCBA è a:

```
https://manifests.collections.yale.edu/ycba/obj/{id}
```

All'interno del manifest, la struttura IIIF Presentation API 3 è:

```
items[0].items[0].items[0].body.service[0]["@id"]
→ "https://images.collections.yale.edu/iiif/2/ycba:{uuid}"
```

**IIIF**: il server immagini di Yale usa un UUID (non l'object ID):

```
https://images.collections.yale.edu/iiif/2/ycba:{uuid}/info.json
```

**Limitazioni**: solo ~40 opere nel set campionato (quelle con ID numerici noti e verificati). La copertura della collezione è parziale. Il primo caricamento è lento (fetch parallelo di 40+ manifest). I manifest successivi vengono serviti dalla cache.

**TODO @fase-futura**: integrare il sistema **LUX** di Yale (`lux.collections.yale.edu`) quando la loro API JSON-LD sarà stabile e documentata — permetterebbe ricerca full-text su tutta la collezione YCBA.

---

## Tabella riassuntiva

| Museo                       | Sigla | Protocollo                    | Auth | IIIF             | Stato     | File                                         |
| --------------------------- | ----- | ----------------------------- | ---- | ---------------- | --------- | -------------------------------------------- |
| Art Institute of Chicago    | AIC   | REST + Elasticsearch          | No   | ✅ Completo      | ✅ Attivo | [chicago.ts](lib/museums/chicago.ts)         |
| Rijksmuseum                 | RKS   | Search API + OAI-PMH + Micrio | No   | ✅ Micrio IIIF   | ✅ Attivo | [rijksmuseum.ts](lib/museums/rijksmuseum.ts) |
| Wellcome Collection         | WC    | REST                          | No   | ✅ Dal thumbnail | ✅ Attivo | [wellcome.ts](lib/museums/wellcome.ts)       |
| Yale Center for British Art | YCBA  | IIIF Manifest (fetch)         | No   | ✅ Da manifest   | ✅ Attivo | [ycba.ts](lib/museums/ycba.ts)               |

---

## Come aggiungere un nuovo museo

Ecco i passi da seguire per integrare un sesto museo (o qualsiasi fonte con immagini IIIF).

### Prerequisito fondamentale

Il museo deve avere un **server IIIF Image API** accessibile. Senza `info.json`, il viewer OpenSeadragon non funziona e l'opera viene scartata dal transformer. Se il museo non ha IIIF, non può essere integrato (almeno non in questa architettura).

### Passo 1 — Scegli la strategia di accesso

Fai queste domande sull'API del museo:

| Domanda                               | Se sì →                                | Se no →                                           |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Ha una REST API con ricerca testuale? | Usa REST (come Chicago, NGA, Wellcome) | Valuta SPARQL o OAI-PMH                           |
| Richiede API key?                     | Ottienila e aggiungila a `.env.local`  | Procedi senza                                     |
| Ha IIIF nativo?                       | Ottieni `info.json` dalla risposta API | Controlla se hanno un pattern costruibile dall'ID |
| Ha solo metadati statici/OAI?         | Usa harvest + cache (come YCBA)        | —                                                 |

### Passo 2 — Aggiungi il provider al tipo

In [types/museum.ts](types/museum.ts):

```typescript
export type MuseumProvider = 'chicago' | 'rijksmuseum' | 'wellcome' | 'ycba' | 'nome_nuovo_museo'; // ← aggiungi qui
```

### Passo 3 — Crea il file adapter

Crea `lib/museums/nome_museo.ts` implementando l'interfaccia `MuseumAdapter`:

```typescript
import type { MuseumAdapter, MuseumSearchParams, UnifiedArtwork } from '@/types/museum';
import { cleanText, calcAspectRatio } from './transformer';

// Definisci il tipo nativo della risposta API del museo
interface NomeMuseumArtwork {
  // ... campi specifici del museo
}

export const nomeMuseumAdapter: MuseumAdapter = {
  provider: 'nome_nuovo_museo',

  async search(params: MuseumSearchParams) {
    // Chiama l'API del museo con params.query, params.page, params.limit
    // Restituisce { items: unknown[], total: number }
  },

  async getArtwork(id: string) {
    // Recupera i dati completi di una singola opera per il dettaglio
  },

  transformToUnified(raw: unknown): UnifiedArtwork {
    const a = raw as NomeMuseumArtwork;
    // Mappa i campi del museo nel formato UnifiedArtwork
    // IMPORTANTE: se non puoi costruire iiifInfoUrl → lancia un errore
    // (l'aggregator catcha l'errore e scarta l'opera silenziosamente)
    return {
      id: `nome_nuovo_museo_${a.id}`,
      provider: 'nome_nuovo_museo',
      title: cleanText(a.title) || 'Senza titolo',
      artist: cleanText(a.artistName) || 'Anonimo',
      // ...
      iiifInfoUrl: `https://iiif.museo.org/${a.imageId}/info.json`,
      museum: {
        name: 'Nome Completo Museo',
        shortName: 'NMM',
        city: 'Città',
        country: 'Paese',
      },
    };
  },
};
```

### Passo 4 — Aggiungi l'adapter alla route di ricerca

In [app/api/museums/search/route.ts](app/api/museums/search/route.ts):

```typescript
import { nomeMuseumAdapter } from '@/lib/museums/nome_museo';

const ALL_ADAPTERS = [
  chicagoAdapter,
  rijksmuseumAdapter,
  wellcomeAdapter,
  ycbaAdapter,
  nomeMuseumAdapter, // ← aggiungi qui
];

const VALID_PROVIDERS = new Set<MuseumProvider>([
  // ...providers esistenti...
  'nome_nuovo_museo', // ← aggiungi qui
]);
```

Fai lo stesso in [app/api/museums/artwork/[id]/route.ts](app/api/museums/artwork/%5Bid%5D/route.ts):

```typescript
const ADAPTERS: Record<string, MuseumAdapter> = {
  // ...adapter esistenti...
  nome_nuovo_museo: nomeMuseumAdapter, // ← aggiungi qui
};
```

### Passo 5 — Aggiungi le variabili d'ambiente (se necessario)

Se il museo richiede API key:

1. Aggiungi a `.env.local`:
   ```env
   NOME_MUSEO_API_KEY=la_tua_chiave
   ```
2. Aggiungi ai secret di GitHub (Settings → Secrets → Actions)
3. Aggiungi alle env vars di Vercel (Dashboard → Settings → Environment Variables)
4. Usa nel codice: `process.env.NOME_MUSEO_API_KEY`

### Passo 6 — Documenta in MUSEUMS.md

Aggiungi una sezione in questo file che spiega:

- Come il museo espone i dati
- Perché hai scelto questo approccio
- Il pattern per `iiifInfoUrl`
- Eventuali limitazioni o particolarità

### Passo 7 — Aggiorna ROADMAP.md e README.md

- In ROADMAP.md: aggiungi il museo alla tabella nella Fase 1
- In README.md: aggiorna la sezione "Architettura dati → API Musei"

---

## Risorse utili

- **IIIF Image API spec**: https://iiif.io/api/image/3.0/
- **IIIF Presentation API spec**: https://iiif.io/api/presentation/3.0/
- **Lista musei con IIIF**: https://iiif.io/guides/finding_resources/
- **OpenSeadragon + IIIF**: https://openseadragon.github.io/examples/tilesource-iiif/
- **OAI-PMH spec**: https://www.openarchives.org/pmh/
- **SPARQL tutorial**: https://www.w3.org/TR/sparql11-query/
