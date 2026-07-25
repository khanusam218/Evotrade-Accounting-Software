import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { CrmTicket } from '../types/crmTicket';

const BASE = '/api/crm-tickets';
const j = (r: Response) => parseJsonOrThrow(r);

export const getNextTicketNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getCrmTickets  = (p?: Record<string, string>): Promise<CrmTicket[]> => apiFetch(BASE + (p ? '?' + new URLSearchParams(p) : '')).then(j);
export const getCrmTicket   = (id: number): Promise<CrmTicket> => apiFetch(`${BASE}/${id}`).then(j);
export const createCrmTicket = (d: Partial<CrmTicket>): Promise<CrmTicket> => apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j);
export const updateCrmTicket = (id: number, d: Partial<CrmTicket>): Promise<CrmTicket> => apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j);
export const deleteCrmTicket = (id: number): Promise<void> => apiFetch(`${BASE}/${id}`, { method: 'DELETE' }).then(j);


