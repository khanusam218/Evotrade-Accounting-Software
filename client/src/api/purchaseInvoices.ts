import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseInvoice } from '../types/purchaseInvoice';
const BASE = '/api/purchase-invoices';
const j = (r: Response) => parseJsonOrThrow(r);
export const getNextPurchaseInvoiceNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getPurchaseInvoices   = (p?: Record<string,string>): Promise<PurchaseInvoice[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getPurchaseInvoice    = (id: number): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}`).then(j);
export const createPurchaseInvoice = (d: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updatePurchaseInvoice = (id: number, d: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const approvePurchaseInvoice = (id: number): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j);
export const cancelPurchaseInvoice  = (id: number): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j);
export const deletePurchaseInvoice  = (id: number): Promise<void>             => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j);


