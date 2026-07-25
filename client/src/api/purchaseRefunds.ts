import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseRefund } from '../types/purchaseRefund';
const BASE = '/api/purchase-refunds';
const j = (r: Response) => parseJsonOrThrow(r);
export const getNextPurchaseRefundNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getPurchaseRefunds   = (p?: Record<string,string>): Promise<PurchaseRefund[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getPurchaseRefund    = (id: number): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}`).then(j);
export const createPurchaseRefund = (d: Partial<PurchaseRefund>): Promise<PurchaseRefund> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updatePurchaseRefund = (id: number, d: Partial<PurchaseRefund>): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const approvePurchaseRefund = (id: number): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j);
export const cancelPurchaseRefund  = (id: number): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j);
export const deletePurchaseRefund  = (id: number): Promise<void>            => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j);


