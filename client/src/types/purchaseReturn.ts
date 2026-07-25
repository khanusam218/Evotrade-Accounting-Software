export type PRStatus = 'draft' | 'approved' | 'partially_adjusted' | 'fully_adjusted' | 'cancelled';

export const PR_STATUS_COLORS: Record<PRStatus, string> = {
  draft:              'bg-gray-100 text-gray-700',
  approved:           'bg-blue-100 text-blue-700',
  partially_adjusted: 'bg-yellow-100 text-yellow-700',
  fully_adjusted:     'bg-green-100 text-green-700',
  cancelled:          'bg-red-100 text-red-700',
};

export const PR_STATUS_LABELS: Record<PRStatus, string> = {
  draft:              'Draft',
  approved:           'Approved',
  partially_adjusted: 'Partially Adjusted',
  fully_adjusted:     'Fully Adjusted',
  cancelled:          'Cancelled',
};

export type PRDisposition = 'return' | 'damaged' | 'write_off';

export interface PurchaseReturnLine {
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
  disposition: PRDisposition;
}

export interface PurchaseReturn {
  id: number;
  number: string;
  date: string;
  vendor_id: number;
  vendor_name?: string;
  invoice_id: number | null;
  invoice_number?: string | null;
  reference: string | null;
  notes: string | null;
  subject: string | null;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  shipping_charges: number;
  net_amount: number;
  unadjusted_amount: number;
  status: PRStatus;
  created_at?: string;
  lines?: PurchaseReturnLine[];
}
