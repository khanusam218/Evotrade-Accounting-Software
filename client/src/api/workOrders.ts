import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { WorkOrder } from '../types/workOrder';
const BASE = '/api/work-orders';
const j = (r: Response) => parseJsonOrThrow(r);
export const getWorkOrders    = (p?: Record<string,string>): Promise<WorkOrder[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getWorkOrder     = (id: number): Promise<WorkOrder> => apiFetch(`${BASE}/${id}`).then(j);
export const createWorkOrder  = (d: Partial<WorkOrder>): Promise<WorkOrder> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updateWorkOrder  = (id: number, d: Partial<WorkOrder>): Promise<WorkOrder> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const startWorkOrder   = (id: number): Promise<WorkOrder> => apiFetch(`${BASE}/${id}/start`,    {method:'POST'}).then(j);
export const completeWorkOrder = (id: number, produced_qty: number): Promise<WorkOrder> => apiFetch(`${BASE}/${id}/complete`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({produced_qty})}).then(j);
export const cancelWorkOrder  = (id: number): Promise<WorkOrder> => apiFetch(`${BASE}/${id}/cancel`,   {method:'POST'}).then(j);
export const deleteWorkOrder  = (id: number): Promise<void>      => apiFetch(`${BASE}/${id}`,           {method:'DELETE'}).then(j);


