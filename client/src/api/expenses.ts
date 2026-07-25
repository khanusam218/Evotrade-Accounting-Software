import api from './axiosConfig';
import type { Expense, ExpenseFormData } from '../types/expense';


api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err?.response?.data?.error;
    if (msg) err.message = msg;
    return Promise.reject(err);
  }
);

export const getExpenses = async (params?: {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Expense[]> =>
  (await api.get<Expense[]>('/expenses', { params })).data;

export const getExpense = async (id: number): Promise<Expense> =>
  (await api.get<Expense>(`/expenses/${id}`)).data;

export const createExpense = async (data: ExpenseFormData): Promise<Expense> =>
  (await api.post<Expense>('/expenses', data)).data;

export const updateExpense = async (id: number, data: ExpenseFormData): Promise<Expense> =>
  (await api.put<Expense>(`/expenses/${id}`, data)).data;

export const approveExpense = async (id: number): Promise<Expense> =>
  (await api.post<Expense>(`/expenses/${id}/approve`)).data;

export const cancelExpense = async (id: number): Promise<Expense> =>
  (await api.post<Expense>(`/expenses/${id}/cancel`)).data;

export const deleteExpense = async (id: number): Promise<void> => {
  await api.delete(`/expenses/${id}`);
};
