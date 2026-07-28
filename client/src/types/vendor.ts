export interface VendorCategory {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Vendor {
  id: number;
  code: string;
  print_name: string;
  email: string | null;
  phone_1: string | null;
  phone_2: string | null;
  category_id: number | null;
  category_name: string | null;
  opening_balance: number;
  credit_limit_days: number;
  is_principal: boolean;
  contact_person: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  profile_image: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export interface VendorFormData {
  print_name: string;
  email: string;
  phone_1: string;
  phone_2: string;
  category_id: string;
  opening_balance: number;
  credit_limit_days: number;
  is_principal: boolean;
  contact_person: string;
  address: string;
  is_active: boolean;
  profile_image?: string | null;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface VendorsResponse {
  data: Vendor[];
  total: number;
  page: number;
  limit: number;
}

export interface VendorFilters {
  code?: string;
  name?: string;
  category_id?: string;
  is_active?: string;
}
