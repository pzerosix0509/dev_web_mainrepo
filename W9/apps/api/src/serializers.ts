import type { Photo, PhotoVariant, PhotoVersion } from '@prisma/client';

type FullPhoto = Photo & { versions: (PhotoVersion & { variants: PhotoVariant[] })[] };

export function serializePhoto(photo: FullPhoto) {
  const version = photo.versions.find((item) => item.version === photo.currentVersion);
  if (!version) throw new Error('Current photo version is missing');
  const variants = version.variants.filter((item) => item.kind !== 'TILE').map((item) => ({
    kind: item.kind,
    url: `/media/${item.storageKey}`,
    width: item.width,
    height: item.height,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
  }));
  return {
    id: photo.id,
    originalName: photo.originalName,
    altText: photo.altText,
    width: photo.width,
    height: photo.height,
    currentVersion: photo.currentVersion,
    createdAt: photo.createdAt.toISOString(),
    variants,
    originalUrl: `/media/${version.normalizedOriginalKey}`,
    manifestUrl: version.manifestKey ? `/media/${version.manifestKey}` : null,
  };
}
