import { useEffect, useState } from 'react';
import { apiFetch } from '../api/apiFetch';
import { getCounters, createCounter, updateCounter, deleteCounter } from '../api/pos';
import type { POSCounter } from '../types/pos';

interface Warehouse    { id: number; name: string; }
interface Account      { id: number; name: string; }
interface NumberSeries { id: number; name: string; prefix: string; }

interface FormState {
  name: string;
  warehouse_id: string;
  cash_account_id: string;
  is_active: boolean;
  pos_invoice_series_id: string;
  sale_return_series_id: string;
  sale_order_series_id: string;
  pos_search_sale_order: boolean;
  pos_search_product: boolean;
  primary_search: string;
}

const emptyForm = (): FormState => ({
  name: '', warehouse_id: '', cash_account_id: '',
  is_active: true, pos_invoice_series_id: '', sale_return_series_id: '',
  sale_order_series_id: '',
  pos_search_sale_order: false, pos_search_product: true, primary_search: 'product',
});

function fromCounter(c: POSCounter): FormState {
  return {
    name:                  c.name,
    warehouse_id:          c.warehouse_id          ? String(c.warehouse_id)          : '',
    cash_account_id:       c.cash_account_id       ? String(c.cash_account_id)       : '',
    is_active:             c.is_active,
    pos_invoice_series_id: c.pos_invoice_series_id ? String(c.pos_invoice_series_id) : '',
    sale_return_series_id: c.sale_return_series_id ? String(c.sale_return_series_id) : '',
    sale_order_series_id:  c.sale_order_series_id  ? String(c.sale_order_series_id)  : '',
    pos_search_sale_order: c.pos_search_sale_order,
    pos_search_product:    c.pos_search_product,
    primary_search:        c.primary_search,
  };
}

function toPayload(f: FormState) {
  return {
    name:                  f.name.trim(),
    warehouse_id:          f.warehouse_id          ? Number(f.warehouse_id)          : null,
    cash_account_id:       f.cash_account_id       ? Number(f.cash_account_id)       : null,
    is_active:             f.is_active,
    pos_invoice_series_id: f.pos_invoice_series_id ? Number(f.pos_invoice_series_id) : null,
    sale_return_series_id: f.sale_return_series_id ? Number(f.sale_return_series_id) : null,
    sale_order_series_id:  f.sale_order_series_id  ? Number(f.sale_order_series_id)  : null,
    pos_search_sale_order: f.pos_search_sale_order,
    pos_search_product:    f.pos_search_product,
    primary_search:        f.primary_search,
  };
}

interface DetailProps {
  initial: POSCounter | null;
  warehouses: Warehouse[];
  accounts: Account[];
  numberSeries: NumberSeries[];
  onSave: (data: ReturnType<typeof toPayload>, mode: 'new' | 'close') => Promise<void>;
  onClose: () => void;
}

