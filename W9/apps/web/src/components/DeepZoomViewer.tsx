import { useEffect, useRef, useState } from 'react';
import { API_URL, mediaUrl } from '../api';
import type { Photo } from '../types';
import { ResponsiveImage } from './ResponsiveImage';

type Manifest = { width: number; height: number; tileSize: number; minLevel: number; maxLevel: number; format: string };

export function DeepZoomViewer({ photo }: { photo: Photo }) {
  const element = useRef<HTMLDivElement>(null);
  const viewer = useRef<{ viewport: { zoomBy: (factor: number) => void; goHome: () => void }; destroy: () => void } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!element.current || !photo.manifestUrl) return;
    const controller = new AbortController();
    void Promise.all([
      fetch(mediaUrl(photo.manifestUrl), { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error('manifest'); return response.json() as Promise<Manifest>; }),
      import('openseadragon').then((module) => module.default),
    ]).then(([manifest, OpenSeadragon]) => {
        if (!element.current) return;
        const prefix = `${API_URL}${photo.manifestUrl!.replace(/manifest\.json$/, 'tiles')}`;
        viewer.current = OpenSeadragon({
          element: element.current,
          showNavigationControl: false,
          showNavigator: true,
          navigatorPosition: 'BOTTOM_RIGHT',
          animationTime: 0.7,
          blendTime: 0.2,
          tileSources: {
            width: manifest.width,
            height: manifest.height,
            tileSize: manifest.tileSize,
            minLevel: manifest.minLevel,
            maxLevel: manifest.maxLevel,
            getTileUrl: (level: number, x: number, y: number) => `${prefix}/${level}/${x}_${y}.${manifest.format}`,
          },
        });
      })
      .catch((caught) => { if ((caught as Error).name !== 'AbortError') setError(true); });
    return () => { controller.abort(); viewer.current?.destroy(); viewer.current = null; };
  }, [photo]);
  if (error) return <ResponsiveImage photo={photo} eager />;
  return <div className="deep-zoom"><div className="deep-zoom-placeholder"><ResponsiveImage photo={photo} eager /></div><div ref={element} className="deep-zoom-canvas" aria-label={`Deep Zoom: ${photo.altText}`} /><div className="zoom-controls"><button onClick={() => viewer.current?.viewport.zoomBy(1.5)}>+</button><button onClick={() => viewer.current?.viewport.zoomBy(0.67)}>−</button><button onClick={() => viewer.current?.viewport.goHome()}>⌂</button></div></div>;
}
