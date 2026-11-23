// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResponsiveImage } from './ResponsiveImage';
import type { Photo } from '../types';

const photo: Photo = {
  id: '00000000-0000-4000-8000-000000000000',
  originalName: 'sample.jpg',
  altText: 'Một ảnh mẫu',
  width: 1600,
  height: 900,
  currentVersion: 1,
  createdAt: new Date(0).toISOString(),
  originalUrl: '/media/photos/id/v1/original.jpg',
  manifestUrl: null,
  variants: [
    { kind: 'THUMB', url: '/media/photos/id/v1/thumb.webp', width: 320, height: 180, mimeType: 'image/webp', byteSize: 1 },
    { kind: 'MEDIUM', url: '/media/photos/id/v1/medium.webp', width: 1024, height: 576, mimeType: 'image/webp', byteSize: 2 },
    { kind: 'LARGE', url: '/media/photos/id/v1/large.webp', width: 1600, height: 900, mimeType: 'image/webp', byteSize: 3 },
  ],
};

describe('ResponsiveImage', () => {
  it('renders responsive and accessible metadata without using original as the card source', () => {
    const { getByRole } = render(<ResponsiveImage photo={photo} />);
    const image = getByRole('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toContain('thumb.webp');
    expect(image.getAttribute('srcset')).toContain('medium.webp 1024w');
    expect(image.getAttribute('srcset')).not.toContain('original.jpg');
    expect(image.getAttribute('sizes')).toBeTruthy();
    expect(image.getAttribute('width')).toBe('1600');
    expect(image.getAttribute('height')).toBe('900');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('alt')).toBe('Một ảnh mẫu');
  });
});
