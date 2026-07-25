import { apiFetch } from './apiFetch';
import type { SalesQuotation } from '../types/salesQuotation';

const BASE = '/api/sales-quotations';

export async function getNextQuotationNumber(): Promise<{ number: string }> {
  const res = await apiFetch(`${BASE}/next-number`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSalesQuotations(params: Record<string, string | undefined> = {}): Promise<SalesQuotation[]> {
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>);
  const res = await apiFetch(`${BASE}?${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSalesQuotation(id: number): Promise<SalesQuotation> {
  const res = await apiFetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSalesQuotation(data: object): Promise<SalesQuotation> {
  const res = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function updateSalesQuotation(id: number, data: object): Promise<SalesQuotation> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function sendSalesQuotation(id: number): Promise<SalesQuotation> {
  const res = await apiFetch(`${BASE}/${id}/send`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function approveSalesQuotation(id: number): Promise<SalesQuotation> {
  const res = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function cancelSalesQuotation(id: number): Promise<SalesQuotation> {
  const res = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function deleteSalesQuotation(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error);
}

