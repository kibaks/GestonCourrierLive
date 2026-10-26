import { getAuthToken, getBaseUrl } from './laravelApiService';

export interface NumberingRule {
  id: string; name: string; scopeType: string; entityId: string | null;
  type: '*' | 'INTERNE' | 'EXTERNE'; sens: '*' | 'ENTRANT' | 'SORTANT';
  format: string; period: 'year' | 'month' | 'continuous'; width: number; start: number;
  splitType: boolean; splitSens: boolean;
}
export interface NumberingEntity { id: string; nom: string; type: string; code: string | null; parentId: string | null; actif: boolean }
export interface NumberingData {
  version: number | null;
  settings: { enabled: boolean; organisation: string; timezone: string; rules: NumberingRule[] };
  entities: NumberingEntity[];
  types?: Record<string, string>;
}
export async function numberingRequest<T>(path: string, body?: unknown, method = 'POST', signal?: AbortSignal): Promise<T> {
  const base = getBaseUrl();
  if (!base) throw new Error('API non configurée.');
  const response = await fetch(`${base}/api/numbering/${path}`, {
    method: body === undefined ? 'GET' : method, signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.errors ? Object.values(json.errors).flat().join('\n') : json.message || 'Opération impossible.');
  return json.data as T;
}
