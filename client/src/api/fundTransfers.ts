import api from './axiosConfig';
import type { FundTransfer, FundTransferFormData } from '../types/fundTransfer';


api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err?.response?.data?.error;
    if (msg) err.message = msg;
    return Promise.reject(err);
  }
);

export const getFundTransfers = async (params?: {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}): Promise<FundTransfer[]> =>
  (await api.get<FundTransfer[]>('/fund-transfers', { params })).data;

export const getFundTransfer = async (id: number): Promise<FundTransfer> =>
  (await api.get<FundTransfer>(`/fund-transfers/${id}`)).data;

export const createFundTransfer = async (data: FundTransferFormData): Promise<FundTransfer> =>
  (await api.post<FundTransfer>('/fund-transfers', data)).data;

export const updateFundTransfer = async (id: number, data: FundTransferFormData): Promise<FundTransfer> =>
  (await api.put<FundTransfer>(`/fund-transfers/${id}`, data)).data;

export const postFundTransfer = async (id: number): Promise<FundTransfer> =>
  (await api.post<FundTransfer>(`/fund-transfers/${id}/post`)).data;

export const cancelFundTransfer = async (id: number): Promise<FundTransfer> =>
  (await api.post<FundTransfer>(`/fund-transfers/${id}/cancel`)).data;

export const deleteFundTransfer = async (id: number): Promise<void> => {
  await api.delete(`/fund-transfers/${id}`);
};

export const getNextFTNumber = async (): Promise<string> =>
  (await api.get<{ number: string }>('/fund-transfers/next-number')).data.number;
