import { laravelApiService } from './laravelApiService';
export const COURRIER_READ_EVENT = 'courrier-personal-read';
const pending = new Map<string, Promise<void>>();
export function markCourrierRead(id: string, userId: string): Promise<void> {
  const key = `${userId}:${id}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = laravelApiService.request({ method: 'POST', url: `/courriers/${encodeURIComponent(id)}/read` }).then(response => {
    const receipt = response.data ?? response;
    window.dispatchEvent(new CustomEvent(COURRIER_READ_EVENT, { detail: { ...receipt, userId } }));
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
