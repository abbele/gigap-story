'use client';

// AUTH: Hook per la gestione dell'autore anonimo.
// Legge/crea il cookie "author_id" al primo render e sincronizza
// il nome display con localStorage.

import { useCallback, useState } from 'react';
import { DISPLAY_NAME_KEY, getOrCreateAuthorId } from '@/lib/cookies/author';

interface UseAnonymousAuthorReturn {
  /** UUID v4 persistito nel cookie "author_id" */
  cookieId: string;
  /** Nome display opzionale, salvato in localStorage */
  displayName: string | undefined;
  /** Aggiorna il nome display in localStorage */
  setDisplayName: (name: string) => void;
}

/**
 * @description Gestisce l'identità dell'autore anonimo.
 * Al primo render crea il cookie se non esiste, poi espone l'ID
 * e il nome display (da localStorage) per tutta la sessione.
 *
 * @example
 * const { cookieId, displayName, setDisplayName } = useAnonymousAuthor();
 * // cookieId: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *
 * @see lib/cookies/author.ts
 * @see types/author.ts
 */
export function useAnonymousAuthor(): UseAnonymousAuthorReturn {
  // AUTH: lazy init — getOrCreateAuthorId() si esegue solo nel browser grazie a 'use client'
  const [cookieId] = useState<string>(() => getOrCreateAuthorId());

  // UX: displayName letto da localStorage nella lazy init — try/catch protegge da SSR
  // dove localStorage lancia ReferenceError. Nessun useEffect necessario.
  const [displayName, setDisplayNameState] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(DISPLAY_NAME_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });

  const setDisplayName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
      setDisplayNameState(trimmed);
    } else {
      localStorage.removeItem(DISPLAY_NAME_KEY);
      setDisplayNameState(undefined);
    }
  }, []);

  return { cookieId, displayName, setDisplayName };
}
