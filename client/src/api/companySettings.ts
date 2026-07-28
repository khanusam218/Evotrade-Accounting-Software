import { apiFetch, parseJsonOrThrow } from './apiFetch';
const BASE = '/api/company-settings';
const j = <T,>(r: Response): Promise<T> => parseJsonOrThrow(r) as Promise<T>;
export const getCompanySettings    = (): Promise<Record<string,string>> => apiFetch(BASE).then(j<Record<string,string>>);
export const updateCompanySettings = (d: Record<string,string>): Promise<Record<string,string>> => apiFetch(BASE, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<Record<string,string>>);
export const getNumberSeries       = (): Promise<{prefix:string;next_number:number;padding:number}[]> => apiFetch(`${BASE}/number-series`).then(j<{prefix:string;next_number:number;padding:number}[]>);
export const updateNumberSeries    = (prefix: string, d: {next_number:number;padding:number}): Promise<unknown> => apiFetch(`${BASE}/number-series/${encodeURIComponent(prefix)}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(j<unknown>);


