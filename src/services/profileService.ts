import { getAuthToken, getBaseUrl } from './laravelApiService';
import { Utilisateur } from '../types';
export type Channels = { app: boolean; email: boolean; sms: boolean; whatsapp: boolean };
export interface Profile extends Utilisateur {
  coverUrl?: string;
  firstName?: string; lastName?: string; jobTitle?: string; professionalPhone?: string; personalPhone?: string;
  bio?: string; address?: string; city?: string; country?: string; smsPhone?: string; smsVerified: boolean;
  emailVerified: boolean; twoFactorEnabled: boolean; notificationPreferences: Record<string, Channels>;
}
export interface Communications {
  mail: { enabled: boolean; host: string; port: number; encryption: string; username: string; password: string; fromAddress: string; fromName: string; hasSecret?: boolean };
  sms: { mode: 'test' | 'live'; enabled: boolean; sid: string; token: string; from: string; hasSecret?: boolean };
  whatsapp: { enabled: boolean; from: string; contentSid: string };
}
export async function profileRequest<T>(path: string, body?: unknown, method = 'POST', signal?: AbortSignal): Promise<T> {
  const base = getBaseUrl();
  if (!base) throw new Error('API non configurée.');
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}/api/${path}`, {
    method: body === undefined ? 'GET' : method, signal,
    headers: { Accept: 'application/json', ...(!multipart ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${getAuthToken() || ''}` },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.errors ? Object.values(json.errors).flat().join('\n') : json.message || 'Opération impossible.');
  return (json.data ?? json) as T;
}
