export interface BomComponent {
  id?: number;
  bom_id?: number;
  component_product_id: number | null;
  component_name?: string;
  quantity: number;
  notes: string | null;
}

export interface BillOfMaterials {
  id: number;
  product_id: number;
  product_name?: string;
  name: string;
  output_qty: number;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  components?: BomComponent[];
}
