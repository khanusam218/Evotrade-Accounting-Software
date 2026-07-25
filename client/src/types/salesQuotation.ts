export type SQStatus = 'draft' | 'sent' | 'approved' | 'converted' | 'cancelled';

export interface SalesQuotationLine {
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

export interface SalesQuotation {
  id: number;
  number: string;
  date: string;
  customer_id: number;
  customer_name: string;
  expiry_date: string | null;
  reference: string | null;
  subject: string | null;
  notes: string | null;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  discount_pct: number;
  shipping_charges: number;
  net_amount: number;
  status: SQStatus;
  created_at: string;
  lines?: SalesQuotationLine[];
}

export const SQ_STATUS_COLORS: Record<SQStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  sent:      'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  converted: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const SQ_STATUS_LABELS: Record<SQStatus, string> = {
  draft:     'Draft',
  sent:      'Sent',
  approved:  'Approved',
  converted: 'Converted',
  cancelled: 'Cancelled',
};
