export type PSStatus = 'draft' | 'approved' | 'cancelled';

export const PS_STATUS_COLORS: Record<PSStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const PS_STATUS_LABELS: Record<PSStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export interface PurchaseSettlementLine {
  id?: number;
  invoice_id: number;
  invoice_number?: string;
  invoice_net?: number;
  invoice_balance?: number;
  amount: number;
  write_off: boolean;
}

export interface PurchaseSettlement {
  id: number;
  number: string;
  date: string;
  vendor_id: number;
  vendor_name?: string;
  account_id: number;
  account_name?: string;
  reference: string | null;
  notes: string | null;
  total_amount: number;
  auto_settle: boolean;
  status: PSStatus;
  created_at?: string;
  lines?: PurchaseSettlementLine[];
}
