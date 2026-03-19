'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { gsap } from 'gsap';
import type { UnifiedArtwork } from '@/types/museum';

interface ArtworkCardProps {
  /** Opera da mostrare nella card */
  artwork: UnifiedArtwork;
}

/**
 * @description Card singola per la gallery masonry. Mostra l'immagine dell'opera
 * con skeleton shimmer durante il caricamento, overlay con metadati al hover,
 * e animazione di entrata GSAP al mount.
 *
 * @example
 * <ArtworkCard artwork={artwork} />
 */
export default function ArtworkCard({ artwork }: ArtworkCardProps) {
  const [loaded, setLoaded] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  // UX: animazione di entrata su mount — l'effetto stagger naturale deriva
  // dall'ordine di rendering sequenziale delle card da parte di React.
  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
    );
  }, []);

  return (
    <article ref={cardRef} className="break-inside-avoid mb-3" style={{ opacity: 0 }}>
      <Link href={`/artwork/${artwork.id}`} className="block group">
        {/* UX: il container con aspect-ratio evita layout shift prima del caricamento.
            Bordo giallo Bauhaus appare all'hover invece del banale scale. */}
        <div
          className="relative overflow-hidden bg-zinc-900 border-2 border-transparent group-hover:border-[#e8c832] transition-[border-color] duration-200"
          style={{ aspectRatio: artwork.aspectRatio ?? 1.33 }}
        >
          {/* Skeleton shimmer su sfondo scuro */}
          {!loaded && <div className="absolute inset-0 animate-pulse bg-zinc-800 z-10" />}

          {/* IIIF: immagine thumbnail dal server IIIF del museo.
              unoptimized: l'URL IIIF è già dimensionato correttamente (400px). */}
          <Image
            src={artwork.imageUrl}
            alt={`${artwork.title} — ${artwork.artist}`}
            fill
            unoptimized
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="object-cover transition-transform duration-500 group-hover:scale-103"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />

          {/* Overlay metadati — fondo nero solido dal basso, stile Bauhaus */}
          <div className="absolute inset-x-0 bottom-0 bg-black/90 border-t-2 border-[#e8c832] px-2.5 py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-250 pointer-events-none">
            <p className="text-[#f0ede8] font-mono font-bold text-xs leading-tight line-clamp-2 uppercase tracking-tight">
              {artwork.title}
            </p>
            <p className="text-zinc-400 font-mono text-[10px] mt-0.5 line-clamp-1">
              {artwork.artist}
            </p>
            <span className="inline-block mt-1.5 text-[9px] font-mono font-bold tracking-[0.2em] text-[#e8c832] uppercase">
              {artwork.museum.shortName}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
