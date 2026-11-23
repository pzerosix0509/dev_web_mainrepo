import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });

const events = new EventSource(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/events`);
for (const type of ['PHOTO_CREATED', 'PHOTO_UPDATED', 'PHOTO_DELETED']) {
  events.addEventListener(type, (event) => {
    const { photoId } = JSON.parse((event as MessageEvent).data) as { photoId: string };
    void queryClient.invalidateQueries({ queryKey: ['photos'] });
    void queryClient.invalidateQueries({ queryKey: ['photo', photoId] });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
