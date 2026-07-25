import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { PurchaseOrder } from '../types/purchaseOrder';
const BASE = '/api/purchase-orders';
const j = (r: Response) => parseJsonOrThrow(r);
export const getNextPurchaseOrderNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getPurchaseOrders   = (p?: Record<string,string>): Promise<PurchaseOrder[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getPurchaseOrder    = (id: number): Promise<PurchaseOrder> => apiFetch(`${BASE}/${id}`).then(j);
export const createPurchaseOrder = (d: Partial<PurchaseOrder>): Promise<PurchaseOrder> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updatePurchaseOrder = (id: number, d: Partial<PurchaseOrder>): Promise<PurchaseOrder> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const confirmPurchaseOrder = (id: number): Promise<PurchaseOrder> => apiFetch(`${BASE}/${id}/confirm`, {method:'POST'}).then(j);
export const receivePurchaseOrder = (id: number): Promise<PurchaseOrder> => apiFetch(`${BASE}/${id}/receive`, {method:'POST'}).then(j);
export const cancelPurchaseOrder  = (id: number): Promise<PurchaseOrder> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j);
export const deletePurchaseOrder  = (id: number): Promise<void>           => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j);


