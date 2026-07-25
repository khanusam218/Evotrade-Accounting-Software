export type ExpenseStatus = 'draft' | 'approved' | 'cancelled';

export interface ExpenseLine {
  id?: number;
  account_id: number | '';
  account_code?: string;
  account_name?: string;
  description: string;
  amount: number | '';
}

export interface Expense {
  id: number;
  number: string;
  date: string;
  reference: string | null;
  vendor_id: number | null;
  vendor_name: string | null;
  vendor_code: string | null;
  bank_account_id: number;
  bank_account_name: string;
  bank_account_code: string;
  bank_name: string;
  comments: string | null;
  gross_amount: number;
  status: ExpenseStatus;
  created_at: string;
  lines?: ExpenseLine[];
}

export interface ExpenseFormData {
  date: string;
  reference: string;
  vendor_id: string;
  bank_account_id: string;
  comments: string;
  lines: ExpenseLine[];
}

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export const EXPENSE_STATUS_COLORS: Record<ExpenseStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
