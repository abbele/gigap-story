// MUSEUM_API: Endpoint aggregato per la ricerca di opere d'arte.
// Chiama tutti e 5 i provider in parallelo con Promise.allSettled e timeout 5s.
// PERF: i risultati sono cachati 1h tramite route segment config (revalidate = 3600).
//
// GET /api/museums/search
// Query params:
//   q        - testo libero (opzionale)
//   provider - filtro provider, ripetibile: ?provider=chicago&provider=nga
//   page     - pagina (default 1)
//   limit    - risultati totali (default 20, max 40)
//
// Risposta: MuseumSearchResult

import type { NextRequest } from 'next/server';
import type { MuseumProvider, MuseumSearchParams } from '@/types/museum';
import { aggregateSearch } from '@/lib/museums/transformer';
import { chicagoAdapter } from '@/lib/museums/chicago';
import { rijksmuseumAdapter } from '@/lib/museums/rijksmuseum';
import { wellcomeAdapter } from '@/lib/museums/wellcome';
import { ycbaAdapter } from '@/lib/museums/ycba';

// PERF: cache di 1h a livello di route segment — si applica a tutte le risposte GET
export const revalidate = 3600;

const ALL_ADAPTERS = [chicagoAdapter, rijksmuseumAdapter, wellcomeAdapter, ycbaAdapter];

const VALID_PROVIDERS = new Set<MuseumProvider>(['chicago', 'rijksmuseum', 'wellcome', 'ycba']);

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  // Parsing e validazione dei query param
  const query = sp.get('q') ?? undefined;
  const providerParam = sp.getAll('provider') as MuseumProvider[];
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const limit = Math.min(40, Math.max(1, parseInt(sp.get('limit') ?? '20', 10) || 20));

  // MUSEUM_API: filtra i provider non validi silenziosamente
  const requestedProviders = providerParam.filter((p) => VALID_PROVIDERS.has(p));
  const adapters =
    requestedProviders.length > 0
      ? ALL_ADAPTERS.filter((a) => requestedProviders.includes(a.provider))
      : ALL_ADAPTERS;

  const params: MuseumSearchParams = { query, page, limit };

  try {
    const result = await aggregateSearch(adapters, params);
    return Response.json(result);
  } catch (err) {
    console.error('[/api/museums/search] Errore aggregazione:', err);
    return Response.json({ error: 'Errore interno durante la ricerca' }, { status: 500 });
  }
}
