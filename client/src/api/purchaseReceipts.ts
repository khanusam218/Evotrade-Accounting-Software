import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseReceipt } from '../types/purchaseReceipt';
const BASE = '/api/purchase-receipts';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getPurchaseReceipts   = (p?: Record<string,string>): Promise<PurchaseReceipt[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<PurchaseReceipt[]>);
export const getPurchaseReceipt    = (id: number): Promise<PurchaseReceipt> => apiFetch(`${BASE}/${id}`).then(j<PurchaseReceipt>);
export const createPurchaseReceipt = (d: Partial<PurchaseReceipt>): Promise<PurchaseReceipt> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseReceipt>);
export const updatePurchaseReceipt = (id: number, d: Partial<PurchaseReceipt>): Promise<PurchaseReceipt> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseReceipt>);
export const confirmPurchaseReceipt = (id: number): Promise<PurchaseReceipt> => apiFetch(`${BASE}/${id}/confirm`, {method:'POST'}).then(j<PurchaseReceipt>);
export const cancelPurchaseReceipt  = (id: number): Promise<PurchaseReceipt> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j<PurchaseReceipt>);
export const deletePurchaseReceipt  = (id: number): Promise<void>             => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j<void>);


