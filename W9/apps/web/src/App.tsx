import { Link, Route, Routes } from 'react-router-dom';
import { GalleryPage } from './pages/GalleryPage';
import { PhotoPage } from './pages/PhotoPage';

export function App() {
  return <>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Về thư viện ảnh"><span className="brand-mark">L</span><span>Lumen</span></Link>
      <span className="shared-label"><span className="pulse" /> Thư viện dùng chung</span>
    </header>
    <main><Routes><Route path="/" element={<GalleryPage />} /><Route path="/photos/:id" element={<PhotoPage />} /></Routes></main>
    <footer className="footer">Ảnh được chuẩn hóa và xóa metadata nhạy cảm trước khi công bố.</footer>
  </>;
}
