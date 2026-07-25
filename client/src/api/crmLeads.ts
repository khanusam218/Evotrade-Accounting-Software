import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { CrmLead, CrmActivity } from '../types/crmLead';
const BASE = '/api/crm-leads';
const j = (r: Response) => parseJsonOrThrow(r);
export const getNextLeadNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j);
export const getCrmLeads      = (p?: Record<string,string>): Promise<CrmLead[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j);
export const getCrmLead       = (id: number): Promise<CrmLead> => apiFetch(`${BASE}/${id}`).then(j);
export const createCrmLead    = (d: Partial<CrmLead>): Promise<CrmLead> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const updateCrmLead    = (id: number, d: Partial<CrmLead>): Promise<CrmLead> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const deleteCrmLead    = (id: number): Promise<void> => apiFetch(`${BASE}/${id}`, {method:'DELETE'}).then(j);
export const addActivity      = (leadId: number, d: Partial<CrmActivity>): Promise<CrmActivity> => apiFetch(`${BASE}/${leadId}/activities`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j);
export const deleteActivity   = (leadId: number, actId: number): Promise<void> => apiFetch(`${BASE}/${leadId}/activities/${actId}`, {method:'DELETE'}).then(j);


