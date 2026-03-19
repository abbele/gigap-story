// AUTH: Gestione del cookie autore anonimo.
// L'identità è basata su un UUID v4 generato al primo accesso e persistito
// nel cookie "author_id" (maxAge: 1 anno, sameSite: lax).
// Questo modulo è BROWSER-ONLY: non importarlo in Server Components o API routes.
// Le API routes leggono l'identità dall'header "x-author-cookie-id" impostato dal client.

import Cookies from 'js-cookie';

/** Nome del cookie che persiste l'identità dell'autore anonimo */
const COOKIE_NAME = 'author_id';

/** Chiave localStorage per il nome display opzionale */
export const DISPLAY_NAME_KEY = 'author_display_name';

/** Durata del cookie in giorni */
const COOKIE_MAX_AGE_DAYS = 365;

// AUTH: fallback UUID per ambienti non-sicuri (HTTP non-localhost) dove
// crypto.randomUUID() non è disponibile.
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * @description Restituisce l'ID autore dal cookie.
 * Se il cookie non esiste, ne genera uno nuovo e lo persiste.
 * Sicuro da chiamare più volte — restituisce sempre lo stesso ID nella sessione.
 *
 * @returns UUID v4 dell'autore anonimo
 */
export function getOrCreateAuthorId(): string {
  const existing = Cookies.get(COOKIE_NAME);
  if (existing) return existing;

  const newId = generateUUID();
  Cookies.set(COOKIE_NAME, newId, {
    expires: COOKIE_MAX_AGE_DAYS,
    sameSite: 'lax',
    // AUTH: secure:true solo in produzione — in dev HTTP non funzionerebbe
    secure: process.env.NODE_ENV === 'production',
  });
  return newId;
}

/**
 * @description Legge l'ID autore senza crearne uno nuovo.
 * Utile per verificare se l'utente ha già un'identità.
 *
 * @returns UUID autore, o undefined se non esiste ancora
 */
export function readAuthorId(): string | undefined {
  return Cookies.get(COOKIE_NAME);
}
