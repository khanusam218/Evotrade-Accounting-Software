import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { SalesRefund } from '../types/salesRefund';

const BASE = '/api/sales-refunds';

export async function getSalesRefunds(params?: Record<string, string>): Promise<SalesRefund[]> {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  const r = await apiFetch(BASE + q);
  return parseJsonOrThrow(r) as Promise<SalesRefund[]>;
}

export async function getSalesRefund(id: number): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}`);
  return parseJsonOrThrow(r) as Promise<SalesRefund>;
}

export async function createSalesRefund(data: Partial<SalesRefund>): Promise<SalesRefund> {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<SalesRefund>;
}

export async function updateSalesRefund(id: number, data: Partial<SalesRefund>): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<SalesRefund>;
}

export async function approveSalesRefund(id: number): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  return parseJsonOrThrow(r) as Promise<SalesRefund>;
}

export async function cancelSalesRefund(id: number): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  return parseJsonOrThrow(r) as Promise<SalesRefund>;
}

export async function deleteSalesRefund(id: number): Promise<void> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) await parseJsonOrThrow(r);
}


