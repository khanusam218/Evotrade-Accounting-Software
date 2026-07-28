export type DNStatus = 'draft' | 'approved' | 'cancelled';

export interface DebitNoteAllocation {
  id?: number;
  debit_note_id?: number;
  purchase_invoice_id?: number | null;
  invoice_ref: string;
  description: string;
  amount: number | '';
}

export interface DebitNote {
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
  status: DNStatus;
  created_at: string;
  allocations?: DebitNoteAllocation[];
}

export interface DNFormData {
  date: string;
  contact_name: string;
  reference: string;
  account_id: string;
  amount: string;
  comments: string;
  auto_settle: boolean;
  allocations: DebitNoteAllocation[];
}

export const DN_STATUS_LABELS: Record<DNStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  cancelled: 'Cancelled',
};

export const DN_STATUS_COLORS: Record<DNStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
