export type GRNStatus = 'draft' | 'confirmed' | 'cancelled';

export interface PurchaseReceiptLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  description: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
}

export interface PurchaseReceipt {
  id: number;
  number: string;
  date: string;
  order_id: number | null;
  vendor_id: number;
  vendor_name?: string;
  warehouse_id: number;
  warehouse_name?: string;
  status: GRNStatus;
  reference: string | null;
  notes: string | null;
  created_at?: string;
  lines?: PurchaseReceiptLine[];
}
