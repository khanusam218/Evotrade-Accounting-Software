export type AccountGroup = 'transactional' | 'control';

export interface BankAccount {
  id: number;
  coa_id: number;
  code: string;
  name: string;
  description: string | null;
  account_type: string;
  normal_balance: string;
  current_balance: number;
  bank_name: string;
  branch_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  account_group: AccountGroup;
  is_credit_card: boolean;
  is_active: boolean;
  parent_id: number | null;
  parent_code: string | null;
  parent_name: string | null;
  created_at: string;
}

export interface BankAccountFormData {
  code: string;
  name: string;
  description: string;
  parent_id: string;
  bank_name: string;
  branch_name: string;
  account_number: string;
  account_holder: string;
  account_group: AccountGroup;
  is_credit_card: boolean;
  is_active: boolean;
}

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  transactional: 'Transactional',
  control:       'Control',
};
