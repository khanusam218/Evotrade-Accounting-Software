import { apiFetch } from '../api/apiFetch';
import { useCallback, useEffect, useState } from 'react';
import SalesQuotationForm from '../components/SalesQuotationForm';
import SalesOrderForm from '../components/SalesOrderForm';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import {
  getSalesQuotations, getSalesQuotation, sendSalesQuotation, approveSalesQuotation,
  cancelSalesQuotation, deleteSalesQuotation,
} from '../api/salesQuotations';
import type { SalesQuotation } from '../types/salesQuotation';
import { SQ_STATUS_COLORS, SQ_STATUS_LABELS } from '../types/salesQuotation';

type SortDir = 'asc' | 'desc' | null;

function SortTh({ label, col, sort, onSort, className = '' }: {
  label: string; col: string; className?: string;
  sort: { col: string; dir: SortDir }; onSort: (c: string) => void;
}) {
  const active = sort.col === col;
  return (
    <th className={`px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-xs ${active ? 'text-indigo-600' : 'text-gray-300'}`}>
          {active && sort.dir === 'asc' ? '↑' : active && sort.dir === 'desc' ? '↓' : '⇅'}
        </span>
      </span>
    </th>
  );
}

interface FilterState {
  number: string; dateFrom: string; dateTo: string; reference: string;
  customerId: string; expiryDateFrom: string; expiryDateTo: string;
  grossAmountFrom: string; grossAmountTo: string;
  netAmountFrom: string; netAmountTo: string;
  status: string; showDeclined: boolean;
}
const emptyFilter = (): FilterState => ({
  number: '', dateFrom: '', dateTo: '', reference: '', customerId: '',
  expiryDateFrom: '', expiryDateTo: '',
  grossAmountFrom: '', grossAmountTo: '',
  netAmountFrom: '', netAmountTo: '',
  status: '', showDeclined: false,
});

interface Customer { id: number; print_name: string; }

