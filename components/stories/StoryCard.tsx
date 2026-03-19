// UX: Card di una storia pubblicata per la pagina /stories.
// Mostra thumbnail (coverThumbnail dal primo waypoint o imageUrl dell'opera),
// titolo storia, titolo opera, museo e numero di waypoint.

import Link from 'next/link';
import Image from 'next/image';
import type { Story } from '@/types/story';

interface StoryCardProps {
  story: Story;
}

/**
 * @description Card di una storia per la griglia della pagina /stories.
 * Il click naviga a /story/[id].
 * Usa coverThumbnail se disponibile, altrimenti l'immagine dell'opera.
 *
 * @example
 * <StoryCard story={story} />
 *
 * @see app/stories/page.tsx
 * @see components/stories/StoriesShell.tsx
 */
export default function StoryCard({ story }: StoryCardProps) {
  const { artwork } = story;

  // UX: altezza della card proporzionale all'aspect ratio dell'opera
  // Se non disponibile, usiamo 16/9 come default
  const aspectRatio = artwork.aspectRatio ?? 16 / 9;

  return (
    <Link
      href={`/story/${story.id}`}
      className="group block break-inside-avoid mb-4 border-2 border-[#2a2a2a] hover:border-[#e8c832] transition-colors"
      aria-label={`Leggi la storia: ${story.title}`}
    >
      {/* Cover image */}
      <div
        className="relative w-full overflow-hidden bg-[#111]"
        style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
      >
        {story.coverThumbnail ? (
          // UX: coverThumbnail è un data URL base64 — non usa next/image
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.coverThumbnail}
            alt={`Anteprima: ${story.title}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : artwork.imageUrl ? (
          <Image
            src={artwork.imageUrl}
            alt={artwork.title}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          // Placeholder Bauhaus se non c'è thumbnail
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-[#e8c832] opacity-10" />
          </div>
        )}

        {/* Overlay scuro — si alleggerisce al hover */}
        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/25 transition-colors" />

        {/* Badge: numero waypoint */}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/80 border border-[#2a2a2a]">
          <span className="text-[8px] font-mono tracking-widest uppercase text-zinc-500">
            {story.waypoints.length} fermate
          </span>
        </div>

        {/* Badge: view count */}
        {(story.viewCount ?? 0) > 0 && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 border border-[#2a2a2a]">
            <span className="text-[8px] font-mono tracking-widest uppercase text-zinc-500">
              {story.viewCount} visite
            </span>
          </div>
        )}
      </div>

      {/* Info testuali */}
      <div className="px-3 py-3 border-t-2 border-[#2a2a2a] group-hover:border-[#e8c832] transition-colors">
        {/* Museo badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 bg-[#e8c832] block shrink-0" aria-hidden />
          <span className="text-[8px] font-mono tracking-[0.3em] uppercase text-zinc-600">
            {artwork.museum.shortName} — {artwork.museum.city}
          </span>
        </div>

        {/* Titolo storia */}
        <h3 className="text-sm font-mono font-bold uppercase text-[#f0ede8] leading-tight mb-1 group-hover:text-[#e8c832] transition-colors">
          {story.title}
        </h3>

        {/* Opera di riferimento */}
        <p className="text-[10px] font-mono text-zinc-600 leading-snug">{artwork.title}</p>

        {/* Autore */}
        {story.authorDisplayName && (
          <p className="text-[9px] font-mono text-zinc-700 mt-1.5">{story.authorDisplayName}</p>
        )}
      </div>
    </Link>
  );
}
