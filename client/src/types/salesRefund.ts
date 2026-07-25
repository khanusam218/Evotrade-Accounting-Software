export type SRefundStatus = 'draft' | 'approved' | 'cancelled';

export const SREFUND_STATUS_COLORS: Record<SRefundStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const SREFUND_STATUS_LABELS: Record<SRefundStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export type RefundMode = 'cash' | 'bank' | 'cheque' | 'card' | 'other';

export interface SalesRefundInstrument {
  id?: number;
  mode: RefundMode;
  bank_ref: string | null;
  date: string;
  account_id: number | null;
  account_name?: string;
  amount: number;
}

export interface SalesRefund {
  id: number;
  number: string;
  date: string;
  customer_id: number;
  customer_name?: string;
  return_id: number | null;
  return_number?: string | null;
  reference: string | null;
  notes: string | null;
  total_amount: number;
  unadjusted_amount: number;
  status: SRefundStatus;
  created_at?: string;
  instruments?: SalesRefundInstrument[];
}
