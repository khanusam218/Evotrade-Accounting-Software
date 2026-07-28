import { useEffect, useState } from 'react';
import {
  createCustomFieldDefinition,
  getCustomFieldDefinitions,
  getCustomFieldValues,
  saveCustomFieldValues,
  type CustomFieldDefinition,
  type CustomFieldEntityType,
  type CustomFieldValue,
} from '../api/customFields';

interface Props {
  entityType: CustomFieldEntityType;
  entityId: number | null; // null = record not saved yet
}

export default function CustomFieldsTab({ entityType, entityId }: Props) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [values,      setValues]      = useState<CustomFieldValue[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [selectedDefId, setSelectedDefId] = useState('');
  const [newFieldName,  setNewFieldName]  = useState('');
  const [fieldValue,    setFieldValue]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { getCustomFieldDefinitions(entityType).then(setDefinitions).catch(() => {}); }, [entityType]);

  useEffect(() => {
    if (!entityId) { setValues([]); return; }
    setLoading(true);
    getCustomFieldValues(entityType, entityId).then(setValues).catch(() => {}).finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  async function handleAdd() {
    if (!entityId) return;
    try {
      let defId = selectedDefId ? Number(selectedDefId) : 0;
      let fieldName = definitions.find(d => d.id === defId)?.name ?? '';
      if (!defId) {
        if (!newFieldName.trim()) { setMsg({ type: 'err', text: 'Choose an existing field or type a new field name.' }); return; }
        const created = await createCustomFieldDefinition(entityType, newFieldName.trim());
        defId = created.id;
        fieldName = created.name;
        setDefinitions(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (values.some(v => v.definition_id === defId)) {
        setMsg({ type: 'err', text: 'This field is already added to this record.' });
        return;
      }
      const nextValues = [...values, { id: 0, definition_id: defId, field_name: fieldName, value: fieldValue }];
      setSaving(true);
      await saveCustomFieldValues(entityType, entityId, nextValues.map(v => ({ definition_id: v.definition_id, value: v.value ?? '' })));
      setValues(nextValues);
      setSelectedDefId(''); setNewFieldName(''); setFieldValue('');
      setMsg({ type: 'ok', text: 'Field added.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed to add field.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(defId: number) {
    if (!entityId) return;
    const nextValues = values.filter(v => v.definition_id !== defId);
    try {
      await saveCustomFieldValues(entityType, entityId, nextValues.map(v => ({ definition_id: v.definition_id, value: v.value ?? '' })));
      setValues(nextValues);
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed to remove field.' });
    }
  }

  if (!entityId) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
        Save this record first — custom fields are added on the saved record, from this tab.
      </div>
    );
  }

  const availableDefs = definitions.filter(d => !values.some(v => v.definition_id === d.id));

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Custom Fields</h3>
      {msg && (
        <div className={`mb-3 px-3 py-2 rounded text-xs font-medium ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-gray-400 mb-4">Loading…</p>
      ) : (
        <div className="space-y-2 mb-4">
          {values.length === 0 && <p className="text-sm text-gray-400">No custom fields yet.</p>}
          {values.map(v => (
            <div key={v.definition_id} className="flex items-center gap-2">
              <span className="w-40 text-sm text-gray-600 shrink-0 truncate">{v.field_name}</span>
              <span className="flex-1 text-sm text-gray-800">{v.value || <span className="text-gray-300">—</span>}</span>
              <button type="button" onClick={() => handleRemove(v.definition_id)} className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-3 border-t border-gray-100 pt-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Field <span className="text-red-500">*</span></label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            value={selectedDefId} onChange={e => { setSelectedDefId(e.target.value); setNewFieldName(''); }}
          >
            <option value="">-Choose or type new below-</option>
            {availableDefs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {!selectedDefId && (
            <input type="text" placeholder="…or type a new field name" value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              className="w-full mt-2 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
          )}
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
          <input type="text" value={fieldValue} onChange={e => setFieldValue(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
        </div>
        <button type="button" onClick={handleAdd} disabled={saving}
          className="bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-2 rounded transition-colors disabled:opacity-50">
          {saving ? 'ADDING…' : '+ ADD'}
        </button>
      </div>
    </div>
  );
}
