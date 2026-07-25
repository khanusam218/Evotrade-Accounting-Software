import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { SalesDelivery } from '../types/salesDelivery';
const BASE = '/api/sales-deliveries';
const j = (r: Response) => parseJsonOrThrow(r);
export const getNextDeliveryNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j) as Promise<{ number: string }>;
export const getSalesDeliveries   = (p?: Record<string,string>): Promise<SalesDelivery[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j) as Promise<SalesDelivery[]>;
export const getSalesDelivery     = (id: number): Promise<SalesDelivery> => apiFetch(`${BASE}/${id}`).then(j) as Promise<SalesDelivery>;
export const createSalesDelivery  = (d: Partial<SalesDelivery>): Promise<SalesDelivery> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j) as Promise<SalesDelivery>;
export const updateSalesDelivery  = (id: number, d: Partial<SalesDelivery>): Promise<SalesDelivery> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j) as Promise<SalesDelivery>;
export const confirmSalesDelivery = (id: number): Promise<SalesDelivery> => apiFetch(`${BASE}/${id}/confirm`, {method:'POST'}).then(j) as Promise<SalesDelivery>;
export const cancelSalesDelivery  = (id: number): Promise<SalesDelivery> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j) as Promise<SalesDelivery>;
export const deleteSalesDelivery  = (id: number): Promise<void>           => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j) as Promise<void>;

