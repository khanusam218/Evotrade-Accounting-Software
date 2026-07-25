import api from './axiosConfig';
import type { OtherPayment, OTFormData } from '../types/otherTransaction';

api.interceptors.response.use((r) => r, (err) => { const m = err?.response?.data?.error; if (m) err.message = m; return Promise.reject(err); });

export const getOtherPayments = async (p?: { status?: string; search?: string; date_from?: string; date_to?: string }): Promise<OtherPayment[]> =>
  (await api.get<OtherPayment[]>('/other-payments', { params: p })).data;

export const getOtherPayment = async (id: number): Promise<OtherPayment> =>
  (await api.get<OtherPayment>(`/other-payments/${id}`)).data;

export const createOtherPayment = async (data: OTFormData): Promise<OtherPayment> =>
  (await api.post<OtherPayment>('/other-payments', data)).data;

export const updateOtherPayment = async (id: number, data: OTFormData): Promise<OtherPayment> =>
  (await api.put<OtherPayment>(`/other-payments/${id}`, data)).data;

export const approveOtherPayment = async (id: number): Promise<OtherPayment> =>
  (await api.post<OtherPayment>(`/other-payments/${id}/approve`)).data;

export const cancelOtherPayment = async (id: number): Promise<OtherPayment> =>
  (await api.post<OtherPayment>(`/other-payments/${id}/cancel`)).data;

export const deleteOtherPayment = async (id: number): Promise<void> => {
  await api.delete(`/other-payments/${id}`);
};

export const getNextOPNumber = async (): Promise<string> =>
  (await api.get<{ number: string }>('/other-payments/next-number')).data.number;
