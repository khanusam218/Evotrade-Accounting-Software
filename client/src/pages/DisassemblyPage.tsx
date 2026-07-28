import { apiFetch } from '../api/apiFetch';
import { useCallback, useEffect, useState } from 'react';
import {
  getDisassemblyOrders, createDisassemblyOrder, updateDisassemblyOrder,
  completeDisassemblyOrder, cancelDisassemblyOrder, deleteDisassemblyOrder,
} from '../api/disassemblyOrders';
import { DisassemblyOrder, DisassemblyLine } from '../types/disassemblyOrder';
import { validatePositive } from '../utils/validators';

interface Warehouse { id: number; name: string; }
interface Product   { id: number; name: string; }

const SortIcon = () => (
  <svg className="inline-block w-3 h-3 ml-1 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

const STATUS_COLOR: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-700',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', completed: 'Completed', cancelled: 'Cancelled',
};

interface Filters {
  number: string;
  dateFrom: string;
  dateTo: string;
  reference: string;
  productName: string;
  status: string;
}
const EMPTY_FILTERS: Filters = { number: '', dateFrom: '', dateTo: '', reference: '', productName: '', status: '' };

const EMPTY_LINE: Partial<DisassemblyLine> = { product_id: 0, batch: '', quantity: 0, cost: 0 };

