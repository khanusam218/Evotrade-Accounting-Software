export type CNStatus = 'draft' | 'approved' | 'cancelled';

export interface CreditNoteAllocation {
  id?: number;
  credit_note_id?: number;
  sales_invoice_id?: number | null;
  invoice_ref: string;
  description: string;
  amount: number | '';
}

export interface CreditNote {
  id: number;
  number: string;
  date: string;
  contact_name: string;
  reference: string | null;
  account_id: number;
  account_code: string;
  account_name: string;
  amount: number;
  unadjusted_amount: number;
  comments: string | null;
  auto_settle: boolean;
  status: CNStatus;
  created_at: string;
  allocations?: CreditNoteAllocation[];
}

export interface CNFormData {
  date: string;
  contact_name: string;
  reference: string;
  account_id: string;
  amount: string;
  comments: string;
  auto_settle: boolean;
  allocations: CreditNoteAllocation[];
}

export const CN_STATUS_LABELS: Record<CNStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export const CN_STATUS_COLORS: Record<CNStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
