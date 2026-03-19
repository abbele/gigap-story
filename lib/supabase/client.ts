// SUPABASE: client singleton per l'uso lato client (browser)
// Le variabili NEXT_PUBLIC_* sono esposte al browser — contengono solo la anon key,
// che è sicura da esporre (i permessi sono gestiti nelle API routes tramite x-author-cookie-id).
import { createClient } from '@supabase/supabase-js';

import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY mancanti in .env.local',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
