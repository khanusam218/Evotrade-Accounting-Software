import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { SalesSettlement, SalesSettlementLine } from '../types/salesSettlement';

const BASE = '/api/sales-settlements';

export async function getNextSettlementNumber(): Promise<{ number: string }> {
  const r = await apiFetch(`${BASE}/next-number`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getReceivedPayments(customerId: number): Promise<{
  id: number; number: string; date: string;
  total_amount: number; adjusted_amount: number; balance_amount: number;
}[]> {
  const r = await apiFetch(`${BASE}/received-payments/${customerId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getSalesSettlements(params?: Record<string, string>): Promise<SalesSettlement[]> {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  const r = await apiFetch(BASE + q);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getSalesSettlement(id: number): Promise<SalesSettlement> {
  const r = await apiFetch(`${BASE}/${id}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getOpenInvoices(customerId: number): Promise<SalesSettlementLine[]> {
  const r = await apiFetch(`${BASE}/open-invoices/${customerId}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function createSalesSettlement(data: Partial<SalesSettlement>): Promise<SalesSettlement> {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function updateSalesSettlement(id: number, data: Partial<SalesSettlement>): Promise<SalesSettlement> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function approveSalesSettlement(id: number): Promise<SalesSettlement> {
  const r = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function cancelSalesSettlement(id: number): Promise<SalesSettlement> {
  const r = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function deleteSalesSettlement(id: number): Promise<void> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json()).error);
}


