export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open:        'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved:    'bg-green-100 text-green-800',
  closed:      'bg-gray-100 text-gray-800',
};

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
};

export const TICKET_PRIORITIES = ['Not Set', 'High', 'Medium', 'Low'];

export interface CrmTicket {
  id: number;
  number: string;
  title: string;
  customer_id?: number;
  customer_name?: string;
  contact_name?: string;
  phone?: string;
  city?: string;
  tag?: string;
  assigned_to?: string;
  status: TicketStatus;
  created_by?: string;
  ticket_date?: string;
  project?: string;
  priority?: string;
  estimated_hours?: number;
  actual_hours?: number;
  description?: string;
  notes?: string;
  created_at: string;
}
