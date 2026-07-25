export type DSStatus = 'draft' | 'completed' | 'cancelled';

export interface DisassemblyLine {
  id?: number;
  product_id: number;
  product_name?: string;
  batch?: string;
  quantity: number;
  cost?: number;
  amount?: number;
  notes?: string;
}

export interface DisassemblyOutputLine extends DisassemblyLine {}

export interface DisassemblyOrder {
  id: number;
  number: string;
  date: string;
  product_id: number;
  product_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  quantity: number;
  status: DSStatus;
  reference?: string;
  notes?: string;
  account_expenses?: boolean;
  input_lines?: DisassemblyLine[];
  lines?: DisassemblyLine[];
  created_at: string;
}
