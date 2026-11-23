import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ResponsiveImage } from '../components/ResponsiveImage';
import { DeepZoomViewer } from '../components/DeepZoomViewer';

export function PhotoPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['photo', id], queryFn: () => api.photo(id) });
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [flip, setFlip] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const edit = useMutation({ mutationFn: () => api.edit(id, { rotation, flipHorizontal: flip, ...(crop.width && crop.height ? { crop } : {}) }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['photo', id] }); } });
  const restore = useMutation({ mutationFn: () => api.restore(id), onSuccess: () => { void client.invalidateQueries({ queryKey: ['photo', id] }); } });
  const remove = useMutation({ mutationFn: () => api.delete(id), onSuccess: () => { void client.invalidateQueries({ queryKey: ['photos'] }); navigate('/'); } });
  if (query.isPending) return <div className="detail-shell"><div className="detail-skeleton" /></div>;
  if (query.isError || !query.data) return <div className="state"><h2>Không tìm thấy ảnh</h2><Link to="/">Về thư viện</Link></div>;
  const photo = query.data;
  const previewStyle = { transform: `rotate(${rotation}deg) scaleX(${flip ? -1 : 1})` };
  return <div className="detail-shell"><Link to="/" className="back-link">← Thư viện</Link><div className="detail-layout">
    <section className="detail-image"><div className="preview-stage"><div style={previewStyle} className="preview-transform">{photo.manifestUrl ? <DeepZoomViewer photo={photo} /> : <ResponsiveImage photo={photo} eager />}</div></div><p>{photo.manifestUrl ? 'Deep Zoom chỉ tải tile đang nằm trong viewport.' : 'Preview trên trình duyệt'} · Server sẽ xử lý lại từ bản gốc chuẩn hóa.</p></section>
    <aside className="editor"><span className="eyebrow">CHỈNH SỬA</span><h1>{photo.altText}</h1><p>{photo.width} × {photo.height} · phiên bản {photo.currentVersion}</p>
      <div className="toolbar"><button onClick={() => setRotation(((rotation + 270) % 360) as typeof rotation)} aria-label="Xoay trái">↶</button><button onClick={() => setRotation(((rotation + 90) % 360) as typeof rotation)} aria-label="Xoay phải">↷</button><button className={flip ? 'active' : ''} onClick={() => setFlip(!flip)}>Lật ngang</button></div>
      <fieldset><legend>Crop theo pixel ảnh gốc (tùy chọn)</legend><div className="crop-grid">{(['x', 'y', 'width', 'height'] as const).map((key) => <label key={key}>{key}<input type="number" min="0" value={crop[key]} onChange={(event) => setCrop({ ...crop, [key]: Number(event.target.value) })} /></label>)}</div></fieldset>
      <div className="editor-actions"><button className="primary-button" disabled={edit.isPending} onClick={() => edit.mutate()}>{edit.isPending ? 'Đang công bố…' : 'Apply / Publish'}</button><button disabled={restore.isPending} onClick={() => restore.mutate()}>Khôi phục bản gốc</button><button onClick={() => { setRotation(0); setFlip(false); setCrop({ x: 0, y: 0, width: 0, height: 0 }); }}>Reset preview</button></div>
      {(edit.isError || restore.isError) && <p className="error" role="alert">{edit.error?.message ?? restore.error?.message}</p>}
      <hr /><button className="danger" disabled={remove.isPending} onClick={() => window.confirm('Xóa ảnh này khỏi thư viện dùng chung?') && remove.mutate()}>{remove.isPending ? 'Đang xóa…' : 'Xóa ảnh'}</button>
    </aside>
  </div></div>;
}
