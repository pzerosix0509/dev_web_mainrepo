import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { UploadPanel } from '../components/UploadPanel';

export function GalleryPage() {
  const query = useInfiniteQuery({
    queryKey: ['photos'], queryFn: ({ pageParam }) => api.photos(pageParam), initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const photos = query.data?.pages.flatMap((page) => page.items) ?? [];
  return <div className="page-shell"><UploadPanel /><section className="gallery-section" aria-labelledby="gallery-title">
    <div className="section-heading"><div><span className="eyebrow">KHÁM PHÁ</span><h2 id="gallery-title">Ảnh mới nhất</h2></div><span>{photos.length} ảnh</span></div>
    {query.isPending && <div className="gallery-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton" key={index} />)}</div>}
    {query.isError && <div className="state"><p>Chưa thể tải thư viện.</p><button onClick={() => query.refetch()}>Thử lại</button></div>}
    {!query.isPending && !query.isError && photos.length === 0 && <div className="state"><div className="empty-icon">◇</div><h3>Thư viện đang chờ bức ảnh đầu tiên</h3><p>Hãy tải lên vài khoảnh khắc đẹp ở phía trên.</p></div>}
    <div className="gallery-grid">{photos.map((photo) => <Link to={`/photos/${photo.id}`} className="photo-card" key={photo.id}><div className="image-wrap"><ResponsiveImage photo={photo} /></div><div className="card-meta"><strong>{photo.altText}</strong><span>{photo.width} × {photo.height}</span></div></Link>)}</div>
    {query.hasNextPage && <button className="load-more" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}</button>}
  </section></div>;
}
