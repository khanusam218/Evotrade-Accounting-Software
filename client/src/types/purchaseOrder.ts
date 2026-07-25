export type POStatus = 'draft' | 'confirmed' | 'received' | 'invoiced' | 'cancelled';

export const PO_STATUS_COLORS: Record<POStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  received:  'bg-cyan-100 text-cyan-700',
  invoiced:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft:     'Draft',
  confirmed: 'Confirmed',
  received:  'Received',
  invoiced:  'Invoiced',
  cancelled: 'Cancelled',
};

export interface PurchaseOrderLine {
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
  received_qty: number;
}

export interface PurchaseOrder {
  id: number;
  number: string;
  date: string;
  vendor_id: number;
  vendor_name?: string;
  quotation_id: number | null;
  quotation_number?: string | null;
  reference: string | null;
  notes: string | null;
  subject: string | null;
  expected_date: string | null;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  net_amount: number;
  status: POStatus;
  created_at?: string;
  lines?: PurchaseOrderLine[];
}
