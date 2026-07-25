import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { StockMovement } from '../types/stockMovement';

const BASE = '/api/stock-movements';

export async function getStockMovements(params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const r = await apiFetch(BASE + q);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<StockMovement[]>;
}

export async function getStockMovement(id: number) {
  const r = await apiFetch(`${BASE}/${id}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<StockMovement>;
}

export async function createStockMovement(data: Partial<StockMovement>) {
  const r = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<StockMovement>;
}

export async function updateStockMovement(id: number, data: Partial<StockMovement>) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<StockMovement>;
}

export async function completeStockMovement(id: number) {
  const r = await apiFetch(`${BASE}/${id}/complete`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<StockMovement>;
}

export async function cancelStockMovement(id: number) {
  const r = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<StockMovement>;
}

export async function deleteStockMovement(id: number) {
  const r = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}


