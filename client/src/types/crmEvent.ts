export type EventStatus = 'planned' | 'held' | 'cancelled';

export const EVENT_TYPES = ['Meeting', 'Demo', 'Call', 'Follow-up', 'Presentation', 'Training', 'Workshop', 'Other'];

export const EVENT_PRIORITIES = ['Not Set', 'High', 'Medium', 'Low'];

export const EVENT_SOURCES = [
  'None', 'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral',
  'Website', 'Facebook', 'Twitter', 'Partner', 'Public Relations',
  'Seminar', 'Trade Show', 'Web Research', 'Chat',
];

export interface CrmEvent {
  id: number;
  number: string;
  subject: string;
  customer_id?: number;
  customer_name?: string;
  lead_id?: number;
  contact_name?: string;
  phone?: string;
  phone_2?: string;
  city?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  assigned_to?: string;
  status: EventStatus;
  priority?: string;
  location?: string;
  source?: string;
  description?: string;
  notes?: string;
  created_at: string;
  status_updated_on?: string;
}
