import { apiFetch, parseJsonOrThrow } from './apiFetch';
const BASE = '/api/adjustment-types';
const j = (r: Response) => parseJsonOrThrow(r) as Promise<unknown>;

export interface AdjustmentType {
  id: number;
  name: string;
  direction: 'add' | 'subtract';
  account_id: number | null;
  account_name?: string;
  description: string | null;
  is_active: boolean;
}

export const getAdjustmentTypes   = () => apiFetch(BASE).then(j) as Promise<AdjustmentType[]>;
export const createAdjustmentType = (d: Partial<AdjustmentType>) =>
  apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j) as Promise<AdjustmentType>;
export const updateAdjustmentType = (id: number, d: Partial<AdjustmentType>) =>
  apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j) as Promise<AdjustmentType>;
export const deleteAdjustmentType = (id: number) =>
  apiFetch(`${BASE}/${id}`, { method: 'DELETE' }).then(j) as Promise<void>;


