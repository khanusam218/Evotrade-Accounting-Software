export type SDStatus = 'draft' | 'confirmed' | 'cancelled';

export interface SalesDeliveryLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  description: string;
  ordered_qty: number;
  delivered_qty: number;
}

export interface SalesDelivery {
  id: number;
  number: string;
  date: string;
  order_id: number | null;
  customer_id: number;
  customer_name?: string;
  warehouse_id: number;
  warehouse_name?: string;
  order_number?: string | null;
  status: SDStatus;
  reference: string | null;
  notes: string | null;
  subject?: string | null;
  shipping_address?: string | null;
  created_at?: string;
  lines?: SalesDeliveryLine[];
}

export const SD_STATUS_COLORS: Record<SDStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const SD_STATUS_LABELS: Record<SDStatus, string> = {
  draft:     'Draft',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};
