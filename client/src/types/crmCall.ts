export type CallStatus = 'planned' | 'completed' | 'missed' | 'cancelled';

export interface CrmCall {
  id: number;
  number: string;
  subject: string;
  customer_id?: number;
  customer_name?: string;
  lead_id?: number;
  contact_name?: string;
  phone?: string;
  call_type?: 'inbound' | 'outbound';
  call_purpose?: string;
  call_date?: string;
  duration_minutes?: number;
  assigned_to?: string;
  status: CallStatus;
  follow_up_required: boolean;
  follow_up_date?: string;
  notes?: string;
  created_at: string;
}