/* ─── Print / Export ─────────────────────────────────────────────────────── */
function printDisassemblings(rows: DisassemblyOrder[]) {
  const win = window.open('', '_blank', 'width=1000,height=680'); if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Disassemblings</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Disassemblings</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Reference</th><th>Assembly Product</th><th class="r">Quantity</th><th>Status</th></tr></thead><tbody>
${rows.map(r => `<tr><td>${r.number}</td><td>${r.date?.slice(0,10)??''}</td><td>${r.reference??''}</td><td>${r.product_name??''}</td><td class="r">${r.quantity}</td><td>${STATUS_LABEL[r.status]??r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
}

function exportDisassemblingsToExcel(rows: DisassemblyOrder[]) {
  const esc = (v: string|number|null|undefined) => { const s = String(v??''); return s.includes(',')||s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = [
    ['Number','Date','Reference','Assembly Product','Quantity','Status'].join(','),
    ...rows.map(r => [esc(r.number), r.date?.slice(0,10)??'', esc(r.reference), esc(r.product_name), r.quantity, esc(STATUS_LABEL[r.status]??r.status)].join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = 'Disassemblings.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

type LineErrors = Partial<Record<'quantity' | 'cost', string>>;

/* ─── Lines table (reusable for Input & Output) ──────────────────────────── */
function LinesTable({
  lines, setLines, products, showCostInput, lineErrors, setLineErrors,
}: {
  lines: Partial<DisassemblyLine>[];
  setLines: (fn: (prev: Partial<DisassemblyLine>[]) => Partial<DisassemblyLine>[]) => void;
  products: Product[];
  showCostInput: boolean;  /* false = Input section (Batch+Cost read-only), true = Output */
  lineErrors: LineErrors[];
  setLineErrors: (fn: (prev: LineErrors[]) => LineErrors[]) => void;
}) {
  const setLine = (i: number, k: keyof DisassemblyLine, v: any) => {
    setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
    setLineErrors(prev => prev.map((le, j) => j === i ? {} : le));
  };

  const amount = (l: Partial<DisassemblyLine>) =>
    Number(l.quantity || 0) * Number(l.cost || 0);

  /* Splendid: Input table has gray (read-only) Batch + Cost cells; Output has editable Cost */
  const TH = 'border border-gray-300 px-3 py-2 font-bold text-sm text-gray-800 bg-white';

  return (
    <div className="overflow-hidden rounded border border-gray-300">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className={`${TH} text-left w-[36%]`}>Product</th>
            <th className={`${TH} text-left w-[14%]`}>Batch</th>
            <th className={`${TH} text-right w-[12%]`}>Quantity</th>
            <th className={`${TH} text-right w-[12%]`}>Cost</th>
            <th className={`${TH} text-right w-[13%]`}>Amount</th>
            <th className={`${TH} text-right w-[13%]`}>Action</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              {/* Product — white, always editable */}
              <td className="border border-gray-300 px-2 py-1.5 bg-white">
                <select
                  className="w-full bg-white text-sm text-gray-700 focus:outline-none"
                  value={l.product_id || ''}
                  onChange={e => setLine(i, 'product_id', Number(e.target.value))}>
                  <option value="">Type to search product</option>
                  {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>

              {/* Batch — gray/read-only in Input, editable in Output */}
              <td className={`border border-gray-300 px-2 py-1.5 ${!showCostInput ? 'bg-gray-100' : 'bg-white'}`}>
                {showCostInput ? (
                  <input
                    className="w-full bg-transparent text-sm text-gray-700 focus:outline-none"
                    value={l.batch || ''}
                    onChange={e => setLine(i, 'batch', e.target.value)} />
                ) : (
                  <span className="block text-sm text-gray-400">{l.batch || ''}</span>
                )}
              </td>

              {/* Quantity — always editable, white */}
              <td className="border border-gray-300 px-1 py-1.5 bg-white">
                <input
                  type="number"
                  className={`w-full border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 ${lineErrors[i]?.quantity ? 'border-red-500' : 'border-gray-300'}`}
                  value={l.quantity ?? 0}
                  onChange={e => setLine(i, 'quantity', Number(e.target.value))} />
                {lineErrors[i]?.quantity && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].quantity}</p>}
              </td>

              {/* Cost — gray/read-only in Input; editable in Output */}
              <td className={`border border-gray-300 px-2 py-1.5 ${!showCostInput ? 'bg-gray-100' : 'bg-white'}`}>
                {showCostInput ? (
                  <>
                    <input
                      type="number"
                      className={`w-full border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 ${lineErrors[i]?.cost ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Cost"
                      value={l.cost ?? 0}
                      onChange={e => setLine(i, 'cost', Number(e.target.value))} />
                    {lineErrors[i]?.cost && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].cost}</p>}
                  </>
                ) : (
                  <span className="block text-right text-sm text-gray-500 pr-1">
                    {Number(l.cost || 0).toFixed(2)}
                  </span>
                )}
              </td>

              {/* Amount — always read-only */}
              <td className="border border-gray-300 px-3 py-1.5 bg-white text-right text-sm text-gray-700">
                {amount(l).toFixed(2)}
              </td>

              {/* Action — ✓ × */}
              <td className="border border-gray-300 px-3 py-1.5 bg-white">
                <div className="flex items-center justify-end gap-3">
                  <button type="button" title="Confirm" className="text-gray-400 hover:text-green-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button type="button" title="Remove"
                    onClick={() => { setLines(ls => ls.filter((_, j) => j !== i)); setLineErrors(prev => prev.filter((_, j) => j !== i)); }}
                    className="text-gray-400 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Slide-over Form ────────────────────────────────────────────────────── */
