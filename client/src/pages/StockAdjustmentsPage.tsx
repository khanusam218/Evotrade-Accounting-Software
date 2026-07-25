import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { StockAdjustment, StockAdjustmentLine } from '../types/stockAdjustment';
import {
  getStockAdjustments, getStockAdjustment, createStockAdjustment, updateStockAdjustment,
  confirmStockAdjustment, cancelStockAdjustment, deleteStockAdjustment,
} from '../api/stockAdjustments';
import {
  getAdjustmentTypes, createAdjustmentType, updateAdjustmentType,
} from '../api/adjustmentTypes';
import type { AdjustmentType } from '../api/adjustmentTypes';

interface Product    { id: number; name: string; }
interface COAccount  { id: number; name: string; code: string; }

interface TypeFormState {
  name:        string;
  direction:   'add' | 'subtract';
  account_id:  number | '';
  description: string;
}
const EMPTY_TYPE_FORM: TypeFormState = { name: '', direction: 'add', account_id: '', description: '' };

interface Filters {
  number:      string;
  dateFrom:    string;
  dateTo:      string;
  typeId:      string;
  reference:   string;
  status:      string;
  productId:   string;
  description: string;
  serialNumber:string;
  showVoid:    boolean;
}

interface FormState {
  adjustment_type_id: number | '';
  date: string;
  reference: string;
  notes: string;
}

const EMPTY_FILTERS: Filters = { number: '', dateFrom: '', dateTo: '', typeId: '', reference: '', status: '', productId: '', description: '', serialNumber: '', showVoid: false };
const EMPTY_FORM: FormState  = { adjustment_type_id: '', date: new Date().toISOString().split('T')[0], reference: '', notes: '' };
const emptyLine = (): StockAdjustmentLine => ({ product_id: null, current_qty: 0, new_qty: 0, unit_cost: 0, notes: null });
const PAGE_SIZES = [10, 25, 50, 100];

