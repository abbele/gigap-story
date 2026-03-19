// AI: /api/ai/auto-story — genera suggerimenti per 3-8 waypoint dell'intera storia.
// Il modello propone titoli e testi narrativi; i viewport vengono impostati dall'utente
// dopo aver navigato il dipinto.
//
// POST /api/ai/auto-story
//   Body: {
//     artworkTitle: string,
//     artworkArtist: string,
//     artworkDate?: string,
//     artworkMedium?: string,
//     waypointCount?: number,   -- default 6, range [3, 8]
//   }
//   Risposta: { suggestions: { title: string; text: string }[] }
//   Errore:   { error: string }

import type { NextRequest } from 'next/server';
import { isAiEnabled, chatComplete } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

interface AutoStoryBody {
  artworkTitle: string;
  artworkArtist: string;
  artworkDate?: string;
  artworkMedium?: string;
  waypointCount?: number;
}

export interface WaypointSuggestion {
  title: string;
  text: string;
}

export async function POST(request: NextRequest) {
  if (!isAiEnabled()) {
    return Response.json(
      { error: 'AI non configurata — imposta AI_API_KEY in .env.local' },
      { status: 503 },
    );
  }

  let body: AutoStoryBody;
  try {
    body = (await request.json()) as AutoStoryBody;
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { artworkTitle, artworkArtist, artworkDate, artworkMedium, waypointCount = 6 } = body;

  if (!artworkTitle) {
    return Response.json({ error: 'artworkTitle è obbligatorio' }, { status: 400 });
  }

  // AI: limita il conteggio per evitare risposte troppo lunghe che possono causare troncature
  const count = Math.max(3, Math.min(8, waypointCount));
  const meta = [artworkDate, artworkMedium].filter(Boolean).join(', ');
  const metaInfo = meta ? ` (${meta})` : '';

  try {
    const raw = await chatComplete(
      [
        {
          role: 'system',
          content:
            "Sei un mediatore culturale esperto che progetta percorsi narrativi interattivi all'interno di dipinti ad alta risoluzione. Rispondi sempre e solo in JSON valido, senza testo aggiuntivo.",
        },
        {
          role: 'user',
          content: `Proponi ${count} waypoint per una storia sull'opera "${artworkTitle}" di ${artworkArtist}${metaInfo}.
Ogni waypoint deve guidare l'attenzione su un aspetto diverso: composizione generale, dettagli, simbolismo, tecnica pittorica, contesto storico, figure o oggetti specifici.
Il primo waypoint introduce l'opera nella sua interezza. L'ultimo chiude il percorso con una riflessione.
Rispondi SOLO con un array JSON (nessun testo prima o dopo):
[{"title": "titolo breve del focus", "text": "testo narrativo di 2-3 frasi in italiano"}]`,
        },
      ],
      // AI: max_tokens più alto per contenere l'intero array JSON
      { maxTokens: 900, temperature: 0.8 },
    );

    // AI: estrai il JSON anche se il modello aggiunge testo attorno (alcuni modelli lo fanno)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Risposta AI non contiene un JSON array');

    const suggestions = JSON.parse(match[0]) as WaypointSuggestion[];
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('JSON non è un array valido');
    }

    return Response.json({ suggestions });
  } catch (err) {
    console.error('[POST /api/ai/auto-story]', err);
    return Response.json({ error: 'Errore durante la generazione della storia' }, { status: 500 });
  }
}