function CounterDetail({ initial, warehouses, accounts, numberSeries, onSave, onClose }: DetailProps) {
  const isEdit = initial !== null;
  const [form,    setForm]    = useState<FormState>(initial ? fromCounter(initial) : emptyForm());
  const [tab,     setTab]     = useState<'basic' | 'checkout'>('basic');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [showDrop, setShowDrop] = useState(false);

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  async function doSave(mode: 'new' | 'close') {
    if (!form.name.trim()) { setError('Checkout Counter Name is required'); return; }
    setSaving(true); setError('');
    try {
      await onSave(toPayload(form), mode);
      if (mode === 'new') { setForm(emptyForm()); setTab('basic'); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500';
  const selectCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Title */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">
          Checkout Counter - {isEdit ? `Edit [${initial.name}]` : 'Add []'}
        </h2>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="counter-tab" checked={tab === 'basic'}
            onChange={() => setTab('basic')}
            className="h-4 w-4 accent-green-600" />
          <span className={`text-sm font-medium ${tab === 'basic' ? 'text-green-700' : 'text-gray-600'}`}>Basic</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="counter-tab" checked={tab === 'checkout'}
            onChange={() => setTab('checkout')}
            className="h-4 w-4 accent-green-600" />
          <span className={`text-sm font-medium ${tab === 'checkout' ? 'text-green-700' : 'text-gray-600'}`}>Checkout</span>
        </label>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        {tab === 'basic' && (
          <div className="space-y-5">

            {/* Row 1: Name | Warehouse | Cash Account */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Checkout Counter Name <span className="text-red-500">*</span>
                </label>
                <input className={`${inputCls} ${!form.name && error ? 'border-red-400' : ''}`}
                  placeholder="" value={form.name}
                  onChange={e => set({ name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select className={`${selectCls} ${!form.warehouse_id && error ? 'border-red-400' : ''}`}
                  value={form.warehouse_id} onChange={e => set({ warehouse_id: e.target.value })}>
                  <option value="">-Choose-</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Account <span className="text-red-500">*</span>
                </label>
                <select className={`${selectCls} ${!form.cash_account_id && error ? 'border-red-400' : ''}`}
                  value={form.cash_account_id} onChange={e => set({ cash_account_id: e.target.value })}>
                  <option value="">-Choose-</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: POS Invoice Series | Sale Return Series */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">POS Invoice Series</label>
                <div className="flex gap-2">
                  <select className={selectCls} value={form.pos_invoice_series_id}
                    onChange={e => set({ pos_invoice_series_id: e.target.value })}>
                    <option value="">-Choose-</option>
                    {numberSeries.map(s => <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>)}
                  </select>
                  <button type="button"
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded whitespace-nowrap">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Return Series</label>
                <div className="flex gap-2">
                  <select className={selectCls} value={form.sale_return_series_id}
                    onChange={e => set({ sale_return_series_id: e.target.value })}>
                    <option value="">-Choose-</option>
                    {numberSeries.map(s => <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>)}
                  </select>
                  <button type="button"
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded whitespace-nowrap">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: POS Search | Primary Search */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">POS Search</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.pos_search_sale_order}
                      onChange={e => set({ pos_search_sale_order: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 accent-green-600" />
                    <span className="text-sm text-gray-700">Sale Order</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.pos_search_product}
                      onChange={e => set({ pos_search_product: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 accent-green-600" />
                    <span className="text-sm text-gray-700">Product</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Search</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="primary-search" value="order"
                      checked={form.primary_search === 'order'}
                      onChange={() => set({ primary_search: 'order' })}
                      className="h-4 w-4 accent-green-600" />
                    <span className="text-sm text-gray-700">Sale Order</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="primary-search" value="product"
                      checked={form.primary_search === 'product'}
                      onChange={() => set({ primary_search: 'product' })}
                      className="h-4 w-4 accent-green-600" />
                    <span className="text-sm text-gray-700">Product</span>
                  </label>
                </div>
              </div>
            </div>

          </div>
        )}

        {tab === 'checkout' && (
          <div className="space-y-5">
            {/* Row: Checkout Counter Name | Warehouse | Sale Order Series */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Checkout Counter Name <span className="text-red-500">*</span>
                </label>
                <input className={`${inputCls} ${!form.name && error ? 'border-red-400' : ''}`}
                  placeholder="Checkout Counter Name"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select className={`${selectCls} ${!form.warehouse_id && error ? 'border-red-400' : ''}`}
                  value={form.warehouse_id} onChange={e => set({ warehouse_id: e.target.value })}>
                  <option value="">-Choose-</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Order Series <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select className={`${selectCls} ${!form.sale_order_series_id && error ? 'border-red-400' : ''}`}
                    value={form.sale_order_series_id}
                    onChange={e => set({ sale_order_series_id: e.target.value })}>
                    <option value="">-Choose-</option>
                    {numberSeries.map(s => <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>)}
                  </select>
                  <button type="button"
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded whitespace-nowrap">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
        <div className="relative flex">
          <button type="button" disabled={saving}
            onClick={() => doSave('new')}
            className="flex items-center gap-2 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-semibold px-4 py-2 rounded-l disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            SAVE AND NEW
          </button>
          <button type="button"
            onClick={() => setShowDrop(s => !s)}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-2 py-2 rounded-r border-l border-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showDrop && (
            <div className="absolute bottom-full right-0 mb-1 w-44 bg-white border border-gray-200 rounded shadow-lg z-10">
              <button type="button" onClick={() => { setShowDrop(false); doSave('close'); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Save and Close
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          CLOSE
        </button>
      </div>
    </div>
  );
}

export default function POSCountersPage() {
  const [counters,     setCounters]     = useState<POSCounter[]>([]);
  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([]);
  const [accounts,     setAccounts]     = useState<Account[]>([]);
  const [numberSeries, setNumberSeries] = useState<NumberSeries[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [view,         setView]         = useState<'list' | 'detail'>('list');
  const [editing,      setEditing]      = useState<POSCounter | null>(null);
  const [search,       setSearch]       = useState('');

  const loadCounters = async () => {
    setLoading(true); setError('');
    try { setCounters(await getCounters()); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadCounters();
    apiFetch('/api/warehouses').then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : (d?.data ?? [])));
    apiFetch('/api/chart-of-accounts/lookup').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : (d?.data ?? [])));
    apiFetch('/api/number-series').then(r => r.json()).then(d => setNumberSeries(Array.isArray(d) ? d : (d?.data ?? [])));
  }, []);

  const openNew  = () => { setEditing(null); setView('detail'); };
  const openEdit = (c: POSCounter) => { setEditing(c); setView('detail'); };
  const closeDetail = () => { setView('list'); setEditing(null); };

  const save = async (data: Parameters<typeof createCounter>[0], mode: 'new' | 'close') => {
    if (editing) await updateCounter(editing.id, data);
    else         await createCounter(data);
    await loadCounters();
    if (mode === 'close') closeDetail();
    else setEditing(null);
  };

  const del = async (c: POSCounter) => {
    if (!confirm(`Delete counter "${c.name}"?`)) return;
    try { await deleteCounter(c.id); await loadCounters(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  if (view === 'detail') {
    return (
      <CounterDetail
        initial={editing}
        warehouses={warehouses}
        accounts={accounts}
        numberSeries={numberSeries}
        onSave={save}
        onClose={closeDetail}
      />
    );
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filtered = counters.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cash_account_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.warehouse_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  function printList() {
    const w = window.open('', '_blank')!;
    const rows = filtered.map(c => `<tr><td>${c.name}</td><td>${c.cash_account_name ?? '—'}</td><td>${c.warehouse_name ?? '—'}</td><td>${c.is_active ? 'Active' : 'Inactive'}</td></tr>`).join('');
    w.document.write(`<html><head><title>Checkout Counters</title><style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5}</style></head><body><h2>Checkout Counters</h2><table><thead><tr><th>Name</th><th>Cash Account Name</th><th>Warehouse Name</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close(); w.print();
  }

  function exportCsv() {
    const rows = [
      ['Name', 'Cash Account Name', 'Warehouse Name', 'Status'],
      ...filtered.map(c => [c.name, c.cash_account_name ?? '', c.warehouse_name ?? '', c.is_active ? 'Active' : 'Inactive']),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'checkout-counters.csv'; a.click();
  }

  // suppress unused warning
  void fmt;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-4 py-4">
        {error && <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-800">Checkout Counters</h1>
            <button onClick={openNew}
              className="flex items-center gap-1.5 rounded bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-semibold text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              ADD CHECKOUT COUNTER
            </button>
          </div>

          {/* Image + Search row */}
          <div className="flex items-center gap-6 mb-5">
            {/* POS machine illustration */}
            <div className="flex-shrink-0 w-36 h-28 flex items-center justify-center">
              <svg viewBox="0 0 140 110" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Screen */}
                <rect x="10" y="5" width="90" height="60" rx="4" fill="#1e293b" />
                <rect x="14" y="9" width="82" height="52" rx="2" fill="#0f172a" />
                <rect x="16" y="11" width="78" height="48" rx="1" fill="#1d4ed8" opacity="0.8" />
                {/* Screen content */}
                <rect x="20" y="16" width="30" height="4" rx="1" fill="white" opacity="0.6" />
                <rect x="20" y="24" width="50" height="3" rx="1" fill="white" opacity="0.3" />
                <rect x="20" y="30" width="45" height="3" rx="1" fill="white" opacity="0.3" />
                <rect x="20" y="36" width="40" height="3" rx="1" fill="white" opacity="0.3" />
                <rect x="60" y="42" width="28" height="12" rx="2" fill="#16a34a" />
                <rect x="62" y="45" width="24" height="6" rx="1" fill="#22c55e" opacity="0.5" />
                {/* Stand */}
                <rect x="45" y="65" width="20" height="8" rx="1" fill="#334155" />
                <rect x="35" y="73" width="40" height="5" rx="2" fill="#475569" />
                {/* Printer/base */}
                <rect x="5" y="78" width="100" height="28" rx="4" fill="#334155" />
                <rect x="10" y="83" width="90" height="4" rx="1" fill="#475569" />
                <rect x="30" y="90" width="50" height="3" rx="1" fill="#1e293b" />
                <rect x="15" y="88" width="12" height="8" rx="1" fill="#1e293b" />
                <rect x="83" y="88" width="12" height="8" rx="1" fill="#1e293b" />
                {/* Paper */}
                <rect x="45" y="75" width="20" height="6" rx="0" fill="white" opacity="0.9" />
              </svg>
            </div>

            {/* Search + buttons */}
            <div className="flex-1 flex items-end gap-3">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder=""
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button onClick={printList}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                PRINT
              </button>
              <button onClick={exportCsv}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                EXPORT TO EXCEL
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <table className="w-full text-sm border-t border-gray-200">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Name <span className="text-gray-400">↕</span></span>
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Cash Account Name <span className="text-gray-400">↕</span></span>
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1">Warehouse Name <span className="text-gray-400">↕</span></span>
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-sm text-amber-500">No record found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                    <td className="px-3 py-2 text-gray-600">{c.cash_account_name ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.warehouse_name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline mr-3">Edit</button>
                      <button onClick={() => del(c)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
