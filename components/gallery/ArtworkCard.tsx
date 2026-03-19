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
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
    );
  }, []);

  return (
    <article ref={cardRef} className="break-inside-avoid mb-3" style={{ opacity: 0 }}>
      <Link href={`/artwork/${artwork.id}`} className="block group">
        {/* UX: il container con aspect-ratio evita layout shift prima del caricamento */}
        <div
          className="relative overflow-hidden rounded-lg bg-zinc-100"
          style={{ aspectRatio: artwork.aspectRatio ?? 1.33 }}
        >
          {/* Skeleton shimmer visibile fino al caricamento dell'immagine */}
          {!loaded && <div className="absolute inset-0 animate-pulse bg-zinc-200 z-10" />}

          {/* IIIF: immagine thumbnail dal server IIIF del museo.
              unoptimized: l'URL IIIF è già dimensionato correttamente (400px) —
              ottimizzare ulteriormente via Next.js sarebbe ridondante. */}
          <Image
            src={artwork.imageUrl}
            alt={`${artwork.title} — ${artwork.artist}`}
            fill
            unoptimized
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />

          {/* UX: overlay con metadati — visibile solo al hover tramite CSS */}
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 pointer-events-none">
            <p className="text-white font-semibold text-sm leading-tight line-clamp-2">
              {artwork.title}
            </p>
            <p className="text-zinc-300 text-xs mt-0.5 line-clamp-1">{artwork.artist}</p>
            <span className="inline-block mt-1.5 self-start rounded bg-white/20 px-1.5 py-0.5 text-xs text-white backdrop-blur-sm">
              {artwork.museum.shortName}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
