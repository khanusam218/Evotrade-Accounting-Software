import { apiFetch } from './apiFetch';
import type { SalesOrder } from '../types/salesOrder';

const BASE = '/api/sales-orders';

export async function getNextOrderNumber(): Promise<{ number: string }> {
  const res = await apiFetch(`${BASE}/next-number`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSalesOrders(params: Record<string, string | undefined> = {}): Promise<SalesOrder[]> {
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>);
  const res = await apiFetch(`${BASE}?${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSalesOrder(id: number): Promise<SalesOrder> {
  const res = await apiFetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSalesOrder(data: object): Promise<SalesOrder> {
  const res = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function updateSalesOrder(id: number, data: object): Promise<SalesOrder> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function shipSalesOrder(id: number): Promise<SalesOrder> {
  const res = await apiFetch(`${BASE}/${id}/ship`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function confirmSalesOrder(id: number): Promise<SalesOrder> {
  const res = await apiFetch(`${BASE}/${id}/confirm`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function deliverSalesOrder(id: number): Promise<SalesOrder> {
  const res = await apiFetch(`${BASE}/${id}/deliver`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function cancelSalesOrder(id: number): Promise<SalesOrder> {
  const res = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function deleteSalesOrder(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error);
}

