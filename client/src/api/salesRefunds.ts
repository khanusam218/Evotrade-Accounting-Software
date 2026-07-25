import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { SalesRefund } from '../types/salesRefund';

const BASE = '/api/sales-refunds';

export async function getSalesRefunds(params?: Record<string, string>): Promise<SalesRefund[]> {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  const r = await apiFetch(BASE + q);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSalesRefund(id: number): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function createSalesRefund(data: Partial<SalesRefund>): Promise<SalesRefund> {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function updateSalesRefund(id: number, data: Partial<SalesRefund>): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function approveSalesRefund(id: number): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function cancelSalesRefund(id: number): Promise<SalesRefund> {
  const r = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function deleteSalesRefund(id: number): Promise<void> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json()).error);
}


