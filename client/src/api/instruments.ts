import api from './axiosConfig';
import type { PaymentInstrument, InstrumentStatus } from '../types/otherTransaction';

api.interceptors.response.use((r) => r, (err) => { const m = err?.response?.data?.error; if (m) err.message = m; return Promise.reject(err); });

export const getInstruments = async (p?: {
  payment_mode?: string; status?: string; search?: string;
  date_from?: string; date_to?: string;
}): Promise<PaymentInstrument[]> =>
  (await api.get<PaymentInstrument[]>('/instruments', { params: p })).data;

export const updateInstrumentStatus = async (id: number, status: InstrumentStatus): Promise<PaymentInstrument> =>
  (await api.put<PaymentInstrument>(`/instruments/${id}/status`, { status })).data;
