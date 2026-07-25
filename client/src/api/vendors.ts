import api from './axiosConfig';
import type {
  Vendor,
  VendorCategory,
  VendorFilters,
  VendorFormData,
  VendorsResponse,
} from '../types/vendor';


api.interceptors.response.use(
  (r) => r,
  (err) => {
    const serverMsg = err?.response?.data?.error;
    if (serverMsg) err.message = serverMsg;
    return Promise.reject(err);
  }
);

export async function getVendors(
  filters: VendorFilters & { page?: number; limit?: number }
): Promise<VendorsResponse> {
  const { data } = await api.get<VendorsResponse>('/vendors', { params: filters });
  return data;
}

export async function getVendor(id: number): Promise<Vendor> {
  const { data } = await api.get<Vendor>(`/vendors/${id}`);
  return data;
}

export async function getNextVendorCode(): Promise<string> {
  const { data } = await api.get<{ code: string }>('/vendors/next-code');
  return data.code;
}

export async function createVendor(payload: VendorFormData): Promise<Vendor> {
  const { data } = await api.post<Vendor>('/vendors', payload);
  return data;
}

export async function updateVendor(id: number, payload: VendorFormData): Promise<Vendor> {
  const { data } = await api.put<Vendor>(`/vendors/${id}`, payload);
  return data;
}

export async function deleteVendor(id: number): Promise<void> {
  await api.delete(`/vendors/${id}`);
}

export async function getVendorCategories(): Promise<VendorCategory[]> {
  const { data } = await api.get<VendorCategory[]>('/vendor-categories');
  return data;
}

export async function createVendorCategory(name: string): Promise<VendorCategory> {
  const { data } = await api.post<VendorCategory>('/vendor-categories', { name });
  return data;
}
