export type RIStatus = 'active' | 'paused' | 'cancelled' | 'completed';
export type RIFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const RI_STATUS_COLORS: Record<RIStatus, string> = {
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
};

export const RI_STATUS_LABELS: Record<RIStatus, string> = {
  active:    'Active',
  paused:    'Paused',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const RI_FREQUENCY_LABELS: Record<RIFrequency, string> = {
  daily:     'Daily',
  weekly:    'Weekly',
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  yearly:    'Yearly',
};

export interface RecurringInvoiceLine {
  id?: number;
  product_id: number | null;
  product_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  amount: number;
  tax_id: number | null;
  tax_name?: string;
  tax_rate?: number;
  tax_amount: number;
}

export interface RecurringInvoice {
  id: number;
  number: string;
  customer_id: number;
  customer_name?: string;
  reference: string | null;
  notes: string | null;
  frequency: RIFrequency;
  interval_num: number;
  start_date: string;
  end_date: string | null;
  next_exec_date: string | null;
  last_exec_date: string | null;
  due_days: number;
  gross_amount: number;
  tax_amount: number;
  discount_pct: number;
  discount: number;
  shipping_charges: number;
  round_off: number;
  net_amount: number;
  status: RIStatus;
  created_at?: string;
  lines?: RecurringInvoiceLine[];
}