function DSForm({ onSave, onClose, initial, warehouses, products }: any) {
  const [form, setForm] = useState({
    product_id:       initial?.product_id        || '',
    warehouse_id:     initial?.warehouse_id       || '',
    date:             initial?.date?.slice(0, 10) || new Date().toISOString().split('T')[0],
    quantity:         initial?.quantity           || 0,
    reference:        initial?.reference          || '',
    notes:            initial?.notes              || '',
    account_expenses: initial?.account_expenses   || false,
  });

  const [inputLines, setInputLines] = useState<Partial<DisassemblyLine>[]>(
    initial?.input_lines?.length ? initial.input_lines : [{ ...EMPTY_LINE }]
  );
  const [outputLines, setOutputLines] = useState<Partial<DisassemblyLine>[]>(
    initial?.lines?.length ? initial.lines : [{ ...EMPTY_LINE }]
  );
  const [inputLineErrors, setInputLineErrors]   = useState<LineErrors[]>([]);
  const [outputLineErrors, setOutputLineErrors] = useState<LineErrors[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ product_id?: string; warehouse_id?: string; date?: string; quantity?: string; input_lines?: string; output_lines?: string }>({});

  const status = initial?.status || 'draft';

  function validate(): boolean {
    const e: typeof fieldErrors = {};
    if (!form.product_id) e.product_id = 'Product to disassemble is required.';
    if (!form.warehouse_id) e.warehouse_id = 'Warehouse is required.';
    if (!form.date) e.date = 'Date is required.';
    const qtyErr = validatePositive(Number(form.quantity), 'Quantity to disassemble'); if (qtyErr) e.quantity = qtyErr;

    const validInputs = inputLines.filter(l => l.product_id);
    if (validInputs.length === 0) e.input_lines = 'At least one input line with a product is required.';
    const ile: LineErrors[] = inputLines.map(l => {
      if (!l.product_id) return {};
      const le: LineErrors = {};
      const qErr = validatePositive(Number(l.quantity || 0), 'Quantity'); if (qErr) le.quantity = qErr;
      return le;
    });
    if (ile.some(x => Object.keys(x).length > 0)) e.input_lines = e.input_lines || 'Please fix the errors in the input lines.';

    const validOutputs = outputLines.filter(l => l.product_id);
    if (validOutputs.length === 0) e.output_lines = 'At least one output line with a product is required.';
    const ole: LineErrors[] = outputLines.map(l => {
      if (!l.product_id) return {};
      const le: LineErrors = {};
      const qErr = validatePositive(Number(l.quantity || 0), 'Quantity'); if (qErr) le.quantity = qErr;
      const cErr = validatePositive(Number(l.cost || 0), 'Cost'); if (cErr) le.cost = cErr;
      return le;
    });
    if (ole.some(x => Object.keys(x).length > 0)) e.output_lines = e.output_lines || 'Please fix the errors in the output lines.';

    setFieldErrors(e);
    setInputLineErrors(ile);
    setOutputLineErrors(ole);
    return Object.keys(e).length === 0;
  }

  const submit = async () => {
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        product_id:   Number(form.product_id),
        warehouse_id: Number(form.warehouse_id) || null,
        input_lines:  inputLines,
        lines:        outputLines,
      });
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* ── Header ── matching Splendid: title left, DRAFT (large) + × right */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-bold text-gray-900">
            Disassemblings{initial?.number ? ` - [${initial.number}]` : ''}
          </h2>
          <div className="flex items-center gap-5">
            <span className="text-3xl font-bold tracking-widest text-gray-400 uppercase select-none">
              {STATUS_LABEL[status] ?? status}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-light">
              ×
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── Top fields row ── Splendid: [Product | Number] [Date] [Qty] [Ref] */}
          <div className="px-6 pt-5 pb-5 border-b border-gray-100">
            <div className="flex gap-4 items-end">

              {/* Product To Disassemble */}
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Product To Disassemble <span className="text-red-500">*</span>
                </label>
                <select
                  className={`w-full border-2 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-red-400 ${fieldErrors.product_id ? 'border-red-600' : 'border-red-400'}`}
                  value={form.product_id}
                  onChange={e => { setForm(f => ({ ...f, product_id: e.target.value })); setFieldErrors(prev => ({ ...prev, product_id: undefined })); }}>
                  <option value="">Type to search as</option>
                  {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {fieldErrors.product_id && <p className="text-xs text-red-500 mt-1">{fieldErrors.product_id}</p>}
              </div>

              {/* Number — green + button | input | green ↺ button */}
              <div className="flex-[1.5]">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Number <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1">
                  <button type="button"
                    className="flex items-center gap-0.5 px-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-bold shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <input
                    type="text"
                    readOnly
                    className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-gray-700 focus:outline-none"
                    value={initial?.number || '(auto)'}
                    placeholder="DS-000001" />
                  <button type="button"
                    className="px-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Date */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${fieldErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                  value={form.date}
                  onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setFieldErrors(prev => ({ ...prev, date: undefined })); }} />
                {fieldErrors.date && <p className="text-xs text-red-500 mt-1">{fieldErrors.date}</p>}
              </div>

              {/* Quantity to disassemble */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1 leading-tight">
                  Quantity to<br />disassemble
                </label>
                <input
                  type="number"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${fieldErrors.quantity ? 'border-red-500' : 'border-gray-300'}`}
                  value={form.quantity}
                  onChange={e => { setForm(f => ({ ...f, quantity: Number(e.target.value) })); setFieldErrors(prev => ({ ...prev, quantity: undefined })); }} />
                {fieldErrors.quantity && <p className="text-xs text-red-500 mt-1">{fieldErrors.quantity}</p>}
              </div>

              {/* Reference */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Reference"
                  value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* ── Input section ── */}
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">Input</h3>
              <button
                type="button"
                onClick={() => { setInputLines(ls => [...ls, { ...EMPTY_LINE }]); setInputLineErrors(prev => [...prev, {}]); }}
                className="text-sm font-medium text-blue-600 hover:text-blue-800">
                + Add
              </button>
            </div>
            {fieldErrors.input_lines && <p className="text-xs text-red-500 mb-2">{fieldErrors.input_lines}</p>}
            <LinesTable lines={inputLines} setLines={setInputLines} products={products} showCostInput={false} lineErrors={inputLineErrors} setLineErrors={setInputLineErrors} />
          </div>

          {/* ── Account Expenses ── */}
          <div className="px-6 pb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="acc_exp"
              className="w-4 h-4 border-gray-300 rounded text-blue-600"
              checked={form.account_expenses}
              onChange={e => setForm(f => ({ ...f, account_expenses: e.target.checked }))} />
            <label htmlFor="acc_exp" className="text-sm text-gray-700 cursor-pointer select-none">
              Account Expenses (Optional)
            </label>
          </div>

          {/* ── Output section ── */}
          <div className="px-6 pt-4 pb-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">Output</h3>
              <button
                type="button"
                onClick={() => { setOutputLines(ls => [...ls, { ...EMPTY_LINE }]); setOutputLineErrors(prev => [...prev, {}]); }}
                className="text-sm font-medium text-blue-600 hover:text-blue-800">
                + Add
              </button>
            </div>
            {fieldErrors.output_lines && <p className="text-xs text-red-500 mb-2">{fieldErrors.output_lines}</p>}
            <LinesTable lines={outputLines} setLines={setOutputLines} products={products} showCostInput={true} lineErrors={outputLineErrors} setLineErrors={setOutputLineErrors} />
          </div>

          {/* ── Warehouse / Notes ── */}
          <div className="px-6 pb-6 pt-4 grid grid-cols-2 gap-4 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 ${fieldErrors.warehouse_id ? 'border-red-500' : 'border-gray-300'}`}
                value={form.warehouse_id}
                onChange={e => { setForm(f => ({ ...f, warehouse_id: e.target.value })); setFieldErrors(prev => ({ ...prev, warehouse_id: undefined })); }}>
                <option value="">Select...</option>
                {warehouses.map((w: Warehouse) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {fieldErrors.warehouse_id && <p className="text-xs text-red-500 mt-1">{fieldErrors.warehouse_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-white">
          <button
            onClick={submit}
            disabled={saving}
            className="px-7 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-7 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function DisassemblyPage() {
  const [orders, setOrders]         = useState<DisassemblyOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [pendingFilters, setPendingFilters]   = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters]   = useState<Filters>(EMPTY_FILTERS);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<DisassemblyOrder | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string> = {};
      if (appliedFilters.number)   params.search    = appliedFilters.number;
      if (appliedFilters.status)   params.status    = appliedFilters.status;
      if (appliedFilters.dateFrom) params.date_from = appliedFilters.dateFrom;
      if (appliedFilters.dateTo)   params.date_to   = appliedFilters.dateTo;
      const data = await getDisassemblyOrders(Object.keys(params).length ? params : undefined);
      setOrders(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [appliedFilters]);

  useEffect(() => {
    fetchOrders();
    apiFetch('/api/warehouses').then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const visibleOrders = orders.filter(o => {
    if (appliedFilters.reference   && !(o.reference  ?? '').toLowerCase().includes(appliedFilters.reference.toLowerCase())) return false;
    if (appliedFilters.productName && !(o.product_name ?? '').toLowerCase().includes(appliedFilters.productName.toLowerCase())) return false;
    return true;
  });

  const hasActiveFilters = Object.values(appliedFilters).some(v => v !== '');

  function openFilters()  { setPendingFilters(appliedFilters); setShowFilterModal(true); }
  function applyFilters() { setAppliedFilters(pendingFilters); setShowFilterModal(false); }
  function clearPending() { setPendingFilters(EMPTY_FILTERS); }

  const save = async (data: any) => {
    if (editing) await updateDisassemblyOrder(editing.id, data);
    else await createDisassemblyOrder(data);
    fetchOrders();
  };

  const doAction = async (id: number, fn: () => Promise<any>) => {
    setActionId(id);
    try { await fn(); fetchOrders(); } catch (e: any) { setError(e.message); }
    finally { setActionId(null); }
  };

  if (showForm) return (
        <DSForm
      onSave={save}
      onClose={() => { setShowForm(false); setEditing(null); }}
      initial={editing}
      warehouses={warehouses}
      products={products}
    />
  );

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Disassemblings</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          ADD DISASSEMBLING
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 pb-4">
        <button
          onClick={openFilters}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white ${
            hasActiveFilters ? 'bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
          }`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2" />
          </svg>
          FILTERS
          {hasActiveFilters && (
            <span className="bg-white text-blue-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {Object.values(appliedFilters).filter(v => v !== '').length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => printDisassemblings(visibleOrders)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button
            onClick={() => exportDisassemblingsToExcel(visibleOrders)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-3 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Number <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Date <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Reference <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Assembly Product <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Quantity <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-orange-500">No record found</td>
                </tr>
              ) : (
                visibleOrders.map(o => (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{o.number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{o.date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{o.reference ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{o.product_name}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{o.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[o.status]}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {o.status === 'draft' && (
                          <>
                            <button
                              onClick={() => { setEditing(o); setShowForm(true); }}
                              title="Edit"
                              className="text-gray-400 hover:text-blue-600">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => doAction(o.id, () => completeDisassemblyOrder(o.id))}
                              disabled={actionId === o.id}
                              title="Complete"
                              className="text-gray-400 hover:text-green-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => doAction(o.id, () => cancelDisassemblyOrder(o.id))}
                              disabled={actionId === o.id}
                              title="Cancel"
                              className="text-gray-400 hover:text-orange-500 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { if (window.confirm(`Delete "${o.number}"?`)) doAction(o.id, () => deleteDisassemblyOrder(o.id)); }}
                              disabled={actionId === o.id}
                              title="Delete"
                              className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                        {o.status === 'completed' && <span className="text-xs text-green-500 font-medium">Completed</span>}
                        {o.status === 'cancelled'  && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Filters Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white rounded-lg border-2 border-green-400 shadow-2xl w-full max-w-lg mx-4">
            <button
              onClick={() => setShowFilterModal(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm font-bold z-10">
              ×
            </button>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Number</label>
                <input type="text" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Type to search number" value={pendingFilters.number} onChange={e => setPendingFilters(f => ({ ...f, number: e.target.value }))} />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" value={pendingFilters.dateFrom} onChange={e => setPendingFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" value={pendingFilters.dateTo} onChange={e => setPendingFilters(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Reference</label>
                <input type="text" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Type to search reference" value={pendingFilters.reference} onChange={e => setPendingFilters(f => ({ ...f, reference: e.target.value }))} />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Assembly Product</label>
                <input type="text" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Type to search product" value={pendingFilters.productName} onChange={e => setPendingFilters(f => ({ ...f, productName: e.target.value }))} />
              </div>

              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Status</label>
                <div className="flex-1 relative">
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none bg-white pr-8" value={pendingFilters.status} onChange={e => setPendingFilters(f => ({ ...f, status: e.target.value }))}>
                    <option value="">Select status</option>
                    <option value="draft">Draft</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-6 pb-5">
              <button onClick={applyFilters} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" /></svg>
                APPLY
              </button>
              <button onClick={clearPending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


