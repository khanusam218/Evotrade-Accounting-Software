export type RPStatus = 'draft' | 'approved' | 'cancelled';

export interface RPInstrument {
  id?: number;
  payment_mode: string;
  account_id?: number;
  reference?: string;
  bank_name: string;
  instrument_no: string;
  instrument_date: string;
  amount: number;
}

export interface RPAdjustment {
  id?: number;
  account_id: number;
  account_name?: string;
  account_code?: string;
  description: string;
  amount: number;
}

export interface RPAllocation {
  id?: number;
  invoice_id: number;
  invoice_number?: string;
  net_amount?: number;
  balance_amount?: number;
  amount: number;
}

export interface ReceivePayment {
  id: number;
  number: string;
  date: string;
  customer_id: number;
  customer_name: string;
  bank_account_id: number | null;
  bank_account_name: string | null;
  reference: string | null;
  notes: string | null;
  total_amount: number;
  unadjusted_amount: number;
  auto_settle: boolean;
  status: RPStatus;
  created_at: string;
  instruments?: RPInstrument[];
  adjustments?: RPAdjustment[];
  allocations?: RPAllocation[];
}

export const RP_STATUS_COLORS: Record<RPStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const RP_STATUS_LABELS: Record<RPStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};
