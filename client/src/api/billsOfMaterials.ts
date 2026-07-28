import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { BillOfMaterials } from '../types/billOfMaterials';
const BASE = '/api/bills-of-materials';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getBOMs    = (p?: Record<string,string>): Promise<BillOfMaterials[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<BillOfMaterials[]>);
export const getBOM     = (id: number): Promise<BillOfMaterials> => apiFetch(`${BASE}/${id}`).then(j<BillOfMaterials>);
export const createBOM  = (d: Partial<BillOfMaterials>): Promise<BillOfMaterials> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<BillOfMaterials>);
export const updateBOM  = (id: number, d: Partial<BillOfMaterials>): Promise<BillOfMaterials> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<BillOfMaterials>);
export const deleteBOM  = (id: number): Promise<void> => apiFetch(`${BASE}/${id}`, {method:'DELETE'}).then(j<void>);


