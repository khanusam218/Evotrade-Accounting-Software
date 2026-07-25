import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { StockAdjustment } from '../types/stockAdjustment';
const BASE = '/api/stock-adjustments';
const j = (r: Response) => parseJsonOrThrow(r) as Promise<unknown>;
export const getStockAdjustments    = (p?: Record<string,string>) => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j) as Promise<StockAdjustment[]>;
export const getStockAdjustment     = (id: number) => apiFetch(`${BASE}/${id}`).then(j) as Promise<StockAdjustment>;
export const createStockAdjustment  = (d: Partial<StockAdjustment>) => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j) as Promise<StockAdjustment>;
export const updateStockAdjustment  = (id: number, d: Partial<StockAdjustment>) => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j) as Promise<StockAdjustment>;
export const confirmStockAdjustment = (id: number) => apiFetch(`${BASE}/${id}/confirm`, {method:'POST'}).then(j) as Promise<StockAdjustment>;
export const cancelStockAdjustment  = (id: number) => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j) as Promise<StockAdjustment>;
export const deleteStockAdjustment  = (id: number) => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j) as Promise<void>;


