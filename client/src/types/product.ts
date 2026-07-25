export type ProductType = 'product' | 'service' | 'product_variant';

export interface ProductCategory {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  is_active: boolean;
}

export interface Brand {
  id: number;
  name: string;
  is_active: boolean;
}

export interface Tax {
  id: number;
  name: string;
  abbreviation: string;
  rate: number;
  tax_type: string;
  applies_to_sales: boolean;
  applies_to_purchases: boolean;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  type: ProductType;
  category_id: number | null;
  category_name: string | null;
  brand_id: number | null;
  brand_name: string | null;
  unit_of_measurement: string;
  fractional_units: boolean;
  track_inventory: boolean;
  manage_batch: boolean;
  manage_serial: boolean;
  has_packaging: boolean;
  is_assembled: boolean;
  is_purchased: boolean;
  purchase_price: number | null;
  purchase_tax_id: number | null;
  purchase_tax_name: string | null;
  manage_purchase_tax: boolean;
  is_sold: boolean;
  sale_price: number | null;
  mrp: number | null;
  mrp_exclusive_of_tax: boolean;
  dont_allow_public: boolean;
  is_active: boolean;
  description: string | null;
  short_description: string | null;
  created_at: string;
}

export interface ProductFormData {
  name: string;
  type: ProductType;
  category_id: string;
  brand_id: string;
  unit_of_measurement: string;
  fractional_units: boolean;
  // Inventory toggles (immutable after first save)
  track_inventory: boolean;
  manage_batch: boolean;
  manage_serial: boolean;
  has_packaging: boolean;
  is_assembled: boolean;
  // Purchase
  is_purchased: boolean;
  purchase_price: string;
  purchase_tax_id: string;
  manage_purchase_tax: boolean;
  // Sales
  is_sold: boolean;
  sale_price: string;
  mrp: string;
  mrp_exclusive_of_tax: boolean;
  dont_allow_public: boolean;
  // Status
  is_active: boolean;
  // Detail tab
  description: string;
  short_description: string;
}

export interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductFilters {
  code?: string;
  name?: string;
  type?: string;
  category_id?: string;
  brand_id?: string;
  is_active?: string;
}

export interface ProductStockLevel {
  id: number;
  warehouse_id: number;
  warehouse_name: string;
  qty_on_hand: number;
  min_stock_level: number;
}
