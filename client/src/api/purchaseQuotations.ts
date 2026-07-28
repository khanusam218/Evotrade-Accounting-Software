import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseQuotation } from '../types/purchaseQuotation';
const BASE = '/api/purchase-quotations';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getPurchaseQuotations = (p?: Record<string,string>): Promise<PurchaseQuotation[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<PurchaseQuotation[]>);
export const getPurchaseQuotation  = (id: number): Promise<PurchaseQuotation> => apiFetch(`${BASE}/${id}`).then(j<PurchaseQuotation>);
export const createPurchaseQuotation = (d: Partial<PurchaseQuotation>): Promise<PurchaseQuotation> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseQuotation>);
export const updatePurchaseQuotation = (id: number, d: Partial<PurchaseQuotation>): Promise<PurchaseQuotation> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseQuotation>);
export const sendPurchaseQuotation    = (id: number): Promise<PurchaseQuotation> => apiFetch(`${BASE}/${id}/send`,    {method:'POST'}).then(j<PurchaseQuotation>);
export const approvePurchaseQuotation = (id: number): Promise<PurchaseQuotation> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j<PurchaseQuotation>);
export const cancelPurchaseQuotation  = (id: number): Promise<PurchaseQuotation> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j<PurchaseQuotation>);
export const deletePurchaseQuotation  = (id: number): Promise<void>              => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j<void>);


