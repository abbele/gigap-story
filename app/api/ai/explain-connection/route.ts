// AI: /api/ai/explain-connection — spiega la motivazione visiva di una connessione tra opere.
//
// POST /api/ai/explain-connection
//   Body: {
//     sourceTitle: string,         -- opera nel waypoint corrente
//     sourceArtist: string,
//     connectedTitle: string,      -- opera simile trovata da CLIP
//     connectedArtist: string,
//     connectedProvider: string,
//     similarity: number,          -- [0,1] — usato nel prompt per calibrare il tono
//   }
//   Risposta: { explanation: string }   -- 1-2 frasi in italiano
//   Errore:   { error: string }         -- 503 se AI non configurata

import type { NextRequest } from 'next/server';
import { isAiEnabled, chatComplete } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

interface ExplainBody {
  sourceTitle: string;
  sourceArtist: string;
  connectedTitle: string;
  connectedArtist: string;
  connectedProvider: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  if (!isAiEnabled()) {
    return Response.json(
      { error: 'AI non configurata — imposta AI_API_KEY in .env.local' },
      { status: 503 },
    );
  }

  let body: ExplainBody;
  try {
    body = (await request.json()) as ExplainBody;
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { sourceTitle, sourceArtist, connectedTitle, connectedArtist, similarity } = body;

  if (!sourceTitle || !connectedTitle) {
    return Response.json(
      { error: 'sourceTitle e connectedTitle sono obbligatori' },
      { status: 400 },
    );
  }

  // AI: calibra il tono in base alla similarity — alta (>0.85) → molto simili, bassa (<0.65) → affinità sottile
  const similarityLabel =
    similarity >= 0.85
      ? 'molto alta (le due opere condividono elementi visivi evidenti)'
      : similarity >= 0.7
        ? 'significativa (le due opere hanno affinità visive riconoscibili)'
        : 'sottile (le due opere hanno risonanze visive meno immediate)';

  try {
    const explanation = await chatComplete(
      [
        {
          role: 'system',
          content:
            "Sei un critico d'arte che individua connessioni visive tra dipinti di epoche e musei diversi. Descrivi le affinità in modo evocativo e preciso, concentrandoti su composizione, palette cromatica, luce, soggetto o stile — mai in modo generico.",
        },
        {
          role: 'user',
          content: `Un algoritmo di visione artificiale (CLIP) ha trovato una connessione visiva di similarità ${similarityLabel} tra:

- "${sourceTitle}" di ${sourceArtist}
- "${connectedTitle}" di ${connectedArtist}

Scrivi 1-2 frasi in italiano che spiegano quale elemento visivo accomuna queste due opere. Sii specifico sugli aspetti formali (luce, colore, composizione, soggetto, tecnica). Solo testo plain, nessun prefisso.`,
        },
      ],
      { maxTokens: 150, temperature: 0.7 },
    );

    return Response.json({ explanation });
  } catch (err) {
    console.error('[POST /api/ai/explain-connection]', err);
    return Response.json(
      { error: 'Errore durante la generazione della spiegazione' },
      { status: 500 },
    );
  }
}
