export interface SalesPerson {
  id: number;
  code: string;
  print_name: string;
  type: 'salesman' | 'order_booker' | 'delivery_person';
  email: string | null;
  phone: string | null;
  can_change_price: boolean;
  can_add_discount: boolean;
  is_manager: boolean;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  // Additional fields (UI or future)
  manager_id?: number | null;
  manager_name?: string | null;
  application_user_id?: number | null;
  application_user_email?: string | null;
  cash_account_id?: number | null;
  sale_order_series_id?: number | null;
  receive_payment_series_id?: number | null;
  branch_id?: number | null;
  branch_name?: string | null;
}

export interface SalesPersonFormData {
  print_name: string;
  type: 'salesman' | 'order_booker' | 'delivery_person';
  email: string;
  phone: string;
  can_change_price: boolean;
  can_add_discount: boolean;
  is_manager: boolean;
  status: 'active' | 'inactive';
  notes: string;
  // UI-only fields
  cash_account_id: string;
  sale_order_series_id: string;
  receive_payment_series_id: string;
  manager_id: string;
  application_user_id: string;
}

export interface SalesPersonsResponse {
  data: SalesPerson[];
  total: number;
  page: number;
  limit: number;
}

export interface SalesPersonFilters {
  print_name?: string;
  status?: string;
  type?: string;
}
