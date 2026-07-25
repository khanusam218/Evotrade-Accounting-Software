export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  created_at?: string;
}
