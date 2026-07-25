import api from './axiosConfig';
import type { CreditNote, CNFormData } from '../types/creditNote';

api.interceptors.response.use((r) => r, (err) => { const m = err?.response?.data?.error; if (m) err.message = m; return Promise.reject(err); });

export const getCreditNotes = async (p?: { status?: string; search?: string; date_from?: string; date_to?: string }): Promise<CreditNote[]> =>
  (await api.get<CreditNote[]>('/credit-notes', { params: p })).data;

export const getCreditNote = async (id: number): Promise<CreditNote> =>
  (await api.get<CreditNote>(`/credit-notes/${id}`)).data;

export const createCreditNote = async (data: CNFormData): Promise<CreditNote> =>
  (await api.post<CreditNote>('/credit-notes', data)).data;

export const updateCreditNote = async (id: number, data: CNFormData): Promise<CreditNote> =>
  (await api.put<CreditNote>(`/credit-notes/${id}`, data)).data;

export const approveCreditNote = async (id: number): Promise<CreditNote> =>
  (await api.post<CreditNote>(`/credit-notes/${id}/approve`)).data;

export const cancelCreditNote = async (id: number): Promise<CreditNote> =>
  (await api.post<CreditNote>(`/credit-notes/${id}/cancel`)).data;

export const deleteCreditNote = async (id: number): Promise<void> => {
  await api.delete(`/credit-notes/${id}`);
};

export const getNextCNNumber = async (): Promise<string> =>
  (await api.get<{ number: string }>('/credit-notes/next-number')).data.number;
