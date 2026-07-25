export type BDStatus = 'draft' | 'deposited' | 'cleared' | 'cancelled';

export interface BankDepositLine {
  id?: number;
  deposit_id?: number;
  line_date?: string;
  received_from?: string;
  payment_mode?: string;
  bank_name?: string;
  branch_code?: string;
  branch_name?: string;
  instrument_no?: string;
  description: string;
  amount: number | '';
  account_id?: number | null;
  source_type?: 'manual' | 'instrument';
  source_id?: number | null;
}

export interface BankDeposit {
  id: number;
  number: string;
  date: string;
  bank_account_id: number;
  bank_account_name: string;
  bank_account_code: string;
  bank_name: string;
  deposit_no: string | null;
  comments: string | null;
  total_amount: number;
  status: BDStatus;
  created_at: string;
  lines?: BankDepositLine[];
}

export interface BDFormData {
  date: string;
  bank_account_id: string;
  deposit_no: string;
  comments: string;
  lines: BankDepositLine[];
}

export const BD_STATUS_LABELS: Record<BDStatus, string> = {
  draft:     'Draft',
  deposited: 'Deposited',
  cleared:   'Cleared',
  cancelled: 'Cancelled',
};

export const BD_STATUS_COLORS: Record<BDStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  deposited: 'bg-blue-100 text-blue-700',
  cleared:   'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
