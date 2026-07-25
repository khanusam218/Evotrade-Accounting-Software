import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { RecurringInvoice } from '../types/recurringInvoice';

const BASE = '/api/recurring-invoices';

export async function getRecurringInvoices(params?: Record<string, string>): Promise<RecurringInvoice[]> {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  const r = await apiFetch(BASE + q);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function getRecurringInvoice(id: number): Promise<RecurringInvoice> {
  const r = await apiFetch(`${BASE}/${id}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function createRecurringInvoice(data: Partial<RecurringInvoice>): Promise<RecurringInvoice> {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function updateRecurringInvoice(id: number, data: Partial<RecurringInvoice>): Promise<RecurringInvoice> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function pauseRecurringInvoice(id: number): Promise<RecurringInvoice> {
  const r = await apiFetch(`${BASE}/${id}/pause`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function resumeRecurringInvoice(id: number): Promise<RecurringInvoice> {
  const r = await apiFetch(`${BASE}/${id}/resume`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function cancelRecurringInvoice(id: number): Promise<RecurringInvoice> {
  const r = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function executeRecurringInvoice(id: number): Promise<{ invoice: unknown }> {
  const r = await apiFetch(`${BASE}/${id}/execute`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export async function deleteRecurringInvoice(id: number): Promise<void> {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json()).error);
}


