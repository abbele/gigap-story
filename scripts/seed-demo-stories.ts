/**
 * Seed delle storie demo pre-pubblicate.
 *
 * Usa: pnpm seed:demo
 *
 * Il script chiama direttamente l'adapter Rijksmuseum per ottenere i dati
 * reali della Ronda di Notte, poi inserisce la storia in Supabase.
 *
 * SUPABASE: richiede NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 * nel file .env.local (caricato automaticamente dallo script).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { rijksmuseumAdapter } from '../lib/museums/rijksmuseum';
import type { UnifiedArtwork } from '../types/museum';
import type { Waypoint } from '../types/story';

// AUTH: UUID fisso per l'autore demo — distingue le storie seed dalle storie utente
const DEMO_AUTHOR_COOKIE_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_AUTHOR_NAME = 'Gigapixel Storyteller — Demo';

// MUSEUM_API: ID numerico Rijksmuseum per SK-C-5 (De Nachtwacht / Ronda di Notte)
const NIGHT_WATCH_NUMERIC_ID = '200100988';

// --- Waypoint della Ronda di Notte ---
//
// Coordinate nel sistema OSD: immagine normalizzata a width=1.
// La Ronda di Notte misura 363×437 cm → aspect ratio 437/363 ≈ 1.204
// → height OSD = 363/437 ≈ 0.831
//
// Composizione (da sinistra a destra):
//   - Estrema sinistra: moschettieri, picchieri, fumo
//   - Centro-sinistra: Capitano Banninck Cocq (nero) + Ten. van Ruytenburch (giallo)
//   - Centro: la bambina con il pollo, il cane, il tamburino
//   - Centro-destra: l'alfiere con la bandiera, figure sullo sfondo
//   - Estrema destra: altri miliziani; Rembrandt visibile come figura semicoperta
//   - In alto a destra: l'arco, le figure in secondo piano

function wp(
  idx: number,
  x: number,
  y: number,
  width: number,
  height: number,
  transition: Waypoint['transition'],
  duration: number,
  html: string,
): Waypoint {
  return {
    id: `demo-nw-${idx}`,
    viewport: { x, y, width, height },
    transition,
    duration,
    text: html,
  };
}

const NIGHT_WATCH_WAYPOINTS: Waypoint[] = [
  wp(
    1,
    // Panoramica completa — introduzione
    0,
    0,
    1.0,
    0.831,
    'ease',
    6,
    `<p><strong>Amsterdam, 1642.</strong> Rembrandt van Rijn riceve la commissione più ambiziosa della sua carriera: ritrarre la compagnia di fanteria del Capitano Frans Banninck Cocq.</p><p>Invece del consueto ritratto di gruppo statico, Rembrandt inventa qualcosa di mai visto: una scena in movimento, con figure che escono dall'ombra verso la luce.</p>`,
  ),
  wp(
    2,
    // Capitano Banninck Cocq e Tenente van Ruytenburch — coppia centrale
    0.26,
    0.04,
    0.4,
    0.58,
    'ease',
    8,
    `<p>Al centro domina il <strong>Capitano Frans Banninck Cocq</strong> in abito nero con fascia rossa, il braccio teso in avanti. La sua mano proietta un'ombra sulla giubba gialla del Tenente <strong>Willem van Ruytenburch</strong>.</p><p>Questo dettaglio — l'ombra dipinta su un altro personaggio — è straordinario: Rembrandt trattava la luce come un terzo protagonista della scena.</p>`,
  ),
  wp(
    3,
    // La bambina misteriosa — bassa sinistra
    0.24,
    0.42,
    0.22,
    0.28,
    'spring',
    7,
    `<p>Nascosta tra le gambe dei miliziani, una <strong>bambina in abito dorato</strong> porta appeso alla cintura un pollo dalle zampe legate.</p><p>È uno dei più grandi enigmi della storia dell'arte olandese: chi è? Perché è qui? Alcuni storici la identificano come simbolo della compagnia, altri come allegoria della vittoria. Rembrandt non lasciò spiegazioni.</p>`,
  ),
  wp(
    4,
    // Rembrandt nell'ombra — autoriferimento in alto a destra
    0.56,
    0.05,
    0.26,
    0.28,
    'ease',
    7,
    `<p>In alto a destra, tra le teste dei miliziani, si intravede un volto che ci guarda con discrezione: è <strong>Rembrandt stesso</strong>, che si è inserito nella scena.</p><p>Questo tipo di autoriferimento — chiamato <em>Eigenbild</em> — era comune tra i maestri fiamminghi. Rembrandt lo trasformò in un gesto quasi poetico: il pittore che si nasconde nella propria opera.</p>`,
  ),
  wp(
    5,
    // I moschettieri a sinistra — il fumo e l'azione
    0.01,
    0.1,
    0.28,
    0.58,
    'ease',
    7,
    `<p>Sul lato sinistro, tre moschettieri sono colti in momenti diversi dello stesso gesto: uno carica, uno soffia sulla polvere da sparo, uno spara. È una vera <strong>sequenza cinematografica</strong>, incomprensibile per l'epoca.</p><p>Rembrandt compresse il tempo sulla tela: passato, presente e futuro dell'azione coesistono nello stesso dipinto.</p>`,
  ),
  wp(
    6,
    // La luce come protagonista — area centrale illuminata
    0.15,
    0.03,
    0.6,
    0.72,
    'ease',
    8,
    `<p>La Ronda di Notte è in realtà una scena <strong>diurna</strong>: il titolo nasce dall'accumulo secolare di vernice scura che ha progressivamente oscurato il dipinto.</p><p>Il restauro del 2019–2021 (Operation Night Watch) ha rivelato dettagli perduti da decenni. La tecnica del <em>chiaroscuro</em> — contrasto violento tra luce e ombra — fu il contributo più rivoluzionario di Rembrandt alla pittura europea.</p>`,
  ),
];

// --- Util: carica .env.local ---

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local non trovato — usa env vars già impostate nell'ambiente
  }
}

// --- Main ---

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // AUTH: lo script di seed richiede la service role key per bypassare i permessi anon.
  // Aggiungila a .env.local: SUPABASE_SERVICE_ROLE_KEY=eyJ...
  // Trovala su: Supabase Dashboard → Project Settings → API → service_role
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'Errore: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY mancanti.\n' +
        '  Trovi la service role key su: Supabase Dashboard → Project Settings → API → service_role',
    );
    process.exit(1);
  }

  // SUPABASE: client con service role key — bypassa permessi anon, solo per script locali
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('→ Fetch Ronda di Notte da Rijksmuseum...');
  const raw = await rijksmuseumAdapter.getArtwork(NIGHT_WATCH_NUMERIC_ID);
  const artwork: UnifiedArtwork = rijksmuseumAdapter.transformToUnified(raw);

  console.log(`  Titolo:  ${artwork.title}`);
  console.log(`  Artista: ${artwork.artist}`);
  console.log(`  IIIF:    ${artwork.iiifInfoUrl}`);

  // Controlla se la storia demo esiste già per evitare duplicati
  const { data: existing } = await supabase
    .from('stories')
    .select('id')
    .eq('author_cookie_id', DEMO_AUTHOR_COOKIE_ID)
    .eq('title', artwork.title)
    .maybeSingle();

  if (existing) {
    console.log(`  Story già presente (id: ${existing.id}) — nessuna azione.`);
    process.exit(0);
  }

  // SUPABASE: inserisce la storia demo come published
  const { data, error } = await supabase
    .from('stories')
    .insert({
      status: 'published',
      title: artwork.title,
      description:
        "Un viaggio guidato attraverso la più grande opera di Rembrandt, alla scoperta dei dettagli nascosti che rendono La Ronda di Notte unica nella storia dell'arte.",
      author_cookie_id: DEMO_AUTHOR_COOKIE_ID,
      author_display_name: DEMO_AUTHOR_NAME,
      artwork_data: artwork as unknown as Record<string, unknown>,
      image_source: artwork.iiifInfoUrl,
      waypoints: NIGHT_WATCH_WAYPOINTS as unknown as Record<string, unknown>[],
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Errore Supabase:', error.message);
    process.exit(1);
  }

  console.log(`\n✓ Storia demo inserita con successo.`);
  console.log(`  ID: ${data.id}`);
  console.log(`  URL: /story/${data.id}`);
}

main().catch((err) => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
