import api from './axiosConfig';
import type { JournalEntry, JournalEntryFormData } from '../types/journalEntry';


api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err?.response?.data?.error;
    if (msg) err.message = msg;
    return Promise.reject(err);
  }
);

export const getJournalEntries = async (params?: {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  number?: string;
  reference?: string;
  memo?: string;
  amount_from?: string;
  amount_to?: string;
  account_id?: string;
  show_void?: string;
}): Promise<JournalEntry[]> =>
  (await api.get<JournalEntry[]>('/journal-entries', { params })).data;

export const getJournalEntry = async (id: number): Promise<JournalEntry> =>
  (await api.get<JournalEntry>(`/journal-entries/${id}`)).data;

export const createJournalEntry = async (data: JournalEntryFormData): Promise<JournalEntry> =>
  (await api.post<JournalEntry>('/journal-entries', data)).data;

export const updateJournalEntry = async (id: number, data: JournalEntryFormData): Promise<JournalEntry> =>
  (await api.put<JournalEntry>(`/journal-entries/${id}`, data)).data;

export const postJournalEntry = async (id: number): Promise<JournalEntry> =>
  (await api.post<JournalEntry>(`/journal-entries/${id}/post`)).data;

export const cancelJournalEntry = async (id: number): Promise<JournalEntry> =>
  (await api.post<JournalEntry>(`/journal-entries/${id}/cancel`)).data;

export const deleteJournalEntry = async (id: number): Promise<void> => {
  await api.delete(`/journal-entries/${id}`);
};
