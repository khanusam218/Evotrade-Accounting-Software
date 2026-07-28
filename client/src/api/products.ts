import api from './axiosConfig';
import type {
  Brand, ProductCategory, ProductFilters, ProductFormData,
  Product, ProductsResponse, Tax,
} from '../types/product';


api.interceptors.response.use(
  (r) => r,
  (err) => {
    const serverMsg = err?.response?.data?.error;
    if (serverMsg) err.message = serverMsg;
    return Promise.reject(err);
  }
);

export const getProducts = async (
  filters: ProductFilters & { page?: number; limit?: number }
): Promise<ProductsResponse> =>
  (await api.get<ProductsResponse>('/products', { params: filters })).data;

export const getProduct = async (id: number): Promise<Product> =>
  (await api.get<Product>(`/products/${id}`)).data;

export const getNextProductCode = async (): Promise<string> =>
  (await api.get<{ code: string }>('/products/next-code')).data.code;

export const createProduct = async (payload: ProductFormData): Promise<Product> =>
  (await api.post<Product>('/products', payload)).data;

export const updateProduct = async (id: number, payload: ProductFormData): Promise<Product> =>
  (await api.put<Product>(`/products/${id}`, payload)).data;

export const deleteProduct = async (id: number): Promise<void> => {
  await api.delete(`/products/${id}`);
};

export const getProductCategories = async (): Promise<ProductCategory[]> =>
  (await api.get<ProductCategory[]>('/product-categories')).data;

export const getBrands = async (): Promise<Brand[]> =>
  (await api.get<Brand[]>('/brands')).data;

export const getTaxes = async (appliesTo?: 'sales' | 'purchases'): Promise<Tax[]> =>
  (await api.get<Tax[]>('/taxes', { params: appliesTo ? { applies_to: appliesTo } : {} })).data;
