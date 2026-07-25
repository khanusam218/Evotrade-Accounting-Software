import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { SalesReturn } from '../types/salesReturn';

const BASE = '/api/sales-returns';

export async function getSalesReturns(params?: Record<string, string>): Promise<SalesReturn[]> {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  const r = await apiFetch(BASE + q);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSalesReturn(id: number): Promise<SalesReturn> {
  const r = await apiFetch(`${BASE}/${id}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function createSalesReturn(data: Partial<SalesReturn>): Promise<SalesReturn> {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function updateSalesReturn(id: number, data: Partial<SalesReturn>): Promise<SalesReturn> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function approveSalesReturn(id: number): Promise<SalesReturn> {
  const r = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function cancelSalesReturn(id: number): Promise<SalesReturn> {
  const r = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function deleteSalesReturn(id: number): Promise<void> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json()).error);
}


