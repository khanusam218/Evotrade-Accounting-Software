export type SIStatus = 'draft' | 'approved' | 'partially_paid' | 'paid' | 'cancelled';

export interface SalesInvoiceLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  amount: number;
  tax_id: number | null;
  tax_amount: number;
  tax_name?: string;
  tax_rate?: number;
}

export interface SalesInvoice {
  id: number;
  number: string;
  date: string;
  due_date: string | null;
  customer_id: number;
  customer_name: string;
  order_id: number | null;
  quotation_id?: number | null;
  reference: string | null;
  subject: string | null;
  notes: string | null;
  shipping_address: string | null;
  customer_address_line_1: string | null;
  customer_address_line_2: string | null;
  customer_city: string | null;
  customer_state_province: string | null;
  customer_country: string | null;
  customer_zip_code: string | null;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  discount_pct: number;
  shipping_charges: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  is_overdue: boolean;
  status: SIStatus;
  created_at: string;
  lines?: SalesInvoiceLine[];
}

export const SI_STATUS_COLORS: Record<SIStatus, string> = {
  draft:          'bg-yellow-100 text-yellow-700',
  approved:       'bg-blue-100 text-blue-700',
  partially_paid: 'bg-orange-100 text-orange-700',
  paid:           'bg-green-100 text-green-700',
  cancelled:      'bg-red-100 text-red-700',
};

export const SI_STATUS_LABELS: Record<SIStatus, string> = {
  draft:          'Draft',
  approved:       'Approved',
  partially_paid: 'Partial',
  paid:           'Paid',
  cancelled:      'Cancelled',
};
