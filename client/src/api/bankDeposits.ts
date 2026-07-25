import api from './axiosConfig';
import type { BankDeposit, BDFormData } from '../types/bankDeposit';

api.interceptors.response.use((r) => r, (err) => { const m = err?.response?.data?.error; if (m) err.message = m; return Promise.reject(err); });

export const getBankDeposits = async (p?: { status?: string; search?: string; date_from?: string; date_to?: string }): Promise<BankDeposit[]> =>
  (await api.get<BankDeposit[]>('/bank-deposits', { params: p })).data;

export const getBankDeposit = async (id: number): Promise<BankDeposit> =>
  (await api.get<BankDeposit>(`/bank-deposits/${id}`)).data;

export const createBankDeposit = async (data: BDFormData): Promise<BankDeposit> =>
  (await api.post<BankDeposit>('/bank-deposits', data)).data;

export const updateBankDeposit = async (id: number, data: BDFormData): Promise<BankDeposit> =>
  (await api.put<BankDeposit>(`/bank-deposits/${id}`, data)).data;

export const depositBankDeposit = async (id: number): Promise<BankDeposit> =>
  (await api.post<BankDeposit>(`/bank-deposits/${id}/deposit`)).data;

export const clearBankDeposit = async (id: number): Promise<BankDeposit> =>
  (await api.post<BankDeposit>(`/bank-deposits/${id}/clear`)).data;

export const cancelBankDeposit = async (id: number): Promise<BankDeposit> =>
  (await api.post<BankDeposit>(`/bank-deposits/${id}/cancel`)).data;

export const deleteBankDeposit = async (id: number): Promise<void> => {
  await api.delete(`/bank-deposits/${id}`);
};

export const getNextBDNumber = async (): Promise<string> =>
  (await api.get<{ number: string }>('/bank-deposits/next-number')).data.number;
