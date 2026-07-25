import { apiFetch } from './apiFetch';
import type { SalesInvoice } from '../types/salesInvoice';

const BASE = '/api/sales-invoices';

export async function getNextInvoiceNumber(): Promise<{ number: string }> {
  const res = await apiFetch(`${BASE}/next-number`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSalesInvoices(params: Record<string, string | undefined> = {}): Promise<SalesInvoice[]> {
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>);
  const res = await apiFetch(`${BASE}?${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSalesInvoice(id: number): Promise<SalesInvoice> {
  const res = await apiFetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSalesInvoice(data: object): Promise<SalesInvoice> {
  const res = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function updateSalesInvoice(id: number, data: object): Promise<SalesInvoice> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function approveSalesInvoice(id: number): Promise<SalesInvoice> {
  const res = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function cancelSalesInvoice(id: number): Promise<SalesInvoice> {
  const res = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function deleteSalesInvoice(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error);
}

