import { apiFetch, parseJsonOrThrow } from './apiFetch';
import type { CrmLead, CrmActivity } from '../types/crmLead';
const BASE = '/api/crm-leads';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getNextLeadNumber = (): Promise<{ number: string }> => apiFetch(`${BASE}/next-number`).then(j<{ number: string }>);
export const getCrmLeads      = (p?: Record<string,string>): Promise<CrmLead[]> => apiFetch(BASE + (p ? '?'+new URLSearchParams(p) : '')).then(j<CrmLead[]>);
export const getCrmLead       = (id: number): Promise<CrmLead> => apiFetch(`${BASE}/${id}`).then(j<CrmLead>);
export const createCrmLead    = (d: Partial<CrmLead>): Promise<CrmLead> => apiFetch(BASE, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<CrmLead>);
export const updateCrmLead    = (id: number, d: Partial<CrmLead>): Promise<CrmLead> => apiFetch(`${BASE}/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<CrmLead>);
export const deleteCrmLead    = (id: number): Promise<void> => apiFetch(`${BASE}/${id}`, {method:'DELETE'}).then(j<void>);
export const addActivity      = (leadId: number, d: Partial<CrmActivity>): Promise<CrmActivity> => apiFetch(`${BASE}/${leadId}/activities`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<CrmActivity>);
export const deleteActivity   = (leadId: number, actId: number): Promise<void> => apiFetch(`${BASE}/${leadId}/activities/${actId}`, {method:'DELETE'}).then(j<void>);
export const convertCrmLead   = (id: number): Promise<{ lead: CrmLead; customer: { id: number; print_name: string } }> => apiFetch(`${BASE}/${id}/convert`, {method:'POST'}).then(j<{ lead: CrmLead; customer: { id: number; print_name: string } }>);


