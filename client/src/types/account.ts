export type AccountType =
  | 'asset' | 'contra_asset'
  | 'liability'
  | 'equity'
  | 'revenue' | 'contra_revenue'
  | 'expense';

export type AccountGroup = 'transactional' | 'control';

export type NormalBalance = 'debit' | 'credit';

export interface Account {
  id: number;
  code: string;
  name: string;
  system_name: string | null;
  account_type: AccountType;
  account_group: AccountGroup;
  parent_id: number | null;
  parent_name: string | null;
  parent_code: string | null;
  is_active: boolean;
  is_system: boolean;
  normal_balance: NormalBalance;
  opening_balance: number;
  current_balance: number;
  description: string | null;
  created_at: string;
}

export interface AccountFormData {
  code: string;
  name: string;
  description: string;
  account_group: AccountGroup;
  parent_id: string;
  opening_balance: number;
  is_active: boolean;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset:          'Asset',
  contra_asset:   'Contra Asset',
  liability:      'Liability',
  equity:         'Equity',
  revenue:        'Revenue',
  contra_revenue: 'Contra Revenue',
  expense:        'Expense',
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'asset', 'contra_asset', 'liability', 'equity', 'revenue', 'contra_revenue', 'expense',
];

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  asset:          'text-blue-700   bg-blue-50   border-blue-200',
  contra_asset:   'text-blue-500   bg-blue-50   border-blue-200',
  liability:      'text-red-700    bg-red-50    border-red-200',
  equity:         'text-purple-700 bg-purple-50 border-purple-200',
  revenue:        'text-green-700  bg-green-50  border-green-200',
  contra_revenue: 'text-green-500  bg-green-50  border-green-200',
  expense:        'text-orange-700 bg-orange-50 border-orange-200',
};
