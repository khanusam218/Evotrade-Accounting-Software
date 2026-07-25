export type OCSStatus = 'draft' | 'approved' | 'completed' | 'cancelled';

export interface OCSReceivableLine {
  id?: number;
  reference_no: string;
  description: string;
  amount: number;
  settled_amount: number;
}

export interface OCSReceivedLine {
  id?: number;
  reference_no: string;
  description: string;
  amount: number;
  payment_mode: string;
}

export interface OCSSettlement {
  id: number;
  number: string;
  date: string;
  contact_name: string;
  reference: string | null;
  comments: string | null;
  auto_settle: boolean;
  total_receivable: number;
  total_received: number;
  status: OCSStatus;
  created_at: string;
  receivable_lines?: OCSReceivableLine[];
  received_lines?: OCSReceivedLine[];
}

export const OCS_STATUS_COLORS: Record<OCSStatus, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  approved:  'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const OCS_STATUS_LABELS: Record<OCSStatus, string> = {
  draft:     'Draft',
  approved:  'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
