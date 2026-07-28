import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { MakePayment } from '../types/makePayment';
const BASE = '/api/make-payments';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getNextMakePaymentNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j<{ number: string }>);
export const getMakePayments   = (p?: Record<string,string>): Promise<MakePayment[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<MakePayment[]>);
export const getMakePayment    = (id: number): Promise<MakePayment> => apiFetch(`${BASE}/${id}`).then(j<MakePayment>);
export const createMakePayment = (d: Partial<MakePayment>): Promise<MakePayment> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<MakePayment>);
export const updateMakePayment = (id: number, d: Partial<MakePayment>): Promise<MakePayment> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<MakePayment>);
export const approveMakePayment = (id: number): Promise<MakePayment> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j<MakePayment>);
export const cancelMakePayment  = (id: number): Promise<MakePayment> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j<MakePayment>);
export const deleteMakePayment  = (id: number): Promise<void>         => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j<void>);


