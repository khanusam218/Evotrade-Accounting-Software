import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseInvoice } from '../types/purchaseInvoice';
const BASE = '/api/purchase-invoices';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getNextPurchaseInvoiceNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j<{ number: string }>);
export const getPurchaseInvoices   = (p?: Record<string,string>): Promise<PurchaseInvoice[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<PurchaseInvoice[]>);
export const getPurchaseInvoice    = (id: number): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}`).then(j<PurchaseInvoice>);
export const createPurchaseInvoice = (d: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseInvoice>);
export const updatePurchaseInvoice = (id: number, d: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<PurchaseInvoice>);
export const approvePurchaseInvoice = (id: number): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j<PurchaseInvoice>);
export const cancelPurchaseInvoice  = (id: number): Promise<PurchaseInvoice> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j<PurchaseInvoice>);
export const deletePurchaseInvoice  = (id: number): Promise<void>             => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j<void>);


