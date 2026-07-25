export type SMStatus = 'draft' | 'completed' | 'cancelled';

export interface StockMovementLine {
  id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  notes?: string;
}

export interface StockMovement {
  id: number;
  number: string;
  date: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  from_warehouse_name?: string;
  to_warehouse_name?: string;
  reference?: string;
  notes?: string;
  status: SMStatus;
  lines?: StockMovementLine[];
  created_at: string;
}