export default function SalesQuotationsPage() {
  const [records, setRecords]           = useState<SalesQuotation[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error,   setError]             = useState<string | null>(null);
  const [showFilters, setShowFilters]   = useState(false);
  const [draft,   setDraft]             = useState<FilterState>(emptyFilter());
  const [applied, setApplied]           = useState<FilterState>(emptyFilter());
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [editEntry, setEditEntry]       = useState<SalesQuotation | null>(null);
  const [actionId,  setActionId]        = useState<number | null>(null);
  const [showOrderForm,   setShowOrderForm]   = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [convertFrom, setConvertFrom]   = useState<SalesQuotation | null>(null);
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [sort, setSort]                 = useState<{ col: string; dir: SortDir }>({ col: 'date', dir: 'desc' });
  const [bulkWorking, setBulkWorking]   = useState(false);

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
      let data = await getSalesQuotations(p);
      if (f.reference)       data = data.filter(r => (r.reference ?? '').toLowerCase().includes(f.reference.toLowerCase()));
      if (f.expiryDateFrom)  data = data.filter(r => (r.expiry_date ?? '') >= f.expiryDateFrom);
      if (f.expiryDateTo)    data = data.filter(r => (r.expiry_date ?? '') <= f.expiryDateTo);
      if (f.grossAmountFrom) data = data.filter(r => Number(r.gross_amount) >= Number(f.grossAmountFrom));
      if (f.grossAmountTo)   data = data.filter(r => Number(r.gross_amount) <= Number(f.grossAmountTo));
      if (f.netAmountFrom)   data = data.filter(r => Number(r.net_amount) >= Number(f.netAmountFrom));
      if (f.netAmountTo)     data = data.filter(r => Number(r.net_amount) <= Number(f.netAmountTo));
      if (!f.showDeclined)   data = data.filter(r => r.status !== 'declined');
      setRecords(data);
      setSelected(new Set());
    } catch (err: unknown) {
      setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(applied); }, [fetchRecords, applied]);

  // ── Sorting ────────────────────────────────────────────────────────────────
  function toggleSort(col: string) {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : prev.dir === 'desc' ? null : 'asc' }
        : { col, dir: 'asc' }
    );
  }
  const sorted = [...records].sort((a, b) => {
    if (!sort.dir) return 0;
    const av = (a as Record<string, unknown>)[sort.col] ?? '';
    const bv = (b as Record<string, unknown>)[sort.col] ?? '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  // ── Selection ──────────────────────────────────────────────────────────────
  const allSelected = sorted.length > 0 && sorted.every(r => selected.has(r.id));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map(r => r.id)));
  }
  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function act(id: number, fn: () => Promise<unknown>, msg?: string) {
    if (msg && !window.confirm(msg)) return;
    setActionId(id);
    try { await fn(); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Action failed'); }
    finally { setActionId(null); }
  }

  async function approveSelected() {
    const ids = [...selected].filter(id => {
      const r = records.find(x => x.id === id);
      return r && ['draft', 'sent'].includes(r.status);
    });
    if (!ids.length) { alert('No approvable quotations selected (must be Draft or Sent)'); return; }
    if (!window.confirm(`Approve ${ids.length} quotation(s)?`)) return;
    setBulkWorking(true);
    try {
      await Promise.all(ids.map(id => approveSalesQuotation(id)));
      fetchRecords(applied);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Bulk approve failed'); }
    finally { setBulkWorking(false); }
  }

  async function handleConvert(r: SalesQuotation, target: 'order' | 'invoice') {
    try {
      const full = await getSalesQuotation(r.id);
      setConvertFrom(full);
      if (target === 'order') setShowOrderForm(true);
      else setShowInvoiceForm(true);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to load quotation'); }
  }

  function closeConvert() { setShowOrderForm(false); setShowInvoiceForm(false); setConvertFrom(null); }

  // ── Print ──────────────────────────────────────────────────────────────────
  function handlePrint() {
    const rows = sorted.map(r => `
      <tr>
        <td>${r.number}</td>
        <td>${new Date(r.date).toLocaleDateString()}</td>
        <td>${r.customer_name}</td>
        <td>${r.reference ?? '—'}</td>
        <td>${r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '—'}</td>
        <td style="text-align:right">${Number(r.gross_amount).toFixed(2)}</td>
        <td style="text-align:right">${Number(r.net_amount).toFixed(2)}</td>
        <td>${SQ_STATUS_LABELS[r.status]}</td>
      </tr>`).join('');
    const win = window.open('', '_blank', 'width=1000,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Sale Quotations</title>
      <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:6px 10px}th{background:#f5f5f5;font-weight:600}
      tr:nth-child(even){background:#fafafa}h2{margin-bottom:16px}</style></head>
      <body><h2>Sale Quotations</h2><table>
      <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Reference</th><th>Expiry Date</th>
      <th>Gross Amount</th><th>Net Amount</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print();},300)}</script>
      </body></html>`);
    win.document.close();
  }

  // ── Export to Excel (CSV) ──────────────────────────────────────────────────
  function exportToExcel() {
    const header = ['Number', 'Date', 'Customer', 'Reference', 'Expiry Date', 'Gross Amount', 'Net Amount', 'Status'];
    const rows = sorted.map(r => [
      r.number,
      new Date(r.date).toLocaleDateString(),
      r.customer_name,
      r.reference ?? '',
      r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '',
      Number(r.gross_amount).toFixed(2),
      Number(r.net_amount).toFixed(2),
      SQ_STATUS_LABELS[r.status],
    ]);
    const csv = [header, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sale-quotations.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const sortProps = { sort, onSort: toggleSort };

  if (showForm) return (
        <SalesQuotationForm
      quotation={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={() => { setShowForm(false); setEditEntry(null); fetchRecords(applied); }}
    />
  );

  return (
    <div className="flex flex-col h-full">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-3 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Sale Quotations</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <span className="text-lg leading-none">+</span> ADD SALE QUOTATION
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="border-b border-gray-200 bg-white px-3 py-2 flex items-center gap-2 shrink-0">
        {/* Filters toggle */}
        <button
          onClick={() => { setDraft({ ...applied }); setShowFilters(true); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-colors ${Object.entries(applied).some(([k,v]) => k!=='showDeclined'?Boolean(v):v===true) ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M13 16h-2" />
          </svg>
          FILTERS {Object.entries(applied).some(([k,v]) => k!=='showDeclined'?Boolean(v):v===true) && <span className="ml-1 bg-white text-green-600 text-xs rounded-full px-1.5 py-0.5 font-bold">●</span>}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Print */}
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4H9v4a1 1 0 001 1z" />
            </svg>
            PRINT
          </button>

          {/* Approve Selected */}
          <button
            onClick={approveSelected}
            disabled={selected.size === 0 || bulkWorking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {bulkWorking ? 'APPROVING…' : 'APPROVE SELECTED QUOTATIONS'}
            {selected.size > 0 && <span className="ml-1 bg-indigo-100 text-indigo-700 text-xs rounded-full px-1.5">{selected.size}</span>}
          </button>

          {/* Export to Excel */}
          <button onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
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
              {/* Expiry Date */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Expiry Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.expiryDateFrom} onChange={e => setDraft(d => ({ ...d, expiryDateFrom: e.target.value }))} />
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.expiryDateTo} onChange={e => setDraft(d => ({ ...d, expiryDateTo: e.target.value }))} />
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
                  <option value="sent">Sent</option>
                  <option value="approved">Approved</option>
                  <option value="converted">Converted</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="declined">Declined</option>
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

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto px-0 py-2">
        {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <div className="border border-gray-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-xs" style={{tableLayout:'fixed', minWidth:'900px'}}>
              <colgroup>
                <col style={{width:'32px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'82px'}} />
                <col style={{width:'14%'}} />
                <col style={{width:'82px'}} />
                <col style={{width:'88px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'80px'}} />
                <col style={{width:'auto'}} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  </th>
                  <SortTh label="Number"       col="number"       className="px-2 py-2" {...sortProps} />
                  <SortTh label="Date"         col="date"         className="px-2 py-2" {...sortProps} />
                  <SortTh label="Customer"     col="customer_name" className="px-2 py-2" {...sortProps} />
                  <SortTh label="Reference"    col="reference"    className="px-2 py-2" {...sortProps} />
                  <SortTh label="Expiry Date"  col="expiry_date"  className="px-2 py-2" {...sortProps} />
                  <SortTh label="Gross Amount" col="gross_amount" className="px-2 py-2 text-right" {...sortProps} />
                  <SortTh label="Net Amount"   col="net_amount"   className="px-2 py-2 text-right" {...sortProps} />
                  <SortTh label="Status"       col="status"       className="px-2 py-2" {...sortProps} />
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map(r => (
                  <tr key={r.id} className={`transition-colors group ${selected.has(r.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-2 py-1.5">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    </td>
                    <td className="px-2 py-1.5 font-mono font-semibold text-indigo-700 truncate">{r.number}</td>
                    <td className="px-2 py-1.5 text-gray-600 truncate">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-2 py-1.5 font-medium max-w-[140px] truncate">{r.customer_name}</td>
                    <td className="px-2 py-1.5 text-gray-500 truncate">{r.reference ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-gray-500 truncate">
                      {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(r.gross_amount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmt(r.net_amount)}</td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SQ_STATUS_COLORS[r.status]}`}>
                        {SQ_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        {['draft', 'sent'].includes(r.status) && (
                          <>
                            {/* Edit */}
                            <button title="Edit" onClick={() => { setEditEntry(r); setShowForm(true); }}
                              className="p-1 rounded text-indigo-600 hover:bg-indigo-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            {/* Send */}
                            {r.status === 'draft' && (
                              <button title="Send" onClick={() => act(r.id, () => sendSalesQuotation(r.id), `Mark "${r.number}" as sent?`)} disabled={actionId === r.id}
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                              </button>
                            )}
                            {/* Approve */}
                            <button title="Approve" onClick={() => act(r.id, () => approveSalesQuotation(r.id), `Approve "${r.number}"?`)} disabled={actionId === r.id}
                              className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                            {/* Cancel */}
                            <button title="Cancel" onClick={() => act(r.id, () => cancelSalesQuotation(r.id), `Cancel "${r.number}"?`)} disabled={actionId === r.id}
                              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                            {/* Delete */}
                            {r.status === 'draft' && (
                              <button title="Delete" onClick={() => act(r.id, () => deleteSalesQuotation(r.id), `Delete "${r.number}"?`)} disabled={actionId === r.id}
                                className="p-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </>
                        )}
                        {r.status === 'approved' && (
                          <>
                            {/* To Order */}
                            <button title="Convert to Order" onClick={() => handleConvert(r, 'order')}
                              className="p-1 rounded text-indigo-600 hover:bg-indigo-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            </button>
                            {/* To Invoice */}
                            <button title="Convert to Invoice" onClick={() => handleConvert(r, 'invoice')}
                              className="p-1 rounded text-purple-600 hover:bg-purple-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </button>
                            {/* Cancel */}
                            <button title="Cancel" onClick={() => act(r.id, () => cancelSalesQuotation(r.id), `Cancel "${r.number}"?`)} disabled={actionId === r.id}
                              className="p-1 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                          </>
                        )}
                        {['converted', 'cancelled'].includes(r.status) && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <span className="text-amber-500 font-medium text-sm">No record found</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showOrderForm && (
        <SalesOrderForm
          order={null}
          fromQuotation={convertFrom ?? undefined}
          onClose={closeConvert}
          onSaved={() => { closeConvert(); fetchRecords(applied); }}
        />
      )}
      {showInvoiceForm && (
        <SalesInvoiceForm
          invoice={null}
          fromQuotation={convertFrom ?? undefined}
          onClose={closeConvert}
          onSaved={() => { closeConvert(); fetchRecords(applied); }}
        />
      )}
    </div>
  );
}