const SortIcon = () => (
  <svg className="inline-block ml-1 w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

function exportToExcel(rows: StockAdjustment[]) {
  const esc = (v: string | null | undefined) => {
    const s = v ?? '';
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    ['Number', 'Date', 'Warehouse', 'Reference', 'Status'].join(','),
    ...rows.map(r => [esc(r.number), esc(r.date?.slice(0,10)), esc(r.warehouse_name), esc(r.reference), esc(r.status)].join(',')),
  ].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'StockAdjustments.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function printAdjustments(rows: StockAdjustment[]) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Stock Adjustments</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:40px;}
  .hdr{display:flex;justify-content:space-between;margin-bottom:10px;}
  .co{font-size:22px;font-weight:bold;} .ti{font-size:22px;font-weight:bold;}
  hr{border:none;border-top:1.5px solid #000;margin-bottom:18px;}
  table{width:100%;border-collapse:collapse;}
  thead th{text-align:left;font-weight:bold;padding:6px 8px;border-bottom:1.5px solid #000;}
  tbody td{padding:6px 8px;border-bottom:1px solid #ddd;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Stock Adjustments</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Warehouse</th><th>Reference</th><th>Status</th></tr></thead>
<tbody>${rows.map(r=>`<tr><td>${r.number}</td><td>${r.date?.slice(0,10)??''}</td><td>${r.warehouse_name??''}</td><td>${r.reference??''}</td><td>${r.status}</td></tr>`).join('')}</tbody>
</table></body></html>`);
  win.document.close(); win.focus();
  setTimeout(() => win.print(), 400);
}

export default function StockAdjustmentsPage() {
  const [items,    setItems]    = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState<'list' | 'form' | 'type-form'>('list');
  const [editing,    setEditing]    = useState<StockAdjustment | null>(null);

  // Adjustment Types sub-state
  const [adjTypes,      setAdjTypes]      = useState<AdjustmentType[]>([]);
  const [editingType,   setEditingType]   = useState<AdjustmentType | null>(null);
  const [typeForm,      setTypeForm]      = useState<TypeFormState>(EMPTY_TYPE_FORM);
  const [typeSaving,    setTypeSaving]    = useState(false);
  const [typeError,     setTypeError]     = useState('');
  const [accounts,      setAccounts]      = useState<COAccount[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM);
  const [lines,      setLines]      = useState<StockAdjustmentLine[]>([emptyLine()]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  // Quickly Add Products / Scan modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanQuery,     setScanQuery]     = useState('');
  const [scanError,     setScanError]     = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);

  // List state
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(50);
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  async function load() {
    setLoading(true);
    const p: Record<string, string> = {};
    if (appliedFilters.status)   p.status    = appliedFilters.status;
    if (appliedFilters.number)   p.search    = appliedFilters.number;
    if (appliedFilters.dateFrom) p.date_from = appliedFilters.dateFrom;
    if (appliedFilters.dateTo)   p.date_to   = appliedFilters.dateTo;
    try { setItems(await getStockAdjustments(p)); } finally { setLoading(false); }
  }

  useEffect(() => {
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d =>
      setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
    apiFetch('/api/chart-of-accounts').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : []));
    getAdjustmentTypes().then(d => setAdjTypes(d)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [appliedFilters]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setLines([emptyLine()]);
    setError('');
    setView('form');
  }

  async function openEdit(item: StockAdjustment) {
    setEditing(item); setError('');
    try {
      const full = await getStockAdjustment(item.id);
      setForm({ adjustment_type_id: (full as StockAdjustment & { adjustment_type_id?: number }).adjustment_type_id || '', date: full.date?.slice(0,10) || '', reference: full.reference || '', notes: full.notes || '' });
      setLines(full.lines?.length ? full.lines : [emptyLine()]);
    } catch {
      setForm({ adjustment_type_id: '', date: item.date?.slice(0,10) || '', reference: item.reference || '', notes: item.notes || '' });
      setLines([emptyLine()]);
    }
    setView('form');
  }

  function closeForm() { setView('list'); setEditing(null); setError(''); load(); }

  const setF = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  function updLine(i: number, patch: Partial<StockAdjustmentLine>) {
    setLines(prev => prev.map((l, idx) => idx !== i ? l : { ...l, ...patch }));
  }
  function removeLine(i: number) {
    setLines(prev => { const n = prev.filter((_, j) => j !== i); return n.length ? n : [emptyLine()]; });
  }

  function openScanModal() {
    setScanQuery(''); setScanError(''); setShowScanModal(true);
    setTimeout(() => scanInputRef.current?.focus(), 80);
  }

  function handleScanEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = scanQuery.trim().toLowerCase();
    if (!q) return;
    const match = products.find(p => p.name.toLowerCase().includes(q));
    if (!match) { setScanError(`No product found for "${scanQuery}"`); return; }
    setLines(prev => {
      const existing = prev.findIndex(l => l.product_id === match.id);
      if (existing !== -1) {
        return prev.map((l, i) => i === existing ? { ...l, new_qty: (l.new_qty || 0) + 1 } : l);
      }
      const blank = prev.findIndex(l => !l.product_id);
      if (blank !== -1) {
        return prev.map((l, i) => i === blank ? { ...l, product_id: match.id, new_qty: 1 } : l);
      }
      return [...prev, { ...emptyLine(), product_id: match.id, new_qty: 1 }];
    });
    setScanQuery(''); setScanError('');
    scanInputRef.current?.focus();
  }

  async function handleSave(andNew = false) {
    if (!form.adjustment_type_id) { setError('Adjustment Type is required'); return; }
    setError(''); setSaving(true);
    try {
      const payload = {
        adjustment_type_id: Number(form.adjustment_type_id), date: form.date,
        reference: form.reference || null, notes: form.notes || null,
        lines: lines.filter(l => l.product_id),
      };
      if (editing) await updateStockAdjustment(editing.id, payload);
      else         await createStockAdjustment(payload);
      await load();
      if (andNew) { setEditing(null); setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] }); setLines([emptyLine()]); }
      else closeForm();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleConfirm(id: number) {
    try { await confirmStockAdjustment(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }
  async function handleCancel(id: number) {
    if (!confirm('Cancel this adjustment?')) return;
    try { await cancelStockAdjustment(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }
  async function handleDelete(id: number) {
    if (!confirm('Delete this adjustment?')) return;
    try { await deleteStockAdjustment(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  function openAddType(type?: AdjustmentType) {
    setEditingType(type || null);
    setTypeForm(type ? {
      name: type.name, direction: type.direction,
      account_id: type.account_id || '', description: type.description || '',
    } : EMPTY_TYPE_FORM);
    setTypeError(''); setAccountSearch('');
    setView('type-form');
  }

  function closeTypeForm() { setView('list'); setEditingType(null); setTypeError(''); }

  async function handleTypeSave(andNew = false) {
    if (!typeForm.name.trim()) { setTypeError('Name is required'); return; }
    setTypeError(''); setTypeSaving(true);
    try {
      const payload = {
        name: typeForm.name.trim(),
        direction: typeForm.direction,
        account_id: typeForm.account_id !== '' ? Number(typeForm.account_id) : null,
        description: typeForm.description || null,
      };
      if (editingType) await updateAdjustmentType(editingType.id, payload);
      else             await createAdjustmentType(payload);
      const updated = await getAdjustmentTypes();
      setAdjTypes(updated);
      if (andNew) { setEditingType(null); setTypeForm(EMPTY_TYPE_FORM); setAccountSearch(''); }
      else closeTypeForm();
    } catch (err: unknown) { setTypeError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setTypeSaving(false); }
  }

  function applyFilters() { setAppliedFilters({ ...pendingFilters }); setShowFilters(false); setPage(1); }
  function clearFilters()  { setPendingFilters(EMPTY_FILTERS); }
  const hasActiveFilters = Object.values(appliedFilters).some(v => v !== '');

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginated  = items.slice((page - 1) * pageSize, page * pageSize);

  /* ── FORM VIEW ── */
  if (view === 'form') {
    const displayNumber = editing?.number || 'SA-NEW';
    const status        = editing?.status ?? 'draft';
    const netTotal      = lines.reduce((s, l) => s + (l.new_qty || 0) * (l.unit_cost || 0), 0);
    const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white';
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Stock Adjustment - [{displayNumber}]</h2>
            <span className="text-lg font-bold tracking-widest text-gray-700 uppercase">{status}</span>
          </div>

          {error && <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Fields row */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {/* Adjustment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type <span className="text-red-500">*</span></label>
              <select className={inp} value={form.adjustment_type_id} onChange={setF('adjustment_type_id')}>
                <option value="">-Choose-</option>
                {adjTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Number with green buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number <span className="text-red-500">*</span></label>
              <div className="flex">
                <button type="button" className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-l text-xs border-r border-green-700">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 8L10 13l4.5-5H5.5z"/></svg>
                </button>
                <input readOnly className="flex-1 border-t border-b border-gray-300 px-2 py-2 text-sm bg-gray-50 text-gray-600 min-w-0 text-center" value={displayNumber} />
                <button type="button" className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-r text-xs border-l border-green-700">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="date" className="flex-1 px-2 py-2 text-sm focus:outline-none min-w-0" value={form.date} onChange={setF('date')} />
                <button type="button" onClick={() => setForm(f => ({ ...f, date: '' }))} className="px-2 text-gray-400 hover:text-gray-700">✕</button>
                <span className="px-2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </span>
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input type="text" className={inp} placeholder="Reference" value={form.reference} onChange={setF('reference')} />
            </div>
          </div>

          {/* QUICKLY ADD PRODUCTS / SCAN button */}
          <div className="flex justify-end mb-3">
            <button type="button" onClick={openScanModal}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0zm-12 0a.5.5 0 11-1 0 .5.5 0 011 0z"/>
              </svg>
              QUICKLY ADD PRODUCTS / SCAN
            </button>
          </div>

          {/* Quickly Add Products / Scan Modal */}
          {showScanModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">Quickly Add Products / Scan</h3>
                  <button onClick={() => setShowScanModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm text-gray-600 mb-3">Enter SKU, barcode, product code or name to search.</p>
                  <input
                    ref={scanInputRef}
                    type="text"
                    className="w-full border-2 border-green-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                    value={scanQuery}
                    onChange={e => { setScanQuery(e.target.value); setScanError(''); }}
                    onKeyDown={handleScanEnter}
                    autoFocus
                  />
                  {scanError ? (
                    <p className="mt-2 text-sm text-red-500">{scanError}</p>
                  ) : (
                    <div className="mt-3 space-y-1">
                      <p className="text-sm text-blue-500">Please scan barcode.</p>
                      <p className="text-sm text-blue-500">Please type product SKU, product code or product name and press enter.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lines table */}
          <div className="border border-gray-200 rounded mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Product</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 w-32">Quantity</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 w-32">Cost</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 w-36">Net Amount</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const netAmt = (l.new_qty || 0) * (l.unit_cost || 0);
                  return (
                    <tr key={i} className="border-b border-gray-100 bg-gray-50/30">
                      <td className="px-4 py-2">
                        <select className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                          value={l.product_id ?? ''} onChange={e => updLine(i, { product_id: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">Type to search product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 w-32">
                        <input type="number" step="any" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                          value={l.new_qty} onChange={e => updLine(i, { new_qty: Number(e.target.value) })} />
                      </td>
                      <td className="px-4 py-2 w-32">
                        <input type="number" min="0" step="any" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                          value={l.unit_cost} onChange={e => updLine(i, { unit_cost: Number(e.target.value) })} />
                      </td>
                      <td className="px-4 py-2 w-36 text-right text-sm text-gray-700 font-medium">
                        {netAmt.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center w-20">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" className="text-green-600 hover:text-green-800">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                          </button>
                          <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Attachments + Net Total row */}
          <div className="grid grid-cols-2 gap-6 mb-4">
            {/* Attachments */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Attachments</label>
              <div className="border-2 border-dashed border-gray-300 rounded p-6 flex items-center gap-4">
                <span className="text-sm text-gray-400 flex-1">Drop files here or</span>
                <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                  BROWSE FILES
                </button>
              </div>
            </div>

            {/* Net Total */}
            <div className="flex items-end justify-end">
              <div className="w-full max-w-xs">
                <div className="flex items-center justify-between border-t border-gray-300 pt-3">
                  <span className="text-sm font-medium text-gray-700">Net (PKR)</span>
                  <span className="text-sm font-semibold text-gray-800">{netTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="mb-6">
            <textarea rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-y"
              placeholder="Comments" value={form.notes} onChange={setF('notes')} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
            <div className="flex items-center">
              <button type="button" onClick={() => handleSave(false)} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-l disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                {saving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              <button type="button" onClick={() => handleSave(true)} disabled={saving}
                className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-r border-l border-green-500 disabled:opacity-50">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
            <button type="button" onClick={closeForm}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              CLOSE
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── ADJUSTMENT TYPE FORM VIEW ── */
  if (view === 'type-form') {
    const filteredAccounts = accountSearch.trim()
      ? accounts.filter(a =>
          a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
          a.code.toLowerCase().includes(accountSearch.toLowerCase())
        )
      : accounts;

    const selectedAccount = accounts.find(a => a.id === Number(typeForm.account_id));

    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">
              Adjustment Types - {editingType ? `Edit [${editingType.name}]` : 'Add []'}
            </h2>
          </div>

          {typeError && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{typeError}</div>
          )}

          {/* Fields row: Name | Account | Inventory */}
          <div className="flex items-start gap-6 mb-5">
            {/* Name */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Name"
                value={typeForm.name}
                onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Account (searchable) */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                  placeholder="Type to search account"
                  value={accountSearch || (selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : '')}
                  onChange={e => { setAccountSearch(e.target.value); setTypeForm(f => ({ ...f, account_id: '' })); }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                  </svg>
                </span>
                {accountSearch.trim() && filteredAccounts.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto mt-0.5">
                    {filteredAccounts.slice(0, 50).map(a => (
                      <button
                        key={a.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                        onClick={() => { setTypeForm(f => ({ ...f, account_id: a.id })); setAccountSearch(''); }}>
                        <span className="font-mono text-xs text-gray-400 mr-2">{a.code}</span>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Inventory radio */}
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Inventory</label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${typeForm.direction === 'add' ? 'border-green-500' : 'border-gray-300'}`}>
                    {typeForm.direction === 'add' && <span className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                  </span>
                  <input type="radio" className="hidden" value="add" checked={typeForm.direction === 'add'} onChange={() => setTypeForm(f => ({ ...f, direction: 'add' }))} />
                  <span className="text-sm text-gray-700">Add</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${typeForm.direction === 'subtract' ? 'border-green-500' : 'border-gray-300'}`}>
                    {typeForm.direction === 'subtract' && <span className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                  </span>
                  <input type="radio" className="hidden" value="subtract" checked={typeForm.direction === 'subtract'} onChange={() => setTypeForm(f => ({ ...f, direction: 'subtract' }))} />
                  <span className="text-sm text-gray-700">Subtract</span>
                </label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
              placeholder="Description"
              value={typeForm.description}
              onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
            <div className="flex items-center">
              <button onClick={() => handleTypeSave(false)} disabled={typeSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-l disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                {typeSaving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              <button onClick={() => handleTypeSave(true)} disabled={typeSaving}
                className="px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-r border-l border-gray-500 disabled:opacity-50">
                ▼
              </button>
            </div>
            <button onClick={closeTypeForm}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              CLOSE
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-gray-900">Stock Adjustments</h1>
          <div className="flex items-center gap-2">
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              ADD STOCK ADJUSTMENT
            </button>
            <button onClick={() => openAddType()}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              ADD ADJUSTMENT TYPE
            </button>
          </div>
        </div>

        {/* Toolbar: FILTERS | PRINT + EXPORT */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => { setPendingFilters({ ...appliedFilters }); setShowFilters(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
            FILTERS{hasActiveFilters ? ' ●' : ''}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => printAdjustments(items)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              PRINT
            </button>
            <button onClick={() => exportToExcel(items)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              EXPORT TO EXCEL
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : (
          <>
            <table className="w-full text-sm border-t border-gray-200">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Number <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Date <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Adjustment Type <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Reference <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Status <SortIcon /></th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-orange-500 text-sm">No record found</td></tr>
                ) : paginated.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline text-sm font-medium">{item.number}</button>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{item.date?.slice(0,10)}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{item.adjustment_type_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-500">{item.reference}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold uppercase ${
                        item.status === 'confirmed' ? 'text-green-600' :
                        item.status === 'cancelled' ? 'text-red-500'   : 'text-gray-500'
                      }`}>{item.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'draft' && (
                          <>
                            <button onClick={() => handleConfirm(item.id)} className="text-xs text-green-600 hover:underline">Confirm</button>
                            <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 inline-flex">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </>
                        )}
                        {item.status === 'confirmed' && (
                          <button onClick={() => handleCancel(item.id)} className="text-xs text-red-500 hover:underline">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${p === page ? 'bg-green-500 text-white border border-green-500' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm">›</button>
              </div>
              <select className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-600 focus:outline-none"
                value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* FILTERS Modal — matches Splendid Stock Adjustments exactly */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white rounded-lg border-2 border-green-400 shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm flex items-center justify-center font-bold shadow z-10">×</button>
            <div className="px-6 py-5 space-y-3">

              {/* Number */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Number</span>
                <input type="text" placeholder="Type to search number"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.number} onChange={e => setPendingFilters(f => ({ ...f, number: e.target.value }))} />
              </div>

              {/* Date */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Date</span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-500 whitespace-nowrap">From:</span>
                  <div className="relative flex-1">
                    <input type="date"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                      value={pendingFilters.dateFrom} onChange={e => setPendingFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap">To:</span>
                  <div className="relative flex-1">
                    <input type="date"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                      value={pendingFilters.dateTo} onChange={e => setPendingFilters(f => ({ ...f, dateTo: e.target.value }))} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Type */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Type</span>
                <div className="relative flex-1">
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-8"
                    value={pendingFilters.typeId} onChange={e => setPendingFilters(f => ({ ...f, typeId: e.target.value }))}>
                    <option value="">Select type</option>
                    {adjTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </span>
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Reference</span>
                <input type="text" placeholder="Type to search reference"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.reference} onChange={e => setPendingFilters(f => ({ ...f, reference: e.target.value }))} />
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Status</span>
                <div className="relative flex-1">
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-8"
                    value={pendingFilters.status} onChange={e => setPendingFilters(f => ({ ...f, status: e.target.value }))}>
                    <option value="">Select status</option>
                    <option value="draft">Draft</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </span>
                </div>
              </div>

              {/* Product */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Product</span>
                <div className="relative flex-1">
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-8"
                    value={pendingFilters.productId} onChange={e => setPendingFilters(f => ({ ...f, productId: e.target.value }))}>
                    <option value="">Type to search product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Description</span>
                <input type="text" placeholder="Type to search description"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.description} onChange={e => setPendingFilters(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Serial Number */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Serial Number</span>
                <input type="text" placeholder="Type to search serial number"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.serialNumber} onChange={e => setPendingFilters(f => ({ ...f, serialNumber: e.target.value }))} />
              </div>

              {/* Show Void */}
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="sa-show-void" className="w-4 h-4 rounded border-gray-300 text-green-600"
                  checked={pendingFilters.showVoid} onChange={e => setPendingFilters(f => ({ ...f, showVoid: e.target.checked }))} />
                <label htmlFor="sa-show-void" className="text-sm text-gray-700 cursor-pointer">Show Void</label>
              </div>
            </div>

            {/* Footer: SAVE FILTER | APPLY | CLEAR */}
            <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={applyFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-500 text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                APPLY
              </button>
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

