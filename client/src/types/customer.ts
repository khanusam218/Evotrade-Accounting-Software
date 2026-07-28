export interface CustomerCategory {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Customer {
  id: number;
  code: string;
  print_name: string;
  email_1: string | null;
  email_2: string | null;
  email_3: string | null;
  phone_1: string | null;
  phone_2: string | null;
  phone_3: string | null;
  longitude: number | null;
  latitude: number | null;
  opening_balance: number;
  credit_limit: number;
  default_discount_percent: number;
  discount_account_id: number | null;
  withholding_tax_percent: number;
  category_id: number | null;
  category_name: string | null;
  contact_person: string | null;
  is_active: boolean;
  profile_image: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  zip_code: string | null;
  created_at: string;
}

export interface CustomerFormData {
  print_name: string;
  email_1: string;
  email_2: string;
  email_3: string;
  phone_1: string;
  phone_2: string;
  phone_3: string;
  opening_balance: number;
  credit_limit: number;
  default_discount_percent: number;
  withholding_tax_percent: number;
  category_id: string;
  contact_person: string;
  is_active: boolean;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state_province: string;
  country: string;
  zip_code: string;
  profile_image?: string | null;
  longitude?: string;
  latitude?: string;
}

export interface CustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerFilters {
  code?: string;
  name?: string;
  category_id?: string;
  is_active?: string;
}
