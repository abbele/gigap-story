// Tipo per l'autore anonimo identificato tramite cookie

// AUTH: l'autore non fa login — viene identificato da un UUID v4 salvato in un
// cookie client-side "author_id" (maxAge: 365d, sameSite: lax).
// Il cookieId viene passato come header "x-author-cookie-id" a ogni request
// di scrittura verso le API routes, che lo confrontano con il record in Supabase.
export interface AnonymousAuthor {
  cookieId: string;
  /** Nome opzionale scelto dall'autore, salvato in localStorage */
  displayName?: string;
}
