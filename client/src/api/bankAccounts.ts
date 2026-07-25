import api from './axiosConfig';
import type { BankAccount, BankAccountFormData } from '../types/bankAccount';


api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err?.response?.data?.error;
    if (msg) err.message = msg;
    return Promise.reject(err);
  }
);

export const getBankAccounts = async (params?: {
  search?: string;
  account_group?: string;
  is_active?: string;
}): Promise<BankAccount[]> =>
  (await api.get<BankAccount[]>('/bank-accounts', { params })).data;

export const getBankAccountsLookup = async (): Promise<BankAccount[]> =>
  (await api.get<BankAccount[]>('/bank-accounts/lookup')).data;

export const getBankAccount = async (id: number): Promise<BankAccount> =>
  (await api.get<BankAccount>(`/bank-accounts/${id}`)).data;

export const createBankAccount = async (data: BankAccountFormData): Promise<BankAccount> =>
  (await api.post<BankAccount>('/bank-accounts', data)).data;

export const updateBankAccount = async (id: number, data: BankAccountFormData): Promise<BankAccount> =>
  (await api.put<BankAccount>(`/bank-accounts/${id}`, data)).data;

export const deleteBankAccount = async (id: number): Promise<void> => {
  await api.delete(`/bank-accounts/${id}`);
};
