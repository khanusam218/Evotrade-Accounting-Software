export type PQStatus = 'draft' | 'sent' | 'approved' | 'cancelled';

export const PQ_STATUS_COLORS: Record<PQStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  sent:      'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const PQ_STATUS_LABELS: Record<PQStatus, string> = {
  draft:     'Draft',
  sent:      'Sent',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export interface PurchaseQuotationLine {
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

export interface PurchaseQuotation {
  id: number;
  number: string;
  date: string;
  vendor_id: number;
  vendor_name?: string;
  reference: string | null;
  notes: string | null;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  net_amount: number;
  status: PQStatus;
  created_at?: string;
  lines?: PurchaseQuotationLine[];
}
