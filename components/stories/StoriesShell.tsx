'use client';

// UX: Shell della pagina /stories.
// Gestisce i filtri interattivi (provider, sort) aggiornando i searchParams
// e il caricamento di ulteriori storie tramite l'API /api/stories.

import { useCallback, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Story } from '@/types/story';
import StoryCard from './StoryCard';

interface StoriesShellProps {
  /** Storie iniziali caricate lato server */
  initialStories: Story[];
  initialTotal: number;
}

const PROVIDERS = [
  { value: '', label: 'Tutti i musei' },
  { value: 'chicago', label: 'Chicago' },
  { value: 'rijksmuseum', label: 'Rijksmuseum' },
  { value: 'wellcome', label: 'Wellcome' },
  { value: 'ycba', label: 'YCBA' },
] as const;

const SORTS = [
  { value: 'recent', label: 'Più recenti' },
  { value: 'popular', label: 'Più viste' },
] as const;

/**
 * @description Shell della pagina listing storie pubblicate.
 * Riceve le storie iniziali dal Server Component e gestisce client-side
 * filtri (provider museo) e ordinamento (recente / popolare).
 * Il caricamento di altre pagine avviene via fetch dell'API /api/stories.
 *
 * @example
 * // Usato in app/stories/page.tsx:
 * <StoriesShell initialStories={stories} initialTotal={total} />
 *
 * @see app/stories/page.tsx
 * @see components/stories/StoryCard.tsx
 */
export default function StoriesShell({ initialStories, initialTotal }: StoriesShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // UX: storie mostrate — iniziano con quelle server, si espandono al "carica altri"
  const [stories, setStories] = useState(initialStories);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const activeProvider = searchParams.get('provider') ?? '';
  const activeSort = searchParams.get('sort') ?? 'recent';

  // UX: aggiorna URL params e delega il refetch al Server Component via router.push
  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // PERF: startTransition evita il blocco del UI durante la navigazione
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
        // Reset delle storie client-side al cambio filtro (il server rende le nuove)
        setStories(initialStories);
        setTotal(initialTotal);
        setCurrentPage(1);
      });
    },
    [searchParams, pathname, router, initialStories, initialTotal],
  );

  // SUPABASE: carica la pagina successiva dall'API
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
        sort: activeSort,
        ...(activeProvider ? { provider: activeProvider } : {}),
      });

      const res = await fetch(`/api/stories?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { stories: Story[]; total: number };
      setStories((prev) => [...prev, ...data.stories]);
      setTotal(data.total);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('[StoriesShell] Errore caricamento pagina:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, currentPage, activeSort, activeProvider]);

  const hasMore = stories.length < total;

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* ─── HEADER ──────────────────────────────────────────────── */}
      <div className="px-6 py-8 md:px-12 border-b-2 border-[#2a2a2a]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1
              className="font-mono font-bold uppercase text-[#f0ede8] leading-none mb-2"
              style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)', letterSpacing: '-0.03em' }}
            >
              Storie
            </h1>
            <p className="text-xs font-mono text-zinc-600">
              {total} {total === 1 ? 'storia pubblicata' : 'storie pubblicate'}
              {isPending && (
                <span className="ml-2 text-zinc-700 animate-pulse">aggiornamento…</span>
              )}
            </p>
          </div>

          {/* ─── FILTRI ──────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro museo */}
            <div className="flex items-center gap-0">
              {PROVIDERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter('provider', value)}
                  className={`px-3 py-1.5 text-[9px] font-mono tracking-widest uppercase border-2 transition-colors ${
                    activeProvider === value
                      ? 'bg-[#e8c832] text-black border-[#e8c832]'
                      : 'bg-transparent text-zinc-500 border-[#2a2a2a] hover:border-zinc-600 hover:text-zinc-300'
                  } -ml-[2px] first:ml-0`}
                  aria-pressed={activeProvider === value}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Divisore */}
            <span className="text-zinc-700 font-mono mx-1 hidden md:block" aria-hidden>
              |
            </span>

            {/* Ordinamento */}
            <div className="flex items-center gap-0">
              {SORTS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter('sort', value)}
                  className={`px-3 py-1.5 text-[9px] font-mono tracking-widest uppercase border-2 transition-colors ${
                    activeSort === value
                      ? 'bg-[#e8c832] text-black border-[#e8c832]'
                      : 'bg-transparent text-zinc-500 border-[#2a2a2a] hover:border-zinc-600 hover:text-zinc-300'
                  } -ml-[2px] first:ml-0`}
                  aria-pressed={activeSort === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── GRIGLIA MASONRY ─────────────────────────────────────── */}
      <div className="px-6 py-8 md:px-12">
        {stories.length === 0 ? (
          // UX: stato vuoto — nessuna storia con i filtri attivi
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-[#2a2a2a]" aria-hidden />
            <p className="text-xs font-mono text-zinc-600 text-center">
              Nessuna storia trovata
              {activeProvider ? ` per il museo selezionato` : ''}.
            </p>
          </div>
        ) : (
          // UX: masonry a colonne CSS — usa break-inside-avoid sulle card
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}

        {/* ─── LOAD MORE ───────────────────────────────────────── */}
        {hasMore && (
          <div className="flex justify-center mt-10">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="px-8 py-3 border-2 border-[#2a2a2a] text-zinc-500 hover:border-[#e8c832] hover:text-[#e8c832] disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[10px] tracking-[0.3em] uppercase transition-colors"
            >
              {loadingMore ? 'Caricamento…' : `Carica altre (${total - stories.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
