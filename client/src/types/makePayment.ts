export type MPStatus = 'draft' | 'approved' | 'cancelled';

export const MP_STATUS_COLORS: Record<MPStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const MP_STATUS_LABELS: Record<MPStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export type PaymentMode = 'cash' | 'bank' | 'cheque' | 'card' | 'other';

export interface MakePaymentInstrument {
  id?: number;
  mode: PaymentMode;
  bank_ref: string | null;
  date: string;
  account_id: number | null;
  account_name?: string;
  amount: number;
}

export interface MakePayment {
  id: number;
  number: string;
  date: string;
  vendor_id: number;
  vendor_name?: string;
  reference: string | null;
  notes: string | null;
  total_amount: number;
  unadjusted_amount: number;
  status: MPStatus;
  created_at?: string;
  instruments?: MakePaymentInstrument[];
}
