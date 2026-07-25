import api from './axiosConfig';
import type { DebitNote, DNFormData } from '../types/debitNote';

api.interceptors.response.use((r) => r, (err) => { const m = err?.response?.data?.error; if (m) err.message = m; return Promise.reject(err); });

export const getDebitNotes = async (p?: { status?: string; search?: string; date_from?: string; date_to?: string }): Promise<DebitNote[]> =>
  (await api.get<DebitNote[]>('/debit-notes', { params: p })).data;

export const getDebitNote = async (id: number): Promise<DebitNote> =>
  (await api.get<DebitNote>(`/debit-notes/${id}`)).data;

export const createDebitNote = async (data: DNFormData): Promise<DebitNote> =>
  (await api.post<DebitNote>('/debit-notes', data)).data;

export const updateDebitNote = async (id: number, data: DNFormData): Promise<DebitNote> =>
  (await api.put<DebitNote>(`/debit-notes/${id}`, data)).data;

export const approveDebitNote = async (id: number): Promise<DebitNote> =>
  (await api.post<DebitNote>(`/debit-notes/${id}/approve`)).data;

export const cancelDebitNote = async (id: number): Promise<DebitNote> =>
  (await api.post<DebitNote>(`/debit-notes/${id}/cancel`)).data;

export const deleteDebitNote = async (id: number): Promise<void> => {
  await api.delete(`/debit-notes/${id}`);
};

export const getNextDNNumber = async (): Promise<string> =>
  (await api.get<{ number: string }>('/debit-notes/next-number')).data.number;
