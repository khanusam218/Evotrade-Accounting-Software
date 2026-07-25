export type SOStatus = 'draft' | 'confirmed' | 'shipped' | 'delivered' | 'invoiced' | 'cancelled';

export interface SalesOrderLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  amount: number;
  invoiced_qty: number;
  tax_id: number | null;
  tax_amount: number;
  tax_name?: string;
  tax_rate?: number;
}

export interface SalesOrder {
  id: number;
  number: string;
  date: string;
  delivery_date: string;
  customer_id: number;
  customer_name: string;
  quotation_id: number | null;
  reference: string | null;
  subject: string | null;
  notes: string | null;
  comments: string | null;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  discount_pct: number;
  shipping_charges: number;
  net_amount: number;
  status: SOStatus;
  created_at: string;
  lines?: SalesOrderLine[];
}

export const SO_STATUS_COLORS: Record<SOStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped:   'bg-cyan-100 text-cyan-700',
  delivered: 'bg-teal-100 text-teal-700',
  invoiced:  'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const SO_STATUS_LABELS: Record<SOStatus, string> = {
  draft:     'Draft',
  confirmed: 'Confirmed',
  shipped:   'Shipped',
  delivered: 'Delivered',
  invoiced:  'Invoiced',
  cancelled: 'Cancelled',
};
