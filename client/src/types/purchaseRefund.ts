export type PRefundStatus = 'draft' | 'approved' | 'cancelled';

export const PREFUND_STATUS_COLORS: Record<PRefundStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const PREFUND_STATUS_LABELS: Record<PRefundStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export type PRefundMode = 'cash' | 'bank' | 'cheque' | 'card' | 'other';

export interface PurchaseRefundInstrument {
  id?: number;
  mode: PRefundMode;
  bank_ref: string | null;
  bank_name: string | null;
  instrument_no: string | null;
  date: string;
  account_id: number | null;
  account_name?: string;
  amount: number;
}

export interface PurchaseRefund {
  id: number;
  number: string;
  date: string;
  vendor_id: number;
  vendor_name?: string;
  return_id: number | null;
  return_number?: string | null;
  reference: string | null;
  notes: string | null;
  total_amount: number;
  unadjusted_amount: number;
  status: PRefundStatus;
  created_at?: string;
  instruments?: PurchaseRefundInstrument[];
}
