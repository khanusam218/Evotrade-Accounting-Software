import api from './axiosConfig';
import type { OtherCollection, OTFormData } from '../types/otherTransaction';

api.interceptors.response.use((r) => r, (err) => { const m = err?.response?.data?.error; if (m) err.message = m; return Promise.reject(err); });

export const getOtherCollections = async (p?: { status?: string; search?: string; date_from?: string; date_to?: string }): Promise<OtherCollection[]> =>
  (await api.get<OtherCollection[]>('/other-collections', { params: p })).data;

export const getOtherCollection = async (id: number): Promise<OtherCollection> =>
  (await api.get<OtherCollection>(`/other-collections/${id}`)).data;

export const createOtherCollection = async (data: OTFormData): Promise<OtherCollection> =>
  (await api.post<OtherCollection>('/other-collections', data)).data;

export const updateOtherCollection = async (id: number, data: OTFormData): Promise<OtherCollection> =>
  (await api.put<OtherCollection>(`/other-collections/${id}`, data)).data;

export const approveOtherCollection = async (id: number): Promise<OtherCollection> =>
  (await api.post<OtherCollection>(`/other-collections/${id}/approve`)).data;

export const cancelOtherCollection = async (id: number): Promise<OtherCollection> =>
  (await api.post<OtherCollection>(`/other-collections/${id}/cancel`)).data;

export const deleteOtherCollection = async (id: number): Promise<void> => {
  await api.delete(`/other-collections/${id}`);
};

export const getNextOCNumber = async (): Promise<string> =>
  (await api.get<{ number: string }>('/other-collections/next-number')).data.number;
