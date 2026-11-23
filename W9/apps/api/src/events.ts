import type { FastifyReply } from 'fastify';

export type PhotoEvent = { type: 'PHOTO_CREATED' | 'PHOTO_UPDATED' | 'PHOTO_DELETED'; photoId: string };
const clients = new Set<FastifyReply>();

export function addEventClient(reply: FastifyReply): () => void {
  clients.add(reply);
  return () => clients.delete(reply);
}

export function broadcast(event: PhotoEvent): void {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.raw.write(payload);
}
