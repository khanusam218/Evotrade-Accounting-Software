import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { WorkOrder, WorkOrderComponent } from '../types/workOrder';
const BASE = '/api/work-orders';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
type WorkOrderPayload = Partial<WorkOrder> & { components?: { product_id: number | null; quantity: number }[] };
type WorkOrderWithComponents = WorkOrder & { components?: WorkOrderComponent[]; components_source?: 'work_order' | 'bom' };
export const getWorkOrders    = (p?: Record<string,string>): Promise<WorkOrder[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<WorkOrder[]>);
export const getWorkOrder     = (id: number): Promise<WorkOrderWithComponents> => apiFetch(`${BASE}/${id}`).then(j<WorkOrderWithComponents>);
export const createWorkOrder  = (d: WorkOrderPayload): Promise<WorkOrder> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<WorkOrder>);
export const updateWorkOrder  = (id: number, d: WorkOrderPayload): Promise<WorkOrder> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<WorkOrder>);
export const startWorkOrder   = (id: number): Promise<WorkOrder> => apiFetch(`${BASE}/${id}/start`,    {method:'POST'}).then(j<WorkOrder>);
export const completeWorkOrder = (id: number, produced_qty: number): Promise<WorkOrder> => apiFetch(`${BASE}/${id}/complete`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({produced_qty})}).then(j<WorkOrder>);
export const cancelWorkOrder  = (id: number): Promise<WorkOrder> => apiFetch(`${BASE}/${id}/cancel`,   {method:'POST'}).then(j<WorkOrder>);
export const deleteWorkOrder  = (id: number): Promise<void>      => apiFetch(`${BASE}/${id}`,           {method:'DELETE'}).then(j<void>);


