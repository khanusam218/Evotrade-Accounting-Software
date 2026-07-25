import { apiFetch } from './apiFetch';
import type { ReceivePayment } from '../types/receivePayment';

const BASE = '/api/receive-payments';

export async function getNextPaymentNumber(): Promise<{ number: string }> {
  const res = await apiFetch(`${BASE}/next-number`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getReceivePayments(params: Record<string, string | undefined> = {}): Promise<ReceivePayment[]> {
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>);
  const res = await apiFetch(`${BASE}?${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getReceivePayment(id: number): Promise<ReceivePayment> {
  const res = await apiFetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getOpenInvoices(customerId: number) {
  const res = await apiFetch(`${BASE}/open-invoices/${customerId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createReceivePayment(data: object): Promise<ReceivePayment> {
  const res = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function updateReceivePayment(id: number, data: object): Promise<ReceivePayment> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function approveReceivePayment(id: number): Promise<ReceivePayment> {
  const res = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function cancelReceivePayment(id: number): Promise<ReceivePayment> {
  const res = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function deleteReceivePayment(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error);
}

export async function createBulkReceivePayments(data: object): Promise<ReceivePayment[]> {
  const res = await apiFetch(`${BASE}/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

