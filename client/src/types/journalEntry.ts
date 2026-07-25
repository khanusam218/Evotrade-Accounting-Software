export type JEStatus = 'draft' | 'posted' | 'cancelled';

export interface JournalEntryLine {
  id?: number;
  account_id: number | '';
  account_code?: string;
  account_name?: string;
  description: string;
  debit: number | '';
  credit: number | '';
}

export interface JournalEntry {
  id: number;
  number: string;
  date: string;
  memo: string;
  reference: string | null;
  status: JEStatus;
  total_debit: number;
  total_credit: number;
  created_at: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryFormData {
  date: string;
  memo: string;
  reference: string;
  lines: JournalEntryLine[];
}

export const JE_STATUS_LABELS: Record<JEStatus, string> = {
  draft:     'Draft',
  posted:    'Posted',
  cancelled: 'Cancelled',
};

export const JE_STATUS_COLORS: Record<JEStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  posted:    'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
