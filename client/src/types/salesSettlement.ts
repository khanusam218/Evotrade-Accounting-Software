export type SSStatus = 'draft' | 'approved' | 'cancelled';

export const SS_STATUS_COLORS: Record<SSStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const SS_STATUS_LABELS: Record<SSStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export interface SalesSettlementLine {
  id?: number;
  invoice_id: number;
  invoice_number?: string;
  invoice_net?: number;
  invoice_balance?: number;
  amount: number;
  write_off: boolean;
}

export interface SalesSettlement {
  id: number;
  number: string;
  date: string;
  customer_id: number;
  customer_name?: string;
  account_id: number;
  account_name?: string;
  reference: string | null;
  notes: string | null;
  total_amount: number;
  auto_settle: boolean;
  status: SSStatus;
  created_at?: string;
  lines?: SalesSettlementLine[];
}
