import Link from 'next/link';
import GalleryShell from '@/components/gallery/GalleryShell';

/**
 * @description Homepage — gallery di opere aggregate dai 4 musei integrati.
 * Server Component: l'header è renderizzato lato server,
 * la gallery interattiva è un Client Component annidato.
 */
export default function Home() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Header Bauhaus — tipografia brutale, composizione geometrica */}
      <header className="border-b-2 border-[#2a2a2a] px-4 pt-10 pb-0 md:px-8 bg-[#080808]">
        <div className="max-w-7xl mx-auto">
          {/* Etichetta categoria — grid Bauhaus */}
          <div className="flex items-center gap-3 mb-5">
            <span className="w-3 h-3 bg-[#e8c832] block shrink-0" />
            <span className="text-[10px] tracking-[0.35em] uppercase font-mono text-zinc-500">
              Archivio Visivo — 4 Musei Internazionali
            </span>
          </div>

          {/* Titolo — dimensione espressiva, proporzionato alla viewport */}
          <h1
            className="font-mono font-bold uppercase leading-none text-[#f0ede8]"
            style={{ fontSize: 'clamp(2.8rem, 9vw, 7.5rem)', letterSpacing: '-0.03em' }}
          >
            Gigapixel
            <br />
            <span className="text-[#e8c832]">Storyteller</span>
          </h1>

          {/* Separatore geometrico orizzontale */}
          <div className="mt-7 flex items-center">
            <div className="h-0.5 w-full bg-[#2a2a2a]" />
            <div className="w-4 h-4 bg-[#e8c832] shrink-0 mx-4" />
            <div className="h-0.5 w-12 bg-[#2a2a2a] shrink-0" />
          </div>

          {/* Sottotitolo — mono, piccolo, in basso nell'header */}
          <div className="mt-4 mb-6 flex items-center gap-6">
            <p className="text-xs text-zinc-500 font-mono tracking-wide max-w-lg">
              Esplora dipinti ad altissima risoluzione e crea narrazioni visive guidate.
            </p>
            <Link
              href="/stories"
              className="shrink-0 text-[10px] font-mono tracking-[0.25em] uppercase text-[#e8c832] border border-[#e8c832]/40 px-3 py-1.5 hover:bg-[#e8c832] hover:text-[#080808] transition-colors"
            >
              Storie →
            </Link>
          </div>
        </div>
      </header>

      {/* Gallery interattiva con ricerca, filtri e infinite scroll */}
      <main className="flex-1 max-w-7xl w-full mx-auto">
        <GalleryShell />
      </main>
    </div>
  );
}
