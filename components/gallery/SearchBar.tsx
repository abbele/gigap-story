'use client';

import { useEffect, useRef, useState } from 'react';

interface SearchBarProps {
  /** Chiamato 300ms dopo l'ultima modifica dell'input */
  onSearch: (query: string) => void;
  placeholder?: string;
}

/**
 * @description Barra di ricerca testuale con debounce 300ms.
 * Notifica il parent solo quando l'utente smette di digitare per 300ms,
 * riducendo le chiamate API durante la digitazione veloce.
 *
 * @example
 * <SearchBar onSearch={(q) => setQuery(q)} placeholder="Cerca un'opera..." />
 */
export default function SearchBar({
  onSearch,
  placeholder = 'Cerca opere, artisti, musei...',
}: SearchBarProps) {
  const [value, setValue] = useState('');

  // PERF: debounce 300ms — evita una chiamata API per ogni carattere digitato.
  // onSearch è stabile (useState setter nel parent) — inclusione nella dep array è sicura.
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="relative w-full max-w-2xl">
      {/* Icona lente d'ingrandimento */}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M13.5 13.5L17 17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-shadow"
        aria-label="Cerca opere"
      />

      {/* UX: pulsante cancella visibile solo quando c'è testo */}
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
          aria-label="Cancella ricerca"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
