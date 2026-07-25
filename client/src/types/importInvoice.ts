export type IIStatus = 'draft' | 'approved' | 'cancelled';

export const II_STATUS_COLORS: Record<IIStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  approved:  'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const II_STATUS_LABELS: Record<IIStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export interface ImportInvoiceLine {
  id?: number;
  product_id?: number | null;
  product_name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  amount: number;
  allocation_pct?: number;
}

export interface ImportInvoiceExpense {
  id?: number;
  expense_type: string;
  account_id?: number | null;
  account_name?: string;
  description?: string;
  contact_id?: number | null;
  contact_name?: string;
  amount: number;
  distribution_method: 'value' | 'qty' | 'equal';
}

export interface ImportInvoice {
  id: number;
  number: string;
  date: string;
  due_date?: string | null;
  vendor_id: number;
  vendor_name?: string;
  order_id?: number | null;
  reference?: string | null;
  notes?: string | null;
  subject?: string | null;
  discount_pct?: number;
  shipping_charges?: number;
  round_off?: number;
  net_amount: number;
  expense_total: number;
  total_landed_cost: number;
  balance_amount: number;
  status: IIStatus;
  lines?: ImportInvoiceLine[];
  expenses?: ImportInvoiceExpense[];
  created_at?: string;
}
