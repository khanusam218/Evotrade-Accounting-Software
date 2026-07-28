import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseRefund } from '../types/purchaseRefund';
const BASE = '/api/purchase-refunds';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getNextPurchaseRefundNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j<{ number: string }>);
export const getPurchaseRefunds   = (p?: Record<string,string>): Promise<PurchaseRefund[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<PurchaseRefund[]>);
export const getPurchaseRefund    = (id: number): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}`).then(j<PurchaseRefund>);
export const createPurchaseRefund = (d: Partial<PurchaseRefund>): Promise<PurchaseRefund> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseRefund>);
export const updatePurchaseRefund = (id: number, d: Partial<PurchaseRefund>): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseRefund>);
export const approvePurchaseRefund = (id: number): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j<PurchaseRefund>);
export const cancelPurchaseRefund  = (id: number): Promise<PurchaseRefund> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j<PurchaseRefund>);
export const deletePurchaseRefund  = (id: number): Promise<void>            => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j<void>);


