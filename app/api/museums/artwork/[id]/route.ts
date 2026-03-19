// MUSEUM_API: Endpoint per recuperare il dettaglio di una singola opera.
// L'id è nel formato composito "{provider}_{localId}" (es. "chicago_12345").
// Fa il dispatch all'adapter corretto e restituisce UnifiedArtwork.
//
// GET /api/museums/artwork/[id]
// Params:
//   id - ID composito prefissato dal provider
//
// Risposta: UnifiedArtwork

import type { NextRequest } from 'next/server';
import type { MuseumAdapter } from '@/types/museum';
import { parseCompositeId } from '@/lib/museums/transformer';
import { chicagoAdapter } from '@/lib/museums/chicago';
import { rijksmuseumAdapter } from '@/lib/museums/rijksmuseum';
import { wellcomeAdapter } from '@/lib/museums/wellcome';
import { ycbaAdapter } from '@/lib/museums/ycba';

// PERF: cache 1h — i metadati di un'opera cambiano raramente
export const revalidate = 3600;

const ADAPTERS: Record<string, MuseumAdapter> = {
  chicago: chicagoAdapter,
  rijksmuseum: rijksmuseumAdapter,
  wellcome: wellcomeAdapter,
  ycba: ycbaAdapter,
};

export async function GET(
  _request: NextRequest,
  // NOTA: in Next.js 15+ params è una Promise — va sempre awaited
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = parseCompositeId(id);
  if (!parsed) {
    return Response.json(
      { error: `Formato id non valido: "${id}". Atteso: "{provider}_{localId}"` },
      { status: 400 },
    );
  }

  const adapter = ADAPTERS[parsed.provider];
  if (!adapter) {
    return Response.json({ error: `Provider sconosciuto: "${parsed.provider}"` }, { status: 404 });
  }

  try {
    const raw = await adapter.getArtwork(parsed.localId);
    const artwork = adapter.transformToUnified(raw);
    return Response.json(artwork);
  } catch (err) {
    console.error(`[/api/museums/artwork/${id}] Errore:`, err);
    return Response.json({ error: `Opera non trovata: ${id}` }, { status: 404 });
  }
}
