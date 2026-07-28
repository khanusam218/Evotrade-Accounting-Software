import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { CrmTicket } from '../types/crmTicket';

const BASE = '/api/crm-tickets';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;

export const getNextTicketNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j<{ number: string }>);
export const getCrmTickets  = (p?: Record<string, string>): Promise<CrmTicket[]> => apiFetch(BASE + (p ? '?' + new URLSearchParams(p) : '')).then(j<CrmTicket[]>);
export const getCrmTicket   = (id: number): Promise<CrmTicket> => apiFetch(`${BASE}/${id}`).then(j<CrmTicket>);
export const createCrmTicket = (d: Partial<CrmTicket>): Promise<CrmTicket> => apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j<CrmTicket>);
export const updateCrmTicket = (id: number, d: Partial<CrmTicket>): Promise<CrmTicket> => apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j<CrmTicket>);
export const deleteCrmTicket = (id: number): Promise<void> => apiFetch(`${BASE}/${id}`, { method: 'DELETE' }).then(j<void>);


