import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { CrmEvent } from '../types/crmEvent';

const BASE = '/api/crm-events';

export async function getNextEventNumber(): Promise<{ number: string }> {
  const r = await apiFetch(`${BASE}/next-number`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getCrmEvents(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(BASE + q);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<CrmEvent[]>;
}

export async function getCrmEvent(id: number) {
  const r = await apiFetch(`${BASE}/${id}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<CrmEvent>;
}

export async function createCrmEvent(data: Partial<CrmEvent>) {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<CrmEvent>;
}

export async function updateCrmEvent(id: number, data: Partial<CrmEvent>) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<CrmEvent>;
}

export async function deleteCrmEvent(id: number) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}


