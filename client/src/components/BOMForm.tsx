import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { BillOfMaterials, BomComponent } from '../types/billOfMaterials';
import { createBOM, updateBOM, getBOM } from '../api/billsOfMaterials';
import { validateName, validatePositive } from '../utils/validators';

interface Product { id: number; name: string; }
interface Props   { bom: BillOfMaterials | null; onClose: () => void; onSaved: () => void; }

interface FieldErrors {
  productId?: string;
  name?: string;
  outputQty?: string;
  components?: string;
}
type CompErrors = Partial<Record<'quantity', string>>;

const emptyComp = (): BomComponent => ({ component_product_id: null, quantity: 1, notes: null });

export default function BOMForm({ bom, onClose, onSaved }: Props) {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [productId,  setProductId]  = useState('');
  const [name,       setName]       = useState('');
  const [outputQty,  setOutputQty]  = useState(1);
  const [notes,      setNotes]      = useState('');
  const [isActive,   setIsActive]   = useState(true);
  const [components, setComponents] = useState<BomComponent[]>([emptyComp()]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [errors,     setErrors]     = useState<FieldErrors>({});
  const [compErrors, setCompErrors] = useState<CompErrors[]>([]);

  useEffect(() => { apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))); }, []);

  useEffect(() => {
    if (!bom) return;
    getBOM(bom.id).then(full => {
      setProductId(String(full.product_id)); setName(full.name); setOutputQty(full.output_qty);
      setNotes(full.notes ?? ''); setIsActive(full.is_active);
      setComponents(full.components?.length ? full.components : [emptyComp()]);
    });
  }, [bom]);

  function updComp(i: number, patch: Partial<BomComponent>) {
    setComponents(prev => prev.map((c, idx) => idx !== i ? c : { ...c, ...patch }));
    setCompErrors(prev => prev.map((ce, idx) => idx !== i ? ce : {}));
  }

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!productId) e.productId = 'Output product is required.';
    const nameErr = validateName(name, 'BOM name'); if (nameErr) e.name = nameErr;
    const qtyErr = validatePositive(outputQty, 'Output quantity'); if (qtyErr) e.outputQty = qtyErr;

    const selectedComps = components.filter(c => c.component_product_id);
    if (selectedComps.length === 0) e.components = 'At least one component is required.';

    const ce: CompErrors[] = components.map(c => {
      if (!c.component_product_id) return {};
      const compErr: CompErrors = {};
      const qErr = validatePositive(c.quantity, 'Quantity'); if (qErr) compErr.quantity = qErr;
      return compErr;
    });
    if (ce.some(x => Object.keys(x).length > 0)) e.components = e.components || 'Please fix the errors in the components.';

    setErrors(e);
    setCompErrors(ce);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { product_id: Number(productId), name, output_qty: outputQty, notes: notes || null, is_active: isActive, components: components.filter(c => c.component_product_id) };
      if (bom) await updateBOM(bom.id, payload);
      else await createBOM(payload);
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{bom ? 'Edit Bill of Materials' : 'New Bill of Materials'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Output Product *</label>
                <select className={`input ${errors.productId ? 'border-red-500' : ''}`} value={productId} onChange={e => { setProductId(e.target.value); setErrors(prev => ({ ...prev, productId: undefined })); }} required>
                  <option value="">Select product…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.productId && <p className="text-xs text-red-500 mt-1">{errors.productId}</p>}
              </div>
              <div><label className="label">BOM Name *</label>
                <input className={`input ${errors.name ? 'border-red-500' : ''}`} value={name} onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })); }} required />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div><label className="label">Output Quantity</label>
                <input type="number" min="0.0001" step="any" className={`input ${errors.outputQty ? 'border-red-500' : ''}`} value={outputQty} onChange={e => { setOutputQty(Number(e.target.value)); setErrors(prev => ({ ...prev, outputQty: undefined })); }} />
                {errors.outputQty && <p className="text-xs text-red-500 mt-1">{errors.outputQty}</p>}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2 mt-5">
                  <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
                </div>
              </div>
              <div className="col-span-2"><label className="label">Notes</label><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Components</h3>
                <button type="button" onClick={() => { setComponents(prev => [...prev, emptyComp()]); setCompErrors(prev => [...prev, {}]); }} className="text-sm text-indigo-600 hover:underline">+ Add Component</button>
              </div>
              {errors.components && <p className="text-xs text-red-500 mb-2">{errors.components}</p>}
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-50">
                  <th className="table-th">Component Product</th>
                  <th className="table-th w-28">Quantity</th>
                  <th className="table-th">Notes</th>
                  <th className="table-th w-8"></th>
                </tr></thead>
                <tbody>
                  {components.map((c, i) => (
                    <tr key={i} className="border-b">
                      <td className="table-td"><select className="input py-1 text-xs" value={c.component_product_id ?? ''} onChange={e => updComp(i, { component_product_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Select…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select></td>
                      <td className="table-td">
                        <input type="number" min="0.0001" step="any" className={`input py-1 text-xs text-right ${compErrors[i]?.quantity ? 'border-red-500' : ''}`} value={c.quantity} onChange={e => updComp(i, { quantity: Number(e.target.value) })} />
                        {compErrors[i]?.quantity && <p className="text-xs text-red-500 mt-0.5">{compErrors[i].quantity}</p>}
                      </td>
                      <td className="table-td"><input className="input py-1 text-xs" value={c.notes ?? ''} onChange={e => updComp(i, { notes: e.target.value || null })} /></td>
                      <td className="table-td text-center">{components.length > 1 && <button type="button" onClick={() => { setComponents(prev => prev.filter((_,j) => j !== i)); setCompErrors(prev => prev.filter((_,j) => j !== i)); }} className="text-red-400 hover:text-red-600">&times;</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t px-6 py-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

