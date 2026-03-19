import GalleryShell from '@/components/gallery/GalleryShell';

/**
 * @description Homepage — gallery di opere aggregate dai 4 musei integrati.
 * Server Component: il contenuto statico (header) è renderizzato lato server,
 * la gallery interattiva è un Client Component annidato.
 */
export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Header statico */}
      <header className="bg-zinc-950 text-white px-4 py-8 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Gigapixel Storyteller</h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-xl">
            Esplora dipinti ad altissima risoluzione da 4 musei internazionali e crea narrazioni
            visive guidate.
          </p>
        </div>
      </header>

      {/* Gallery interattiva con ricerca, filtri e infinite scroll */}
      <main className="flex-1 max-w-7xl w-full mx-auto">
        <GalleryShell />
      </main>
    </div>
  );
}
