export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';

export const LEAD_STAGE_COLORS: Record<LeadStage, string> = {
  new:       'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-yellow-100 text-yellow-700',
  proposal:  'bg-purple-100 text-purple-700',
  won:       'bg-green-100 text-green-700',
  lost:      'bg-red-100 text-red-700',
};

export const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

export const LEAD_SOURCES = [
  'None', 'Advertisement', 'Cold Call', 'Employee Referral', 'External Referral',
  'Website', 'Facebook', 'Twitter', 'Partner', 'Public Relations',
  'Seminar', 'Trade Show', 'Web Research', 'Chat',
];

export const LEAD_STATUSES = [
  'None', 'Attempted to Contact', 'Contact in Future', 'Contacted',
  'Junk Lead', 'Lost Lead', 'Not Contacted', 'Pre Qualified', 'Not Qualified',
];

export const LEAD_INDUSTRIES = [
  'Government', 'Large Enterprise', 'Service Provider', 'Small/Medium Enterprise',
  'Apparel', 'Chemical', 'Construction', 'Consulting', 'Electronics',
  'Entertainment', 'Finance', 'Food & Beverage', 'Non Profit Organization',
  'Manufacturing', 'Retail', 'Shipping', 'Technology', 'Other',
];

export interface CrmActivity {
  id: number;
  lead_id: number;
  type: string;
  date: string;
  subject: string | null;
  description: string | null;
  created_at?: string;
}

export interface CrmLead {
  id: number;
  number?: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: LeadStage;
  probability: number;
  expected_revenue: number;
  assigned_to: string | null;
  notes: string | null;
  lead_status: string | null;
  industry: string | null;
  website: string | null;
  lead_date: string | null;
  annual_revenue: number;
  num_employees: number;
  contact_name: string | null;
  tag: string | null;
  created_at?: string;
  activities?: CrmActivity[];
  converted_to_customer_id?: number | null;
}
