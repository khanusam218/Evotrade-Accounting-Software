import api from './axiosConfig';

export type CustomFieldEntityType = 'customer' | 'vendor' | 'product';

export interface CustomFieldDefinition {
  id: number;
  entity_type: CustomFieldEntityType;
  name: string;
}

export interface CustomFieldValue {
  id: number;
  definition_id: number;
  field_name: string;
  value: string | null;
}

export async function getCustomFieldDefinitions(entity_type: CustomFieldEntityType): Promise<CustomFieldDefinition[]> {
  const { data } = await api.get<CustomFieldDefinition[]>('/custom-fields/definitions', { params: { entity_type } });
  return data;
}

export async function createCustomFieldDefinition(entity_type: CustomFieldEntityType, name: string): Promise<CustomFieldDefinition> {
  const { data } = await api.post<CustomFieldDefinition>('/custom-fields/definitions', { entity_type, name });
  return data;
}

export async function getCustomFieldValues(entity_type: CustomFieldEntityType, entity_id: number): Promise<CustomFieldValue[]> {
  const { data } = await api.get<CustomFieldValue[]>('/custom-fields/values', { params: { entity_type, entity_id } });
  return data;
}

export async function saveCustomFieldValues(
  entity_type: CustomFieldEntityType,
  entity_id: number,
  values: { definition_id: number; value: string }[]
): Promise<void> {
  await api.put('/custom-fields/values', { entity_type, entity_id, values });
}
