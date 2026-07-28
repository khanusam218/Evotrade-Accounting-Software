export type WOStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export const WO_STATUS_COLORS: Record<WOStatus, string> = {
  draft:       'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
};

export interface WorkOrderComponent {
  id?: number;
  component_product_id: number | null;
  component_name?: string;
  quantity: number;
  qty_on_hand?: number;
}

export interface WorkOrder {
  id: number;
  number: string;
  date: string;
  bom_id: number;
  bom_name?: string;
  product_name?: string;
  warehouse_id: number | null;
  warehouse_name?: string;
  planned_qty: number;
  produced_qty: number;
  status: WOStatus;
  notes: string | null;
  created_at?: string;
}
