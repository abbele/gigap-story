/**
 * @description Skeleton placeholder per una card opera durante il caricamento.
 * Mantiene la struttura visiva del masonry layout con un aspect ratio verosimile.
 *
 * @example
 * {isFetchingNextPage && Array.from({ length: 8 }).map((_, i) => (
 *   <ArtworkCardSkeleton key={i} index={i} />
 * ))}
 */

interface ArtworkCardSkeletonProps {
  /** Indice usato per variare leggermente l'aspect ratio tra skeleton adiacenti */
  index?: number;
}

// UX: variazioni di aspect ratio per simulare un masonry realistico durante il caricamento
const ASPECT_RATIOS = [1.33, 0.75, 1.0, 1.5, 0.67, 1.25, 0.8, 1.1];

export default function ArtworkCardSkeleton({ index = 0 }: ArtworkCardSkeletonProps) {
  const ratio = ASPECT_RATIOS[index % ASPECT_RATIOS.length];

  return (
    <div className="break-inside-avoid mb-3">
      <div className="rounded-lg animate-pulse bg-zinc-200" style={{ aspectRatio: ratio }} />
    </div>
  );
}
