import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { CrmEvent } from '../types/crmEvent';

const BASE = '/api/crm-events';

export async function getNextEventNumber(): Promise<{ number: string }> {
  const r = await apiFetch(`${BASE}/next-number`);
  return parseJsonOrThrow(r) as Promise<{ number: string }>;
}

export async function getCrmEvents(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(BASE + q);
  return parseJsonOrThrow(r) as Promise<CrmEvent[]>;
}

export async function getCrmEvent(id: number) {
  const r = await apiFetch(`${BASE}/${id}`);
  return parseJsonOrThrow(r) as Promise<CrmEvent>;
}

export async function createCrmEvent(data: Partial<CrmEvent>) {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<CrmEvent>;
}

export async function updateCrmEvent(id: number, data: Partial<CrmEvent>) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<CrmEvent>;
}

export async function deleteCrmEvent(id: number) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(r) as Promise<{ number: string }>;
}


