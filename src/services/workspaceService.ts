import { Courrier } from '../types';
import { profileRequest } from './profileService';
export interface WorkspaceData { items: Courrier[]; pagination: { page: number; pages: number; total: number; perPage: number }; stats: { total: number; active: number; done: number; urgent: number; overdue: number; incoming: number; outgoing: number }; analytics: {monthly: {month:string;count:number}[];statuses:Record<string,number>} }
export function getWorkspace(params: URLSearchParams, signal?: AbortSignal) { return profileRequest<WorkspaceData>(`workspace/courriers?${params}`, undefined, 'GET', signal); }
export {courrierStatusLabels as statusLabel} from '../utils/courrierStatus';
export const formatDate = (value?: Date | string) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('fr-CD', { day:'2-digit',month:'short',year:'numeric' }) : '—';
