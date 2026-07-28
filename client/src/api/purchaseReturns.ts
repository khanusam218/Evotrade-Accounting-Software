import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseReturn } from '../types/purchaseReturn';
const BASE = '/api/purchase-returns';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getNextPurchaseReturnNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j<{ number: string }>);
export const getPurchaseReturns   = (p?: Record<string,string>): Promise<PurchaseReturn[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<PurchaseReturn[]>);
export const getPurchaseReturn    = (id: number): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}`).then(j<PurchaseReturn>);
export const createPurchaseReturn = (d: Partial<PurchaseReturn>): Promise<PurchaseReturn> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseReturn>);
export const updatePurchaseReturn = (id: number, d: Partial<PurchaseReturn>): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseReturn>);
export const approvePurchaseReturn = (id: number): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j<PurchaseReturn>);
export const cancelPurchaseReturn  = (id: number): Promise<PurchaseReturn> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j<PurchaseReturn>);
export const deletePurchaseReturn  = (id: number): Promise<void>            => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j<void>);


