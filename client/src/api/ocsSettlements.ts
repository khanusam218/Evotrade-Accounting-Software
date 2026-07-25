import { apiFetch } from './apiFetch';
import type { OCSSettlement } from '../types/ocsSettlement';

const BASE = '/api/other-contact-settlements';

export async function getOCSSettlements(params: Record<string, string | undefined> = {}): Promise<OCSSettlement[]> {
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>);
  const res = await apiFetch(`${BASE}?${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getOCSSettlement(id: number): Promise<OCSSettlement> {
  const res = await apiFetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createOCSSettlement(data: object): Promise<OCSSettlement> {
  const res = await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function updateOCSSettlement(id: number, data: object): Promise<OCSSettlement> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function approveOCSSettlement(id: number): Promise<OCSSettlement> {
  const res = await apiFetch(`${BASE}/${id}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function cancelOCSSettlement(id: number): Promise<OCSSettlement> {
  const res = await apiFetch(`${BASE}/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function deleteOCSSettlement(id: number): Promise<void> {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error);
}

export async function getNextOCSNumber(): Promise<string> {
  const res = await apiFetch(`${BASE}/next-number`);
  if (!res.ok) throw new Error('Failed to get next number');
  const data = await res.json();
  return data.number;
}

