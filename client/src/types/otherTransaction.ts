// Shared types for Other Collections, Other Payments, and Instruments

export type OTStatus = 'draft' | 'approved' | 'cancelled';
export type PaymentMode = 'cash' | 'cheque' | 'bank_transfer';
export type InstrumentStatus = 'pending' | 'cleared' | 'bounced' | 'void';

export interface PaymentInstrument {
  id?: number;
  source_type?: string;
  source_id?: number;
  payment_mode: PaymentMode | '';
  bank_name: string;
  instrument_no: string;
  instrument_date: string;
  amount: number | '';
  status?: InstrumentStatus;
}

export interface AdjustmentLine {
  id?: number;
  account_id: number | '';
  account_code?: string;
  account_name?: string;
  description: string;
  amount: number | '';
}

export interface OtherCollection {
  id: number;
  number: string;
  date: string;
  contact_name: string;
  reference: string | null;
  bank_account_id: number;
  bank_account_name: string;
  bank_account_code: string;
  bank_name: string;
  comments: string | null;
  total_amount: number;
  status: OTStatus;
  created_at: string;
  instruments?: PaymentInstrument[];
  adjustments?: AdjustmentLine[];
}

export interface OtherPayment {
  id: number;
  number: string;
  date: string;
  contact_name: string;
  reference: string | null;
  bank_account_id: number;
  bank_account_name: string;
  bank_account_code: string;
  bank_name: string;
  comments: string | null;
  total_amount: number;
  status: OTStatus;
  created_at: string;
  instruments?: PaymentInstrument[];
  adjustments?: AdjustmentLine[];
}

export interface OTFormData {
  date: string;
  contact_name: string;
  reference: string;
  bank_account_id: string;
  comments: string;
  instruments: PaymentInstrument[];
  adjustments: AdjustmentLine[];
}

export const OT_STATUS_LABELS: Record<OTStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export const OT_STATUS_COLORS: Record<OTStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash:          'Cash',
  cheque:        'Cheque',
  bank_transfer: 'Bank Transfer',
};

export const INSTRUMENT_STATUS_LABELS: Record<InstrumentStatus, string> = {
  pending: 'Pending',
  cleared: 'Cleared',
  bounced: 'Bounced',
  void:    'Void',
};

export const INSTRUMENT_STATUS_COLORS: Record<InstrumentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  cleared: 'bg-green-100 text-green-700',
  bounced: 'bg-red-100 text-red-700',
  void:    'bg-gray-100 text-gray-500',
};
