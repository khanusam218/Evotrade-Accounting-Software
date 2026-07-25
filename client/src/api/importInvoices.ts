import { apiFetch, parseJsonOrThrow } from './apiFetch';
import { ImportInvoice } from '../types/importInvoice';

const BASE = '/api/import-invoices';
const j = (r: Response) => parseJsonOrThrow(r);

export const getNextImportInvoiceNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getImportInvoices  = (p?: Record<string,string>): Promise<ImportInvoice[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getImportInvoice   = (id: number): Promise<ImportInvoice> => apiFetch(`${BASE}/${id}`).then(j);
export const createImportInvoice = (d: Partial<ImportInvoice>): Promise<ImportInvoice> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updateImportInvoice = (id: number, d: Partial<ImportInvoice>): Promise<ImportInvoice> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const approveImportInvoice = (id: number): Promise<ImportInvoice> => apiFetch(`${BASE}/${id}/approve`, {method:'POST'}).then(j);
export const cancelImportInvoice  = (id: number): Promise<ImportInvoice> => apiFetch(`${BASE}/${id}/cancel`,  {method:'POST'}).then(j);
export const deleteImportInvoice  = (id: number): Promise<void>           => apiFetch(`${BASE}/${id}`,         {method:'DELETE'}).then(j);


