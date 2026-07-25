export type FTStatus = 'draft' | 'posted' | 'cancelled';

export interface FundTransfer {
  id: number;
  number: string;
  date: string;
  reference: string | null;
  comments: string | null;
  from_bank_account_id: number;
  from_account_code: string;
  from_account_name: string;
  from_bank_name: string;
  to_bank_account_id: number;
  to_account_code: string;
  to_account_name: string;
  to_bank_name: string;
  amount: number;
  status: FTStatus;
  created_at: string;
}

export interface FundTransferFormData {
  date: string;
  reference: string;
  comments: string;
  from_bank_account_id: string;
  to_bank_account_id: string;
  amount: string;
}

export const FT_STATUS_LABELS: Record<FTStatus, string> = {
  draft:     'Draft',
  posted:    'Posted',
  cancelled: 'Cancelled',
};

export const FT_STATUS_COLORS: Record<FTStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  posted:    'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
