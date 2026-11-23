import { mediaUrl } from '../api';
import type { Photo } from '../types';

export function ResponsiveImage({ photo, className, eager = false }: { photo: Photo; className?: string; eager?: boolean }) {
  const variants = [...photo.variants].sort((a, b) => a.width - b.width);
  const thumb = variants.find((item) => item.kind === 'THUMB') ?? variants[0];
  if (!thumb) return null;
  return <img
    className={className}
    src={mediaUrl(thumb.url)}
    srcSet={variants.map((item) => `${mediaUrl(item.url)} ${item.width}w`).join(', ')}
    sizes="(max-width: 640px) 100vw, (max-width: 1050px) 50vw, 33vw"
    width={photo.width}
    height={photo.height}
    alt={photo.altText}
    loading={eager ? 'eager' : 'lazy'}
    decoding="async"
  />;
}
