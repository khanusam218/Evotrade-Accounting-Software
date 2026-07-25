export interface Department {
  id: number;
  name: string;
  notes?: string;
}

export interface Designation {
  id: number;
  name: string;
  department_id?: number;
  department_name?: string;
  notes?: string;
}

export interface Employee {
  id: number;
  code: string;
  name: string;
  department_id?: number;
  department_name?: string;
  designation_id?: number;
  designation_name?: string;
  join_date?: string;
  salary: number;
  ntn?: string;
  cnic?: string;
  phone?: string;
  email?: string;
  address?: string;
  bank_account?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  customer_id?: number;
  customer_name?: string;
  reference?: string;
  start_date?: string;
  end_date?: string;
  budget: number;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  notes?: string;
  created_at: string;
}
