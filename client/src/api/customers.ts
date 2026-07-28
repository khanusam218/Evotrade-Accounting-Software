import api from './axiosConfig';
import type {
  Customer,
  CustomerCategory,
  CustomerFilters,
  CustomerFormData,
  CustomersResponse,
} from '../types/customer';


// Unwrap server-side error messages from API responses
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const serverMsg = err?.response?.data?.error;
    if (serverMsg) err.message = serverMsg;
    return Promise.reject(err);
  }
);

export async function getCustomers(
  filters: CustomerFilters & { page?: number; limit?: number }
): Promise<CustomersResponse> {
  const { data } = await api.get<CustomersResponse>('/customers', { params: filters });
  return data;
}

export async function getCustomer(id: number): Promise<Customer> {
  const { data } = await api.get<Customer>(`/customers/${id}`);
  return data;
}

export async function getNextCode(): Promise<string> {
  const { data } = await api.get<{ code: string }>('/customers/next-code');
  return data.code;
}

export async function createCustomer(payload: CustomerFormData): Promise<Customer> {
  const { data } = await api.post<Customer>('/customers', payload);
  return data;
}

export async function updateCustomer(
  id: number,
  payload: CustomerFormData
): Promise<Customer> {
  const { data } = await api.put<Customer>(`/customers/${id}`, payload);
  return data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}`);
}

export async function getCustomerCategories(): Promise<CustomerCategory[]> {
  const { data } = await api.get<CustomerCategory[]>('/customer-categories');
  return data;
}
