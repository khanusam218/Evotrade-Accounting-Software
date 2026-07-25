import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseSettlement } from '../types/purchaseSettlement';
const BASE = '/api/purchase-settlements';
const j = (r: Response) => parseJsonOrThrow(r);
export const getNextPurchaseSettlementNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getPurchaseSettlements   = (p?: Record<string,string>): Promise<PurchaseSettlement[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getPurchaseSettlement    = (id: number): Promise<PurchaseSettlement> => apiFetch(`${BASE}/${id}`).then(j);
export const getOpenPurchaseInvoices  = (vendorId: number): Promise<unknown[]> => apiFetch(`${BASE}/open-invoices/${vendorId}`).then(j);
export const getOpenPurchaseCredits   = (vendorId: number): Promise<unknown[]> => apiFetch(`${BASE}/open-credits/${vendorId}`).then(j);
export const createPurchaseSettlement = (d: Partial<PurchaseSettlement>): Promise<PurchaseSettlement> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updatePurchaseSettlement = (id: number, d: Partial<PurchaseSettlement>): Promise<PurchaseSettlement> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const approvePurchaseSettlement = (id: number): Promise<PurchaseSettlement> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j);
export const cancelPurchaseSettlement  = (id: number): Promise<PurchaseSettlement> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j);
export const deletePurchaseSettlement  = (id: number): Promise<void>                => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j);


