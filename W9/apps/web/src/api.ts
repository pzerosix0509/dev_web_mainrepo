import type { Photo, UploadResult } from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
export const mediaUrl = (path: string) => `${API_URL}${path}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  photos: (cursor?: string) => request<{ items: Photo[]; nextCursor: string | null }>(`/api/photos?limit=24${cursor ? `&cursor=${cursor}` : ''}`),
  photo: (id: string) => request<Photo>(`/api/photos/${id}`),
  upload: (files: File[]) => {
    const data = new FormData();
    files.forEach((file) => data.append('photos', file));
    return request<{ results: UploadResult[] }>('/api/photos/upload', { method: 'POST', body: data });
  },
  delete: (id: string) => request<void>(`/api/photos/${id}`, { method: 'DELETE' }),
  edit: (id: string, body: unknown) => request(`/api/photos/${id}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  restore: (id: string) => request(`/api/photos/${id}/restore`, { method: 'POST' }),
};
