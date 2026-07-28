import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { DisassemblyOrder } from '../types/disassemblyOrder';

const BASE = '/api/disassembly-orders';

export async function getDisassemblyOrders(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(BASE + q);
  return parseJsonOrThrow(r) as Promise<DisassemblyOrder[]>;
}

export async function getDisassemblyOrder(id: number) {
  const r = await apiFetch(`${BASE}/${id}`);
  return parseJsonOrThrow(r) as Promise<DisassemblyOrder>;
}

export async function createDisassemblyOrder(data: Partial<DisassemblyOrder>) {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<DisassemblyOrder>;
}

export async function updateDisassemblyOrder(id: number, data: Partial<DisassemblyOrder>) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return parseJsonOrThrow(r) as Promise<DisassemblyOrder>;
}

export async function completeDisassemblyOrder(id: number) {
  const r = await apiFetch(`${BASE}/${id}/complete`, { method: 'POST' });
  return parseJsonOrThrow(r) as Promise<DisassemblyOrder>;
}

export async function cancelDisassemblyOrder(id: number) {
  const r = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  return parseJsonOrThrow(r) as Promise<DisassemblyOrder>;
}

export async function deleteDisassemblyOrder(id: number) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  return parseJsonOrThrow(r);
}


