import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseReturn } from '../types/purchaseReturn';
const BASE = '/api/purchase-returns';
const j = (r: Response) => parseJsonOrThrow(r);
export const getNextPurchaseReturnNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getPurchaseReturns   = (p?: Record<string,string>): Promise<PurchaseReturn[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getPurchaseReturn    = (id: number): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}`).then(j);
export const createPurchaseReturn = (d: Partial<PurchaseReturn>): Promise<PurchaseReturn> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updatePurchaseReturn = (id: number, d: Partial<PurchaseReturn>): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const approvePurchaseReturn = (id: number): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j);
export const cancelPurchaseReturn  = (id: number): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j);
export const deletePurchaseReturn  = (id: number): Promise<void>            => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j);


