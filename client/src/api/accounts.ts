import api from './axiosConfig';
import type { Account, AccountFormData } from '../types/account';


api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err?.response?.data?.error;
    if (msg) err.message = msg;
    return Promise.reject(err);
  }
);

export const getAccounts = async (params?: {
  account_type?: string;
  account_group?: string;
  is_active?: string;
  search?: string;
}): Promise<Account[]> =>
  (await api.get<Account[]>('/chart-of-accounts', { params })).data;

export const getAccountsLookup = async (): Promise<Account[]> =>
  (await api.get<Account[]>('/chart-of-accounts/lookup')).data;

export const getAccount = async (id: number): Promise<Account> =>
  (await api.get<Account>(`/chart-of-accounts/${id}`)).data;

export const createAccount = async (data: AccountFormData): Promise<Account> =>
  (await api.post<Account>('/chart-of-accounts', data)).data;

export const updateAccount = async (id: number, data: AccountFormData): Promise<Account> =>
  (await api.put<Account>(`/chart-of-accounts/${id}`, data)).data;

export const deleteAccount = async (id: number): Promise<void> => {
  await api.delete(`/chart-of-accounts/${id}`);
};
