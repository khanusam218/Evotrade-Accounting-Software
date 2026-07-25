export type SAStatus = 'draft' | 'confirmed' | 'cancelled';

export interface StockAdjustmentLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  current_qty: number;
  new_qty: number;
  unit_cost: number;
  notes: string | null;
}

export interface StockAdjustment {
  id: number;
  number: string;
  date: string;
  warehouse_id: number;
  warehouse_name?: string;
  adjustment_type_id?: number;
  adjustment_type_name?: string;
  reference: string | null;
  notes: string | null;
  status: SAStatus;
  created_at?: string;
  lines?: StockAdjustmentLine[];
}
