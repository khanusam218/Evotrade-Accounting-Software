export type PIStatus = 'draft' | 'approved' | 'partially_paid' | 'paid' | 'cancelled';

export const PI_STATUS_COLORS: Record<PIStatus, string> = {
  draft:          'bg-gray-100 text-gray-700',
  approved:       'bg-blue-100 text-blue-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  paid:           'bg-green-100 text-green-700',
  cancelled:      'bg-red-100 text-red-700',
};

export const PI_STATUS_LABELS: Record<PIStatus, string> = {
  draft:          'Draft',
  approved:       'Approved',
  partially_paid: 'Partially Paid',
  paid:           'Paid',
  cancelled:      'Cancelled',
};

export interface PurchaseInvoiceLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  amount: number;
  tax_id: number | null;
  tax_name?: string;
  tax_rate?: number;
  tax_amount: number;
}

export interface PurchaseInvoice {
  id: number;
  number: string;
  date: string;
  vendor_id: number;
  vendor_name?: string;
  order_id: number | null;
  due_date: string | null;
  reference: string | null;
  notes: string | null;
  subject: string | null;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  shipping_charges: number;
  round_off: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;
  is_overdue: boolean;
  status: PIStatus;
  created_at?: string;
  lines?: PurchaseInvoiceLine[];
}
