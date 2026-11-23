import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api } from '../api';
import type { UploadResult } from '../types';

const allowed = ['image/jpeg', 'image/png', 'image/webp'];

export function UploadPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.upload(files),
    onSuccess: ({ results }) => { setResults(results); setFiles([]); void queryClient.invalidateQueries({ queryKey: ['photos'] }); },
  });

  function select(incoming: FileList | File[]) {
    const next = [...files, ...Array.from(incoming)];
    setResults([]);
    setFiles(next.slice(0, 5));
  }

  const earlyErrors = files.map((file) => !allowed.includes(file.type) ? 'Định dạng không hỗ trợ' : file.size > 10 * 1024 * 1024 ? 'Vượt 10 MiB' : null);
  return <section className="upload-card" aria-labelledby="upload-title">
    <div className="upload-copy"><span className="eyebrow">TẢI ẢNH LÊN</span><h1 id="upload-title">Chia sẻ khoảnh khắc,<br /><span>giữ trọn chất lượng.</span></h1><p>Mỗi ảnh được kiểm tra, chuẩn hóa và tối ưu cho mọi màn hình.</p></div>
    <div
      className="dropzone"
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') input.current?.click(); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); select(event.dataTransfer.files); }}
      aria-label="Chọn hoặc thả ảnh vào đây"
    >
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => event.target.files && select(event.target.files)} />
      <div className="upload-icon">↑</div><strong>Thả ảnh vào đây</strong><span>hoặc nhấn để chọn từ thiết bị</span>
      <small>1–5 ảnh · JPEG, PNG, WebP · tối đa 10 MiB/ảnh</small>
    </div>
    {files.length > 0 && <div className="file-list" aria-live="polite">
      {files.map((file, index) => <div className="file-row" key={`${file.name}-${file.lastModified}`}><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MiB {earlyErrors[index] && `· ${earlyErrors[index]}`}</small></div><button onClick={() => setFiles(files.filter((_, current) => current !== index))} aria-label={`Bỏ ${file.name}`}>×</button></div>)}
      <button className="primary-button" disabled={mutation.isPending || earlyErrors.some(Boolean)} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Đang xử lý…' : `Đăng ${files.length} ảnh`}</button>
    </div>}
    {mutation.isError && <p className="error" role="alert">{mutation.error.message}</p>}
    {results.length > 0 && <div className="results" aria-live="polite">{results.map((result) => <p key={result.index} className={result.status}>{result.status === 'accepted' ? '✓' : '!'} {result.fileName}: {result.status === 'accepted' ? 'Đã công bố' : result.message}</p>)}</div>}
  </section>;
}
