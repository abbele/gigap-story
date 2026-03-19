# Come i musei espongono i dati — e perché abbiamo scelto ogni approccio

Questo documento spiega, in linguaggio accessibile, i protocolli usati dai 5 musei integrati in Gigapixel Storyteller, le motivazioni tecniche che ci hanno portato a ogni scelta, e una guida pratica per aggiungere nuovi musei.

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

**Come espone i dati**: il Rijksmuseum ha un'API classica (richiede API key gratuita) ma anche un **Data Hub** pubblico basato su **Linked Data** e **SPARQL**.

**Cos'è SPARQL?** È un linguaggio di query per basi di dati che organizzano il sapere come una rete di connessioni (ontologie), invece che come tabelle. Invece di `SELECT * FROM artworks WHERE title LIKE '%rembrandt%'` scrivi `SELECT ?opera WHERE { ?opera dc:title ?titolo . FILTER(CONTAINS(?titolo, "rembrandt")) }`. Il Data Hub del Rijksmuseum espone i dati del suo catalogo come grafo interrogabile in SPARQL, senza richiedere chiavi API.

**Perché SPARQL invece dell'API classica**: l'API classica del Rijksmuseum richiede una API key (gratuita ma con processo di registrazione), il che aggiunge attrito all'onboarding. Il Data Hub SPARQL è pubblico e non richiede registrazione. Per un progetto open source, ridurre le barriere di setup è importante.

**IIIF**: il server immagini del Rijksmuseum segue il pattern:

```
https://www.rijksmuseum.nl/api/iiif-img/{objectNumber}.jpg/info.json
```

L'object number (es. `SK-C-5` per "De Nachtwacht") è presente nei risultati SPARQL come `dc:identifier`.

**Limitazioni**: SPARQL può essere più lento di una REST API classica. Il filtro per dipinti si basa sul campo `dc:type` che può avere varianti linguistiche ("schilderij" in olandese, "painting" in inglese).

---

### 3. National Gallery of Art (NGA, Washington D.C.)

**File**: [lib/museums/nga.ts](lib/museums/nga.ts)

**Come espone i dati**: REST API pubblica senza autenticazione. Endpoint `/art/tms/objects` con parametri GET standard. Supporto IIIF nativo.

**Perché questo approccio**: API semplice, documentata, stabile e totalmente pubblica. Il parametro `only_open_access=1` filtra automaticamente le opere con licenza aperta. Il campo `iiifThumbUrl` nella risposta contiene già un URL da cui possiamo estrarre l'ID IIIF, costruendo `info.json` senza fetch aggiuntivi.

**IIIF**: l'ID IIIF si estrae dal campo `iiifThumbUrl`:

```
https://api.nga.gov/iiif/{uuid}/info.json
```

**Limitazioni**: le specifiche del rate limit non sono documentate pubblicamente.

---

### 4. Wellcome Collection (Londra)

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

### 5. Yale Center for British Art (YCBA)

**File**: [lib/museums/ycba.ts](lib/museums/ycba.ts)

**Come espone i dati**: **OAI-PMH** — un protocollo completamente diverso dagli altri.

**Cos'è OAI-PMH?** Open Archives Initiative Protocol for Metadata Harvesting è uno standard per la _raccolta_ (harvesting) di metadati da archivi digitali. Non è pensato per la ricerca in tempo reale: è pensato per trasferire grandi volumi di metadati da un repository a un altro (es. da un museo a un aggregatore come Europeana). Funziona così:

- Si fa una richiesta GET con `verb=ListRecords` e si riceve un blocco di record XML
- Se ci sono altri record, la risposta include un `resumptionToken`
- Si fa un'altra richiesta con quel token per ottenere il blocco successivo
- Si ripete finché non ci sono più token

**Perché OAI-PMH per YCBA**: il YCBA non offre una REST API pubblica per la ricerca in tempo reale. L'unico accesso strutturato ai metadati del loro catalogo è tramite OAI-PMH (e i manifest IIIF). Per questo progetto, scarichiamo la prima pagina di record OAI-PMH, la cachiamo per 24 ore, e filtriamo in memoria. È un approccio pragmatico che funziona per i volumi di questo progetto.

**Parser XML custom**: Node.js (l'ambiente server di Next.js) non include un parser XML nativo come fanno i browser. Per non aggiungere dipendenze, usiamo espressioni regolari (regex) per estrarre i campi Dublin Core (`<dc:title>`, `<dc:creator>`, ecc.) dall'XML. Questo va bene per un formato strutturato e prevedibile come l'OAI-PMH Dublin Core.

**IIIF**: il server immagini di Yale usa un formato URN:

```
https://images.collections.yale.edu/iiif/2/ycba:obj:{id}/info.json
```

**Limitazioni**: senza ricerca server-side, la rilevanza dei risultati dipende dalla qualità del filtro in memoria. Il harvest iniziale può essere lento alla prima richiesta (poi viene cachato). Solo la prima pagina OAI-PMH viene scaricata — circa 100 opere.

---

## Tabella riassuntiva

| Museo                       | Sigla | Protocollo           | Auth | IIIF nativo      | File                                         |
| --------------------------- | ----- | -------------------- | ---- | ---------------- | -------------------------------------------- |
| Art Institute of Chicago    | AIC   | REST + Elasticsearch | No   | ✅ Completo      | [chicago.ts](lib/museums/chicago.ts)         |
| Rijksmuseum                 | RKS   | SPARQL (Linked Data) | No   | ✅ Con pattern   | [rijksmuseum.ts](lib/museums/rijksmuseum.ts) |
| National Gallery of Art     | NGA   | REST                 | No   | ✅ Completo      | [nga.ts](lib/museums/nga.ts)                 |
| Wellcome Collection         | WC    | REST                 | No   | ✅ Dal thumbnail | [wellcome.ts](lib/museums/wellcome.ts)       |
| Yale Center for British Art | YCBA  | OAI-PMH + cache      | No   | ✅ Con pattern   | [ycba.ts](lib/museums/ycba.ts)               |

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
export type MuseumProvider =
  | 'chicago'
  | 'rijksmuseum'
  | 'nga'
  | 'wellcome'
  | 'ycba'
  | 'nome_nuovo_museo'; // ← aggiungi qui
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
  ngaAdapter,
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
