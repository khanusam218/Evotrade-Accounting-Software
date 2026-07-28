import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { Warehouse } from '../types/warehouse';
const BASE = '/api/warehouses';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getWarehouses   = (): Promise<Warehouse[]>  => apiFetch(BASE).then(j<Warehouse[]>);
export const getWarehouse    = (id: number): Promise<Warehouse> => apiFetch(`${BASE}/${id}`).then(j<Warehouse>);
export const createWarehouse = (d: Partial<Warehouse>): Promise<Warehouse> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<Warehouse>);
export const updateWarehouse = (id: number, d: Partial<Warehouse>): Promise<Warehouse> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<Warehouse>);
export const deleteWarehouse = (id: number): Promise<void> => apiFetch(`${BASE}/${id}`, {method:'DELETE'}).then(j<void>);


