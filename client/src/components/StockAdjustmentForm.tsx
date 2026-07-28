import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { StockAdjustment, StockAdjustmentLine } from '../types/stockAdjustment';
import { createStockAdjustment, updateStockAdjustment, getStockAdjustment } from '../api/stockAdjustments';
import { validatePositive } from '../utils/validators';

interface Warehouse { id: number; name: string; }
interface Product   { id: number; name: string; }
interface Props     { adj: StockAdjustment | null; onClose: () => void; onSaved: () => void; }

interface FieldErrors {
  warehouseId?: string;
  date?: string;
  lines?: string;
}
type LineErrors = Partial<Record<'current_qty' | 'new_qty' | 'unit_cost', string>>;

const emptyLine = (): StockAdjustmentLine => ({ product_id: null, current_qty: 0, new_qty: 0, unit_cost: 0, notes: null });

export default function StockAdjustmentForm({ adj, onClose, onSaved }: Props) {
  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([]);
  const [products,     setProducts]     = useState<Product[]>([]);
  const [warehouseId,  setWarehouseId]  = useState('');
  const [date,         setDate]         = useState(new Date().toISOString().slice(0,10));
  const [reference,    setReference]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [lines,        setLines]        = useState<StockAdjustmentLine[]>([emptyLine()]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [errors,       setErrors]       = useState<FieldErrors>({});
  const [lineErrors,   setLineErrors]   = useState<LineErrors[]>([]);

  useEffect(() => {
    apiFetch('/api/warehouses').then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  useEffect(() => {
    if (!adj) return;
    getStockAdjustment(adj.id).then(full => {
      setWarehouseId(String(full.warehouse_id)); setDate(full.date?.slice(0,10) ?? '');
      setReference(full.reference ?? ''); setNotes(full.notes ?? '');
      setLines(full.lines?.length ? full.lines : [emptyLine()]);
    });
  }, [adj]);

  function updLine(i: number, patch: Partial<StockAdjustmentLine>) {
    setLines(prev => prev.map((l, idx) => idx !== i ? l : { ...l, ...patch }));
    setLineErrors(prev => prev.map((le, idx) => idx !== i ? le : {}));
  }

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!warehouseId) e.warehouseId = 'Warehouse is required.';
    if (!date) e.date = 'Date is required.';

    const selectedLines = lines.filter(l => l.product_id);
    if (selectedLines.length === 0) e.lines = 'At least one adjustment line with a product is required.';

    const le: LineErrors[] = lines.map(l => {
      if (!l.product_id) return {};
      const lineErr: LineErrors = {};
      const curErr = validatePositive(l.current_qty, 'Current qty'); if (curErr) lineErr.current_qty = curErr;
      const newErr = validatePositive(l.new_qty, 'New qty'); if (newErr) lineErr.new_qty = newErr;
      const costErr = validatePositive(l.unit_cost, 'Unit cost'); if (costErr) lineErr.unit_cost = costErr;
      return lineErr;
    });
    if (le.some(x => Object.keys(x).length > 0)) e.lines = e.lines || 'Please fix the errors in the adjustment lines.';

    setErrors(e);
    setLineErrors(le);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { warehouse_id: Number(warehouseId), date, reference: reference || null, notes: notes || null, lines: lines.filter(l => l.product_id) };
      if (adj) await updateStockAdjustment(adj.id, payload);
      else await createStockAdjustment(payload);
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{adj ? 'Edit Stock Adjustment' : 'New Stock Adjustment'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Warehouse *</label>
                <select className={`input ${errors.warehouseId ? 'border-red-500' : ''}`} value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setErrors(prev => ({ ...prev, warehouseId: undefined })); }} required>
                  <option value="">Select warehouse…</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                {errors.warehouseId && <p className="text-xs text-red-500 mt-1">{errors.warehouseId}</p>}
              </div>
              <div><label className="label">Date</label>
                <input type="date" className={`input ${errors.date ? 'border-red-500' : ''}`} value={date} onChange={e => { setDate(e.target.value); setErrors(prev => ({ ...prev, date: undefined })); }} required />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>
              <div><label className="label">Reference</label><input className="input" value={reference} onChange={e => setReference(e.target.value)} /></div>
              <div className="col-span-3"><label className="label">Notes</label><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Adjustment Lines</h3>
                <button type="button" onClick={() => { setLines(prev => [...prev, emptyLine()]); setLineErrors(prev => [...prev, {}]); }} className="text-sm text-indigo-600 hover:underline">+ Add Line</button>
              </div>
              {errors.lines && <p className="text-xs text-red-500 mb-2">{errors.lines}</p>}
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-50">
                  <th className="table-th">Product</th><th className="table-th w-24">Current Qty</th>
                  <th className="table-th w-24">New Qty</th><th className="table-th w-24">Difference</th>
                  <th className="table-th w-24">Unit Cost</th><th className="table-th">Notes</th><th className="table-th w-8"></th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="table-td"><select className="input py-1 text-xs" value={l.product_id ?? ''} onChange={e => updLine(i, { product_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Select…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select></td>
                      <td className="table-td">
                        <input type="number" step="any" className={`input py-1 text-xs text-right ${lineErrors[i]?.current_qty ? 'border-red-500' : ''}`} value={l.current_qty} onChange={e => updLine(i, { current_qty: Number(e.target.value) })} />
                        {lineErrors[i]?.current_qty && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].current_qty}</p>}
                      </td>
                      <td className="table-td">
                        <input type="number" step="any" className={`input py-1 text-xs text-right ${lineErrors[i]?.new_qty ? 'border-red-500' : ''}`} value={l.new_qty} onChange={e => updLine(i, { new_qty: Number(e.target.value) })} />
                        {lineErrors[i]?.new_qty && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].new_qty}</p>}
                      </td>
                      <td className="table-td text-right text-xs">
                        <span className={l.new_qty - l.current_qty > 0 ? 'text-green-600' : l.new_qty - l.current_qty < 0 ? 'text-red-600' : ''}>
                          {l.new_qty - l.current_qty > 0 ? '+' : ''}{(l.new_qty - l.current_qty).toFixed(4)}
                        </span>
                      </td>
                      <td className="table-td">
                        <input type="number" min="0" step="any" className={`input py-1 text-xs text-right ${lineErrors[i]?.unit_cost ? 'border-red-500' : ''}`} value={l.unit_cost} onChange={e => updLine(i, { unit_cost: Number(e.target.value) })} />
                        {lineErrors[i]?.unit_cost && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].unit_cost}</p>}
                      </td>
                      <td className="table-td"><input className="input py-1 text-xs" value={l.notes ?? ''} onChange={e => updLine(i, { notes: e.target.value || null })} /></td>
                      <td className="table-td text-center">{lines.length > 1 && <button type="button" onClick={() => { setLines(prev => prev.filter((_,j) => j !== i)); setLineErrors(prev => prev.filter((_,j) => j !== i)); }} className="text-red-400 hover:text-red-600">&times;</button>}</td>
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

