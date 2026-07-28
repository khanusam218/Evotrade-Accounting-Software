import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { CrmCall } from '../types/crmCall';

const BASE = '/api/crm-calls';

export async function getCrmCalls(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(BASE + q);
  return parseJsonOrThrow(r) as Promise<CrmCall[]>;
}

export async function getCrmCall(id: number) {
  const r = await apiFetch(`${BASE}/${id}`);
  return parseJsonOrThrow(r) as Promise<CrmCall>;
}

export async function createCrmCall(data: Partial<CrmCall>) {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<CrmCall>;
}

export async function updateCrmCall(id: number, data: Partial<CrmCall>) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<CrmCall>;
}

export async function deleteCrmCall(id: number) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(r);
}


