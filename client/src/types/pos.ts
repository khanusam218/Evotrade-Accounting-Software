export type POSSessionStatus = 'open' | 'closed';
export type POSTxStatus = 'completed' | 'voided';

export interface POSCounter {
  id: number;
  name: string;
  warehouse_id: number | null;
  warehouse_name?: string;
  cash_account_id: number | null;
  cash_account_name?: string;
  is_active: boolean;
  pos_invoice_series_id: number | null;
  sale_return_series_id: number | null;
  sale_order_series_id:  number | null;
  pos_invoice_series_name?: string;
  sale_return_series_name?: string;
  sale_order_series_name?: string;
  pos_search_sale_order: boolean;
  pos_search_product: boolean;
  primary_search: string;
}

export interface POSSession {
  id: number;
  number: string;
  opening_date: string;
  closing_date: string | null;
  opening_balance: number;
  closing_balance: number | null;
  status: POSSessionStatus;
  warehouse_id: number | null;
  warehouse_name?: string;
  counter_id: number | null;
  counter_name: string | null;
  cash_account_id?: number | null;
  notes: string | null;
}

export interface POSTransactionLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  tax_id: number | null;
  tax_amount: number;
  amount: number;
}

export interface POSTransaction {
  id: number;
  number: string;
  date: string;
  session_id: number;
  customer_id: number | null;
  customer_name?: string;
  subtotal: number;
  tax_total: number;
  discount: number;
  total: number;
  paid_amount: number;
  change_amount: number;
  payment_mode: string;
  status: POSTxStatus;
  notes: string | null;
  lines?: POSTransactionLine[];
}
