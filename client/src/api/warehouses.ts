import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { Warehouse } from '../types/warehouse';
const BASE = '/api/warehouses';
const j = (r: Response) => parseJsonOrThrow(r);
export const getWarehouses   = (): Promise<Warehouse[]>  => apiFetch(BASE).then(j);
export const getWarehouse    = (id: number): Promise<Warehouse> => apiFetch(`${BASE}/${id}`).then(j);
export const createWarehouse = (d: Partial<Warehouse>): Promise<Warehouse> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updateWarehouse = (id: number, d: Partial<Warehouse>): Promise<Warehouse> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const deleteWarehouse = (id: number): Promise<void> => apiFetch(`${BASE}/${id}`, {method:'DELETE'}).then(j);


