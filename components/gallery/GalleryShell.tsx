'use client';

import { useState } from 'react';
import type { MuseumProvider } from '@/types/museum';
import SearchBar from './SearchBar';
import MuseumFilter from './MuseumFilter';
import ArtworkGallery from './ArtworkGallery';

/**
 * @description Shell della gallery che coordina lo stato di ricerca e filtri.
 * Gestisce `query` e `providers` come stato locale e li passa ai componenti figli.
 * È un Client Component perché la ricerca e i filtri dipendono dall'interazione utente.
 *
 * @example
 * // Usato in app/page.tsx:
 * <GalleryShell />
 */
export default function GalleryShell() {
  const [query, setQuery] = useState('');
  const [providers, setProviders] = useState<MuseumProvider[]>([]);

  return (
    <section className="px-4 py-6 md:px-6 lg:px-8">
      {/* Barra di ricerca e filtri museo */}
      <div className="mb-5 flex flex-col gap-3">
        <SearchBar onSearch={setQuery} />
        <MuseumFilter selected={providers} onChange={setProviders} />
      </div>

      {/* Gallery masonry con infinite scroll */}
      <ArtworkGallery query={query} providers={providers} />
    </section>
  );
}
