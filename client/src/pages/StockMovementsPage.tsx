import { apiFetch } from '../api/apiFetch';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getStockMovements, createStockMovement, updateStockMovement,
  completeStockMovement, cancelStockMovement, deleteStockMovement,
} from '../api/stockMovements';
import { StockMovement } from '../types/stockMovement';
import { validatePositive } from '../utils/validators';

interface WHouse { id: number; name: string; }
interface Prod   { id: number; name: string; }

interface LineState {
  product_id: number | '';
  quantity:   number | '';
  notes:      string;
}

interface FormState {
  from_warehouse_id: number | '';
  to_warehouse_id:   number | '';
  date:              string;
  reference:         string;
  comments:          string;
}

const EMPTY_FORM: FormState = {
  from_warehouse_id: '',
  to_warehouse_id:   '',
  date:              new Date().toISOString().split('T')[0],
  reference:         '',
  comments:          '',
};

const EMPTY_LINE: LineState = { product_id: '', quantity: 0, notes: '' };
const PAGE_SIZES = [10, 25, 50, 100];

interface FieldErrors {
  from_warehouse_id?: string;
  to_warehouse_id?: string;
  date?: string;
  lines?: string;
}
type LineErrors = Partial<Record<'quantity', string>>;

const SortIcon = () => (
  <svg className="inline-block ml-1 w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

export default function StockMovementsPage() {
  const [movements,   setMovements]   = useState<StockMovement[]>([]);
  const [warehouses,  setWarehouses]  = useState<WHouse[]>([]);
  const [products,    setProducts]    = useState<Prod[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState<'list' | 'form'>('list');
  const [editing,     setEditing]     = useState<StockMovement | null>(null);
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [lines,       setLines]       = useState<LineState[]>([{ ...EMPTY_LINE }]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [errors,      setErrors]      = useState<FieldErrors>({});
  const [lineErrors,  setLineErrors]  = useState<LineErrors[]>([]);
  const [attachments,   setAttachments]   = useState<File[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanQuery,     setScanQuery]     = useState('');
  const [scanError,     setScanError]     = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // List state
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(50);
  const [showFilters,    setShowFilters]    = useState(false);
  const [showMore,       setShowMore]       = useState(false);

  // Pending filter fields (Splendid layout)
  const [pNumber,        setPNumber]        = useState('');
  const [pDateFrom,      setPDateFrom]      = useState('');
  const [pDateTo,        setPDateTo]        = useState('');
  const [pReference,     setPReference]     = useState('');
  const [pFromWarehouse, setPFromWarehouse] = useState('');
  const [pToWarehouse,   setPToWarehouse]   = useState('');
  const [pStatus,        setPStatus]        = useState('');
  const [pProduct,       setPProduct]       = useState('');
  const [pDescription,   setPDescription]   = useState('');
  const [pSerialNumber,  setPSerialNumber]  = useState('');
  const [pShowVoid,      setPShowVoid]      = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      setMovements(await getStockMovements(params));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    apiFetch('/api/warehouses').then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d =>
      setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
  }, []);

  useEffect(() => { if (view === 'list') load(); }, [search, statusFilter]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setLines([{ ...EMPTY_LINE }]);
    setAttachments([]);
    setError('');
    setErrors({});
    setLineErrors([]);
    setView('form');
  }

  function openEdit(m: StockMovement) {
    setEditing(m);
    setForm({
      from_warehouse_id: m.from_warehouse_id || '',
      to_warehouse_id:   m.to_warehouse_id   || '',
      date:              m.date?.slice(0, 10) || new Date().toISOString().split('T')[0],
      reference:         m.reference || '',
      comments:          m.notes     || '',
    });
    const existingLines: LineState[] = (m.lines || []).map(l => ({
      product_id: l.product_id,
      quantity:   l.quantity,
      notes:      l.notes || '',
    }));
    setLines(existingLines.length ? existingLines : [{ ...EMPTY_LINE }]);
    setAttachments([]);
    setError('');
    setErrors({});
    setLineErrors([]);
    setView('form');
  }

  function closeForm() { setView('list'); setEditing(null); setError(''); setErrors({}); load(); }

  const setF = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }));
      if (key === 'from_warehouse_id' || key === 'to_warehouse_id' || key === 'date') {
        setErrors(prev => ({ ...prev, [key]: undefined }));
      }
    };

  function setLine(i: number, key: keyof LineState, value: string | number) {
    setLines(ls => ls.map((l, j) => j === i ? { ...l, [key]: value } : l));
    setLineErrors(prev => prev.map((le, j) => j === i ? {} : le));
  }

  function confirmLine(i: number) {
    setLines(ls => {
      if (i === ls.length - 1) return [...ls, { ...EMPTY_LINE }];
      return ls;
    });
  }

  function removeLine(i: number) {
    setLines(ls => {
      const next = ls.filter((_, j) => j !== i);
      return next.length ? next : [{ ...EMPTY_LINE }];
    });
  }

  function openScanModal() {
    setScanQuery('');
    setScanError('');
    setShowScanModal(true);
    setTimeout(() => scanInputRef.current?.focus(), 80);
  }

  function handleScanEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = scanQuery.trim().toLowerCase();
    if (!q) return;
    const match = products.find(p =>
      p.name.toLowerCase().includes(q)
    );
    if (!match) {
      setScanError(`No product found for "${scanQuery}"`);
      return;
    }
    setLines(ls => {
      const existing = ls.findIndex(l => l.product_id === match.id);
      if (existing !== -1) {
        return ls.map((l, i) => i === existing ? { ...l, quantity: Number(l.quantity || 0) + 1 } : l);
      }
      const blank = ls.findIndex(l => l.product_id === '');
      if (blank !== -1) {
        return ls.map((l, i) => i === blank ? { ...l, product_id: match.id, quantity: 1 } : l);
      }
      return [...ls, { product_id: match.id, quantity: 1, notes: '' }];
    });
    setScanQuery('');
    setScanError('');
    scanInputRef.current?.focus();
  }

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!form.from_warehouse_id) e.from_warehouse_id = 'From Warehouse is required.';
    if (!form.to_warehouse_id)   e.to_warehouse_id   = 'To Warehouse is required.';
    if (!form.date)              e.date              = 'Date is required.';

    const validLines = lines.filter(l => l.product_id !== '' && Number(l.quantity) > 0);
    if (validLines.length === 0) e.lines = 'At least one product line with a positive quantity is required.';

    const le: LineErrors[] = lines.map(l => {
      if (l.product_id === '') return {};
      const lineErr: LineErrors = {};
      const qErr = validatePositive(Number(l.quantity), 'Quantity'); if (qErr) lineErr.quantity = qErr;
      return lineErr;
    });
    if (le.some(x => Object.keys(x).length > 0)) e.lines = e.lines || 'Please fix the errors in the product lines.';

    setErrors(e);
    setLineErrors(le);
    return Object.keys(e).length === 0;
  }

  async function handleSave(andNew = false) {
    if (!validate()) return;
    setError(''); setSaving(true);
    try {
      const payload = {
        from_warehouse_id: Number(form.from_warehouse_id),
        to_warehouse_id:   Number(form.to_warehouse_id),
        date:              form.date,
        reference:         form.reference || null,
        notes:             form.comments  || null,
        lines: lines
          .filter(l => l.product_id !== '' && Number(l.quantity) > 0)
          .map(l => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), notes: l.notes || null })),
      };
      if (editing) await updateStockMovement(editing.id, payload);
      else         await createStockMovement(payload);
      await load();
      if (andNew) {
        setEditing(null);
        setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
        setLines([{ ...EMPTY_LINE }]);
        setAttachments([]);
      } else {
        closeForm();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleComplete(id: number) {
    try { await completeStockMovement(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleCancel(id: number) {
    if (!confirm('Cancel this stock movement?')) return;
    try { await cancelStockMovement(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this stock movement?')) return;
    try { await deleteStockMovement(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  const filtered = useMemo(() => {
    let rows = movements;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(m =>
        (m.number || '').toLowerCase().includes(q) ||
        (m.from_warehouse_name || '').toLowerCase().includes(q) ||
        (m.to_warehouse_name   || '').toLowerCase().includes(q) ||
        (m.reference           || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) rows = rows.filter(m => m.status === statusFilter);
    return rows;
  }, [movements, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* ── FORM VIEW ── */
  if (view === 'form') {
    const displayNumber = editing?.number || 'SM-NEW';
    const status        = editing?.status ?? 'draft';

    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">
              Stock Movement - [{displayNumber}]
            </h2>
            <span className="text-lg font-bold tracking-widest text-gray-700 uppercase">{status}</span>
          </div>

          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Fields row: From Warehouse | To Warehouse | Number | Date | Reference */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${errors.from_warehouse_id ? 'border-red-500' : 'border-gray-300'}`}
                value={form.from_warehouse_id}
                onChange={setF('from_warehouse_id')}>
                <option value="">-Choose-</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {errors.from_warehouse_id && <p className="text-xs text-red-500 mt-1">{errors.from_warehouse_id}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${errors.to_warehouse_id ? 'border-red-500' : 'border-gray-300'}`}
                value={form.to_warehouse_id}
                onChange={setF('to_warehouse_id')}>
                <option value="">-Choose-</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {errors.to_warehouse_id && <p className="text-xs text-red-500 mt-1">{errors.to_warehouse_id}</p>}
            </div>

            {/* Number with green dropdown + refresh buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <button className="px-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-l text-xs border-r border-green-600">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.5 8L10 13l4.5-5H5.5z" />
                  </svg>
                </button>
                <input
                  type="text"
                  readOnly
                  className="flex-1 border-t border-b border-gray-300 px-2 py-2 text-sm bg-gray-50 text-gray-600 min-w-0 text-center"
                  value={displayNumber}
                />
                <button className="px-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-r text-xs border-l border-green-600">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Date with × clear button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className={`flex items-center border rounded overflow-hidden ${errors.date ? 'border-red-500' : 'border-gray-300'}`}>
                <input
                  type="date"
                  className="flex-1 px-2 py-2 text-sm focus:outline-none min-w-0"
                  value={form.date}
                  onChange={setF('date')}
                />
                <button
                  onClick={() => { setForm(f => ({ ...f, date: '' })); }}
                  className="px-2 text-gray-400 hover:text-gray-700 text-base leading-none">
                  ✕
                </button>
                <span className="px-2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Reference"
                value={form.reference}
                onChange={setF('reference')}
              />
            </div>
          </div>

          {/* QUICKLY ADD PRODUCTS / SCAN */}
          <div className="flex justify-end mb-4">
            <button
              onClick={openScanModal}
              className="flex items-center gap-2 px-5 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              QUICKLY ADD PRODUCTS / SCAN
            </button>
          </div>

          {/* Products / Lines table */}
          {errors.lines && <p className="text-xs text-red-500 mb-2">{errors.lines}</p>}
          <div className="border border-gray-200 rounded mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Product</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 w-36">Quantity</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-100 bg-gray-50/40">
                    <td className="px-4 py-2">
                      <select
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        value={line.product_id}
                        onChange={e => setLine(i, 'product_id', e.target.value === '' ? '' : Number(e.target.value))}>
                        <option value="">Type to search product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 w-36">
                      <input
                        type="number"
                        min={0}
                        className={`w-full border rounded px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 ${lineErrors[i]?.quantity ? 'border-red-500' : 'border-gray-300'}`}
                        value={line.quantity}
                        onChange={e => setLine(i, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                      {lineErrors[i]?.quantity && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].quantity}</p>}
                    </td>
                    <td className="px-4 py-2 w-24 text-right">
                      <button
                        onClick={() => confirmLine(i)}
                        title="Confirm line"
                        className="text-gray-400 hover:text-green-600 text-xl mr-3 font-bold leading-none">
                        ✓
                      </button>
                      <button
                        onClick={() => removeLine(i)}
                        title="Remove line"
                        className="text-gray-400 hover:text-red-600 text-xl font-bold leading-none">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attachments + Comments */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h3>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-3 min-h-[120px] bg-white hover:border-blue-400 transition-colors cursor-pointer"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  setAttachments(a => [...a, ...Array.from(e.dataTransfer.files)]);
                }}
                onClick={() => fileInputRef.current?.click()}>
                <span className="text-sm text-gray-500">Drop files here or</span>
                <button
                  type="button"
                  onClick={ev => { ev.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded">
                  BROWSE FILES
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => setAttachments(a => [...a, ...Array.from(e.target.files || [])])}
                />
              </div>
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                      <span>{f.name}</span>
                      <button onClick={() => setAttachments(a => a.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 ml-2">×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Comments</label>
              <textarea
                rows={5}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                placeholder="Comments"
                value={form.comments}
                onChange={setF('comments')}
              />
            </div>
          </div>

          {/* Quickly Add Products / Scan Modal */}
          {showScanModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">Quickly Add Products / Scan</h3>
                  <button
                    onClick={() => setShowScanModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                    ×
                  </button>
                </div>
                {/* Modal body */}
                <div className="px-6 py-5">
                  <p className="text-sm text-gray-600 mb-3">
                    Enter SKU, barcode, product code or name to search.
                  </p>
                  <input
                    ref={scanInputRef}
                    type="text"
                    className="w-full border-2 border-green-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                    placeholder=""
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
            <div className="flex items-center">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-l disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-r border-l border-green-500 disabled:opacity-50">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
            <button
              onClick={closeForm}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              CLOSE
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters = !!(search || statusFilter || pNumber || pDateFrom || pDateTo || pReference || pFromWarehouse || pToWarehouse || pProduct || pDescription || pSerialNumber);

  function openFiltersModal() {
    // sync pending from applied
    setPNumber(''); setPDateFrom(''); setPDateTo(''); setPReference('');
    setPFromWarehouse(''); setPToWarehouse(''); setPStatus(statusFilter);
    setPProduct(''); setPDescription(''); setPSerialNumber(''); setPShowVoid(false);
    setShowFilters(true);
  }
  function applyFilters() {
    setSearch(pNumber || pReference || pDescription || pSerialNumber);
    setStatusFilter(pStatus);
    setPage(1);
    setShowFilters(false);
  }
  function clearFilters() {
    setPNumber(''); setPDateFrom(''); setPDateTo(''); setPReference('');
    setPFromWarehouse(''); setPToWarehouse(''); setPStatus('');
    setPProduct(''); setPDescription(''); setPSerialNumber(''); setPShowVoid(false);
  }

  function printMovements(rows: StockMovement[]) {
    const win = window.open('', '_blank', 'width=900,height=650');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Stock Movements</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:40px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:10px;}.co{font-size:22px;font-weight:bold;}.ti{font-size:22px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:18px;}table{width:100%;border-collapse:collapse;}
thead th{text-align:left;font-weight:bold;padding:6px 8px;border-bottom:1.5px solid #000;}
tbody td{padding:6px 8px;border-bottom:1px solid #ddd;}</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Stock Movements</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Reference</th><th>From Warehouse</th><th>To Warehouse</th><th>Status</th></tr></thead>
<tbody>${rows.map(r=>`<tr><td>${r.number}</td><td>${r.date?.slice(0,10)??''}</td><td>${r.reference??''}</td><td>${r.from_warehouse_name??''}</td><td>${r.to_warehouse_name??''}</td><td>${r.status}</td></tr>`).join('')}</tbody>
</table></body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
  }

  function exportMovements(rows: StockMovement[]) {
    const esc = (v: string | null | undefined) => { const s = v ?? ''; return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv = [['Number','Date','Reference','From Warehouse','To Warehouse','Status'].join(','),
      ...rows.map(r => [esc(r.number),esc(r.date?.slice(0,10)),esc(r.reference),esc(r.from_warehouse_name),esc(r.to_warehouse_name),esc(r.status)].join(','))
    ].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'StockMovements.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  /* ── LIST VIEW ── */
  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-gray-900">Stock Movements</h1>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            ADD STOCK MOVEMENT
          </button>
        </div>

        {/* Toolbar: FILTERS | PRINT + EXPORT */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={openFiltersModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
            FILTERS{hasActiveFilters ? ' ●' : ''}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => printMovements(filtered)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
              </svg>
              PRINT
            </button>
            <button onClick={() => exportMovements(filtered)}
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
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-t border-gray-200 min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Number <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Date <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Reference <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">From Warehouse <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">To Warehouse <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Status <SortIcon /></th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-orange-500 text-sm">No record found</td>
                  </tr>
                ) : paginated.map(m => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <button onClick={() => openEdit(m)} className="text-green-600 hover:underline text-sm font-medium">{m.number}</button>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{m.date?.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-sm text-gray-500">{m.reference}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{m.from_warehouse_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{m.to_warehouse_name}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold uppercase ${
                        m.status === 'completed' ? 'text-green-600' :
                        m.status === 'cancelled' ? 'text-red-500'   : 'text-gray-500'
                      }`}>{m.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {m.status === 'draft' && (
                          <>
                            <button onClick={() => handleComplete(m.id)} className="text-xs text-green-600 hover:underline">Complete</button>
                            <button onClick={() => handleCancel(m.id)} className="text-xs text-red-500 hover:underline">Cancel</button>
                            <button onClick={() => handleDelete(m.id)} className="text-gray-400 hover:text-red-600 inline-flex items-center justify-center">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${p === page ? 'bg-green-600 text-white border border-green-600' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
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

      {/* FILTERS Modal — matches Splendid exactly */}
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
                  value={pNumber} onChange={e => setPNumber(e.target.value)} />
              </div>

              {/* Date */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Date</span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-500 whitespace-nowrap">From:</span>
                  <div className="relative flex-1">
                    <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                      value={pDateFrom} onChange={e => setPDateFrom(e.target.value)} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap">To:</span>
                  <div className="relative flex-1">
                    <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                      value={pDateTo} onChange={e => setPDateTo(e.target.value)} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Reference</span>
                <input type="text" placeholder="Type to search reference"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pReference} onChange={e => setPReference(e.target.value)} />
              </div>

              {/* From Warehouse */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">From Warehouse</span>
                <div className="relative flex-1">
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-8"
                    value={pFromWarehouse} onChange={e => setPFromWarehouse(e.target.value)}>
                    <option value="">Type to search from warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </span>
                </div>
              </div>

              {/* To Warehouse */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">To Warehouse</span>
                <div className="relative flex-1">
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-8"
                    value={pToWarehouse} onChange={e => setPToWarehouse(e.target.value)}>
                    <option value="">Type to search to warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Status</span>
                <div className="relative flex-1">
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-8"
                    value={pStatus} onChange={e => setPStatus(e.target.value)}>
                    <option value="">Select status</option>
                    <option value="draft">Draft</option>
                    <option value="completed">Completed</option>
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
                    value={pProduct} onChange={e => setPProduct(e.target.value)}>
                    <option value="">Type to search product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </span>
                </div>
              </div>

              {/* Show more fields */}
              {showMore && (
                <>
                  {/* Description */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Description</span>
                    <input type="text" placeholder="Type to search description"
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={pDescription} onChange={e => setPDescription(e.target.value)} />
                  </div>
                  {/* Serial Number */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">Serial Number</span>
                    <input type="text" placeholder="Type to search serial number"
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={pSerialNumber} onChange={e => setPSerialNumber(e.target.value)} />
                  </div>
                </>
              )}

              {/* Show Void + SHOW MORE/LESS */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-green-600"
                    checked={pShowVoid} onChange={e => setPShowVoid(e.target.checked)} />
                  <span className="text-sm text-gray-700">Show Void</span>
                </label>
                <button type="button" onClick={() => setShowMore(v => !v)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    {showMore
                      ? <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/>
                      : <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                    }
                  </svg>
                  {showMore ? 'SHOW LESS' : 'SHOW MORE'}
                </button>
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

