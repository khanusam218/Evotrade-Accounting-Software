import { apiFetch } from '../api/apiFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import SalesOrderForm from '../components/SalesOrderForm';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import {
  getSalesOrders, confirmSalesOrder, shipSalesOrder, deliverSalesOrder, cancelSalesOrder, deleteSalesOrder,
} from '../api/salesOrders';
import type { SalesOrder } from '../types/salesOrder';
import { SO_STATUS_COLORS, SO_STATUS_LABELS } from '../types/salesOrder';

type SortDir = 'asc' | 'desc' | null;
type SortKey = keyof SalesOrder | '';

interface SortThProps {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}

function SortTh({ label, sortKey, current, dir, onSort, className = '' }: SortThProps) {
  const active = current === sortKey;
  return (
    <th className={`text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${className}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-400 text-xs">{active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↕'}</span>
      </span>
    </th>
  );
}

interface FilterState {
  number: string; dateFrom: string; dateTo: string; reference: string;
  customerId: string; deliveryDateFrom: string; deliveryDateTo: string;
  grossAmountFrom: string; grossAmountTo: string;
  netAmountFrom: string; netAmountTo: string;
  status: string; showDeclined: boolean;
}
const emptyFilter = (): FilterState => ({
  number: '', dateFrom: '', dateTo: '', reference: '', customerId: '',
  deliveryDateFrom: '', deliveryDateTo: '',
  grossAmountFrom: '', grossAmountTo: '',
  netAmountFrom: '', netAmountTo: '',
  status: '', showDeclined: false,
});

interface Customer { id: number; print_name: string; }

export default function SalesOrdersPage() {
  const [records,      setRecords]      = useState<SalesOrder[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [draft,        setDraft]        = useState<FilterState>(emptyFilter());
  const [applied,      setApplied]      = useState<FilterState>(emptyFilter());
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [showForm,     setShowForm]     = useState(false);
  const [editEntry,    setEditEntry]    = useState<SalesOrder | null>(null);
  const [actionId,     setActionId]     = useState<number | null>(null);
  const [showInvoiceForm,  setShowInvoiceForm]  = useState(false);
  const [invoiceFrom,      setInvoiceFrom]      = useState<SalesOrder | null>(null);
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [sortKey,      setSortKey]      = useState<SortKey>('date');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const [showActions,  setShowActions]  = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  const fetchRecords = useCallback(async (f: FilterState) => {
    setLoading(true); setError(null);
    try {
      const p: Record<string, string | undefined> = {};
      if (f.number)     p.search      = f.number;
      if (f.status)     p.status      = f.status;
      if (f.dateFrom)   p.date_from   = f.dateFrom;
      if (f.dateTo)     p.date_to     = f.dateTo;
      if (f.customerId) p.customer_id = f.customerId;
      let data = await getSalesOrders(p);
      if (f.reference)        data = data.filter(r => (r.reference ?? '').toLowerCase().includes(f.reference.toLowerCase()));
      if (f.deliveryDateFrom) data = data.filter(r => (r.delivery_date ?? '') >= f.deliveryDateFrom);
      if (f.deliveryDateTo)   data = data.filter(r => (r.delivery_date ?? '') <= f.deliveryDateTo);
      if (f.grossAmountFrom)  data = data.filter(r => Number(r.gross_amount) >= Number(f.grossAmountFrom));
      if (f.grossAmountTo)    data = data.filter(r => Number(r.gross_amount) <= Number(f.grossAmountTo));
      if (f.netAmountFrom)    data = data.filter(r => Number(r.net_amount) >= Number(f.netAmountFrom));
      if (f.netAmountTo)      data = data.filter(r => Number(r.net_amount) <= Number(f.netAmountTo));
      if (!f.showDeclined)    data = data.filter(r => r.status !== 'cancelled');
      setRecords(data);
      setSelected(new Set());
    } catch (err: unknown) {
      setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(applied); }, [fetchRecords, applied]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = [...records].sort((a, b) => {
    if (!sortDir || !sortKey) return 0;
    const av = a[sortKey as keyof SalesOrder] ?? '';
    const bv = b[sortKey as keyof SalesOrder] ?? '';
    return (sortDir === 'asc' ? 1 : -1) * String(av).localeCompare(String(bv), undefined, { numeric: true });
  });

  const allSelected = sorted.length > 0 && sorted.every(r => selected.has(r.id));
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(sorted.map(r => r.id))); }
  function toggleRow(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function act(id: number, fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionId(id);
    try { await fn(); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Action failed'); }
    finally { setActionId(null); }
  }

  async function bulkConfirm() {
    if (!selected.size) return;
    const ids = sorted.filter(r => selected.has(r.id) && r.status === 'draft').map(r => r.id);
    if (!ids.length) { alert('No draft orders selected.'); return; }
    if (!window.confirm(`Confirm ${ids.length} order(s)?`)) return;
    try { await Promise.all(ids.map(id => confirmSalesOrder(id))); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function bulkCancel() {
    if (!selected.size) return;
    const ids = sorted.filter(r => selected.has(r.id) && !['invoiced', 'cancelled'].includes(r.status)).map(r => r.id);
    if (!ids.length) { alert('No cancellable orders selected.'); return; }
    if (!window.confirm(`Cancel ${ids.length} order(s)?`)) return;
    try { await Promise.all(ids.map(id => cancelSalesOrder(id))); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function bulkDelete() {
    if (!selected.size) return;
    const ids = sorted.filter(r => selected.has(r.id) && r.status === 'draft').map(r => r.id);
    if (!ids.length) { alert('No draft orders selected.'); return; }
    if (!window.confirm(`Delete ${ids.length} order(s)?`)) return;
    try { await Promise.all(ids.map(id => deleteSalesOrder(id))); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  function exportCsv() {
    const rows = [
      ['Number', 'Date', 'Customer', 'Delivery Date', 'Reference', 'Net Amount', 'Status'],
      ...sorted.map(r => [
        r.number, r.date.slice(0, 10), r.customer_name,
        r.delivery_date?.slice(0, 10) ?? '', r.reference ?? '',
        r.net_amount, r.status,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'sale-orders.csv';
    a.click();
  }

  function printList() {
    const w = window.open('', '_blank')!;
    const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const rows = sorted.map(r => `
      <tr>
        <td>${r.number}</td><td>${r.date.slice(0,10)}</td><td>${r.customer_name}</td>
        <td>${r.delivery_date?.slice(0,10) ?? ''}</td><td>${r.reference ?? ''}</td>
        <td style="text-align:right">PKR ${fmt(r.net_amount)}</td>
        <td>${SO_STATUS_LABELS[r.status]}</td>
      </tr>`).join('');
    const totalNet = sorted.reduce((s, r) => s + Number(r.net_amount), 0);
    w.document.write(`<html><head><title>Sale Orders</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5;font-weight:600}
      .total{font-weight:700;background:#f0f0f0}</style></head>
      <body><h2>Sale Orders</h2><table>
      <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Delivery Date</th><th>Reference</th><th>Net Amount</th><th>Status</th></tr></thead>
      <tbody>${rows}
      <tr class="total"><td colspan="5">Total:</td>
        <td style="text-align:right">PKR ${fmt(totalNet)}</td><td></td></tr>
      </tbody></table></body></html>`);
    w.document.close(); w.print();
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalNet = sorted.reduce((s, r) => s + Number(r.net_amount), 0);

  if (showForm) return (
        <SalesOrderForm
      order={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={() => { setShowForm(false); setEditEntry(null); fetchRecords(applied); }}
    />
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Sale Orders</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD SALE ORDER
        </button>
      </div>

      {/* Toolbar: FILTERS left | PRINT ACTIONS EXPORT right */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between gap-2">
        <button
          onClick={() => { setDraft({ ...applied }); setShowFilters(true); }}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white ${Object.entries(applied).some(([k,v]) => k!=='showDeclined'?Boolean(v):v===true) ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h4" />
          </svg>
          FILTERS {Object.entries(applied).some(([k,v]) => k!=='showDeclined'?Boolean(v):v===true) && <span className="ml-1 bg-white text-green-600 text-xs rounded-full px-1.5 py-0.5 font-bold">●</span>}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={printList}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>

          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions(v => !v)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              ACTIONS
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-white rounded-lg border border-gray-200 shadow-lg py-1">
                <button onClick={() => { setShowActions(false); bulkConfirm(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Confirm Selected {selected.size > 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 rounded-full px-1.5">{selected.size}</span>}
                </button>
                <button onClick={() => { setShowActions(false); bulkCancel(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel Selected {selected.size > 0 && <span className="ml-1 text-xs bg-orange-100 text-orange-700 rounded-full px-1.5">{selected.size}</span>}
                </button>
                <button onClick={() => { setShowActions(false); bulkDelete(); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Delete Selected {selected.size > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 rounded-full px-1.5">{selected.size}</span>}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-2xl border-2 border-green-500">
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600 z-10">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="px-6 py-5 space-y-3">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search number" value={draft.number} onChange={e => setDraft(d => ({ ...d, number: e.target.value }))} />
              </div>
              {/* Date */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateFrom} onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))} />
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateTo} onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))} />
                </div>
              </div>
              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Reference</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search reference" value={draft.reference} onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} />
              </div>
              {/* Customer */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Customer</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.customerId} onChange={e => setDraft(d => ({ ...d, customerId: e.target.value }))}>
                  <option value="">Type to search customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>
              {/* Delivery Date */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Delivery Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.deliveryDateFrom} onChange={e => setDraft(d => ({ ...d, deliveryDateFrom: e.target.value }))} />
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.deliveryDateTo} onChange={e => setDraft(d => ({ ...d, deliveryDateTo: e.target.value }))} />
                </div>
              </div>
              {/* Gross Amount */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Gross Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <input type="number" placeholder="From" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.grossAmountFrom} onChange={e => setDraft(d => ({ ...d, grossAmountFrom: e.target.value }))} />
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <input type="number" placeholder="To" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.grossAmountTo} onChange={e => setDraft(d => ({ ...d, grossAmountTo: e.target.value }))} />
                </div>
              </div>
              {/* Net Amount */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Net Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <input type="number" placeholder="From" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.netAmountFrom} onChange={e => setDraft(d => ({ ...d, netAmountFrom: e.target.value }))} />
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <input type="number" placeholder="To" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.netAmountTo} onChange={e => setDraft(d => ({ ...d, netAmountTo: e.target.value }))} />
                </div>
              </div>
              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                  <option value="">Select status</option>
                  <option value="draft">Draft</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="invoiced">Invoiced</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {/* Show Declined + SHOW MORE */}
              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={draft.showDeclined} onChange={e => setDraft(d => ({ ...d, showDeclined: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-green-600" />
                  Show Declined
                </label>
                <button type="button"
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  SHOW MORE
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button type="button"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button type="button" onClick={() => { setApplied({ ...draft }); setShowFilters(false); }}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                APPLY
              </button>
              <button type="button" onClick={() => setDraft(emptyFilter())}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-0 py-2">
        {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <div className="border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-xs" style={{tableLayout:'fixed', minWidth:'1100px'}}>
              <colgroup>
                <col style={{width:'36px'}} />
                <col style={{width:'110px'}} />
                <col style={{width:'90px'}} />
                <col style={{width:'15%'}} />
                <col style={{width:'110px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'115px'}} />
                <col style={{width:'110px'}} />
                <col style={{width:'88px'}} />
                <col style={{width:'130px'}} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                  </th>
                  <SortTh label="Number"        sortKey="number"        current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortTh label="Date"          sortKey="date"          current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortTh label="Customer"      sortKey="customer_name" current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortTh label="Delivery Date" sortKey="delivery_date" current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortTh label="Reference"     sortKey="reference"     current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortTh label="Gross Amount"  sortKey="gross_amount"  current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2 text-right" />
                  <SortTh label="Net Amount"    sortKey="net_amount"    current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2 text-right" />
                  <SortTh label="Status"        sortKey="status"        current={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <span className="text-amber-600 font-medium">No record found.</span>
                    </td>
                  </tr>
                ) : sorted.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors group ${selected.has(r.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={() => { setEditEntry(r); setShowForm(true); }}
                        className="font-mono font-semibold text-blue-600 hover:underline truncate block w-full text-left">
                        {r.number}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-gray-600 truncate">{r.date.slice(0, 10)}</td>
                    <td className="px-2 py-1.5 text-blue-600 font-medium truncate">{r.customer_name}</td>
                    <td className="px-2 py-1.5 text-gray-600 truncate">{r.delivery_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-2 py-1.5 text-gray-500 truncate">{r.reference ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold truncate">
                      {fmt(r.gross_amount)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold truncate">
                      {fmt(r.net_amount)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SO_STATUS_COLORS[r.status]}`}>
                        {SO_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {r.status === 'draft' && (
                          <>
                            <button onClick={() => { setEditEntry(r); setShowForm(true); }}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50">Edit</button>
                            <button onClick={() => act(r.id, () => confirmSalesOrder(r.id), `Confirm "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-green-600 border border-green-200 hover:bg-green-50 disabled:opacity-50">
                              {actionId === r.id ? '…' : 'Confirm'}
                            </button>
                            <button onClick={() => act(r.id, () => deleteSalesOrder(r.id), `Delete "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">Del</button>
                          </>
                        )}
                        {r.status === 'confirmed' && (
                          <>
                            <button onClick={() => { setEditEntry(r); setShowForm(true); }}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50">Edit</button>
                            <button onClick={() => act(r.id, () => shipSalesOrder(r.id), `Ship "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-cyan-600 border border-cyan-200 hover:bg-cyan-50 disabled:opacity-50">
                              {actionId === r.id ? '…' : 'Ship'}
                            </button>
                            <button onClick={() => act(r.id, () => deliverSalesOrder(r.id), `Deliver "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-teal-600 border border-teal-200 hover:bg-teal-50 disabled:opacity-50">
                              {actionId === r.id ? '…' : 'Deliver'}
                            </button>
                            <button onClick={() => act(r.id, () => cancelSalesOrder(r.id), `Cancel "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                          </>
                        )}
                        {r.status === 'shipped' && (
                          <>
                            <button onClick={() => act(r.id, () => deliverSalesOrder(r.id), `Deliver "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-teal-600 border border-teal-200 hover:bg-teal-50 disabled:opacity-50">
                              {actionId === r.id ? '…' : 'Deliver'}
                            </button>
                            <button onClick={() => act(r.id, () => cancelSalesOrder(r.id), `Cancel "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                          </>
                        )}
                        {(r.status === 'delivered' || r.status === 'confirmed' || r.status === 'shipped') && (
                          <button onClick={() => { setInvoiceFrom(r); setShowInvoiceForm(true); }}
                            className="rounded px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50">
                            Invoice
                          </button>
                        )}
                        {r.status === 'delivered' && (
                          <button onClick={() => act(r.id, () => cancelSalesOrder(r.id), `Cancel "${r.number}"?`)}
                            disabled={actionId === r.id}
                            className="rounded px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                        )}
                        {['invoiced', 'cancelled'].includes(r.status) && <span className="text-xs text-gray-400 px-2">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {sorted.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={6} className="px-3 py-1.5 font-bold text-gray-700 text-xs">Total:</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-gray-900 text-xs"></td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-gray-900 text-xs">
                      {fmt(totalNet)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {showInvoiceForm && invoiceFrom && (
        <SalesInvoiceForm
          invoice={null}
          fromOrder={invoiceFrom}
          onClose={() => { setShowInvoiceForm(false); setInvoiceFrom(null); }}
          onSaved={() => { setShowInvoiceForm(false); setInvoiceFrom(null); fetchRecords(applied); }}
        />
      )}
    </div>
  );
}

