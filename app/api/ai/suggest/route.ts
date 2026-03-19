// AI: /api/ai/suggest — suggerisce il testo narrativo per un singolo waypoint.
//
// POST /api/ai/suggest
//   Body: {
//     artworkTitle: string,
//     artworkArtist: string,
//     artworkDate?: string,
//     waypointIndex: number,       -- 0-based
//     totalWaypoints: number,
//     existingText?: string,       -- HTML Tiptap, opzionale
//   }
//   Risposta: { text: string }     -- testo plain, pronto per Tiptap
//   Errore:   { error: string }    -- 503 se AI non configurata

import type { NextRequest } from 'next/server';
import { isAiEnabled, chatComplete } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

interface SuggestBody {
  artworkTitle: string;
  artworkArtist: string;
  artworkDate?: string;
  waypointIndex: number;
  totalWaypoints: number;
  existingText?: string;
}

export async function POST(request: NextRequest) {
  // AI: verifica che il provider sia configurato prima di processare la richiesta
  if (!isAiEnabled()) {
    return Response.json(
      { error: 'AI non configurata — imposta AI_API_KEY in .env.local' },
      { status: 503 },
    );
  }

  let body: SuggestBody;
  try {
    body = (await request.json()) as SuggestBody;
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { artworkTitle, artworkArtist, artworkDate, waypointIndex, totalWaypoints, existingText } =
    body;

  if (!artworkTitle) {
    return Response.json({ error: 'artworkTitle è obbligatorio' }, { status: 400 });
  }

  const dateInfo = artworkDate ? ` (${artworkDate})` : '';

  // AI: contestualizza il prompt con posizione del waypoint nella storia
  const positionContext =
    waypointIndex === 0
      ? "È il waypoint di apertura della storia — deve introdurre l'opera e catturare l'attenzione."
      : waypointIndex === totalWaypoints - 1
        ? "È il waypoint conclusivo — deve chiudere il percorso con un'osservazione finale significativa."
        : `È il waypoint ${waypointIndex + 1} di ${totalWaypoints} — deve approfondire un aspetto specifico dell'opera.`;

  const existingInfo = existingText?.replace(/<[^>]*>/g, '').trim()
    ? `Il testo attuale è: "${existingText.replace(/<[^>]*>/g, '').trim()}". Riscrivilo o miglioralo mantenendo lo stesso soggetto.`
    : "Non c'è testo esistente. Scrivi un testo coinvolgente per questo momento.";

  try {
    const text = await chatComplete(
      [
        {
          role: 'system',
          content:
            "Sei un mediatore culturale esperto che crea testi narrativi brevi per percorsi interattivi all'interno di dipinti ad alta risoluzione. I tuoi testi sono evocativi, accessibili a un pubblico non specializzato, mai didascalici.",
        },
        {
          role: 'user',
          content: `Opera: "${artworkTitle}" di ${artworkArtist}${dateInfo}.
${positionContext}
${existingInfo}
Scrivi in italiano, 2-4 frasi. Solo testo plain, nessuna formattazione, nessun prefisso.`,
        },
      ],
      { maxTokens: 200, temperature: 0.75 },
    );

    return Response.json({ text });
  } catch (err) {
    console.error('[POST /api/ai/suggest]', err);
    return Response.json({ error: 'Errore durante la generazione del testo' }, { status: 500 });
  }
}
