import { apiFetch } from '../api/apiFetch';
import { useCallback, useEffect, useState } from 'react';
import ReceivePaymentForm from '../components/ReceivePaymentForm';
import BulkReceivePaymentForm from '../components/BulkReceivePaymentForm';
import {
  getReceivePayments, approveReceivePayment, cancelReceivePayment, deleteReceivePayment,
} from '../api/receivePayments';
import type { ReceivePayment } from '../types/receivePayment';
import { RP_STATUS_COLORS, RP_STATUS_LABELS } from '../types/receivePayment';

type SortDir = 'asc' | 'desc' | null;
type SortKey = keyof ReceivePayment | '';

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
    <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${className}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-400 text-xs">{active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↕'}</span>
      </span>
    </th>
  );
}

interface FilterState {
  number: string; dateFrom: string; dateTo: string; reference: string;
  customerId: string;
  totalAmountFrom: string; totalAmountTo: string;
  unadjAmountFrom: string; unadjAmountTo: string;
  status: string; instrument: string; showVoid: boolean;
}
const emptyFilter = (): FilterState => ({
  number: '', dateFrom: '', dateTo: '', reference: '', customerId: '',
  totalAmountFrom: '', totalAmountTo: '',
  unadjAmountFrom: '', unadjAmountTo: '',
  status: '', instrument: '', showVoid: false,
});

interface Customer { id: number; print_name: string; }

export default function ReceivePaymentsPage() {
  const [records,      setRecords]      = useState<ReceivePayment[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [draft,        setDraft]        = useState<FilterState>(emptyFilter());
  const [applied,      setApplied]      = useState<FilterState>(emptyFilter());
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [showForm,     setShowForm]     = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editEntry,    setEditEntry]    = useState<ReceivePayment | null>(null);
  const [actionId,     setActionId]     = useState<number | null>(null);
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [sortKey,      setSortKey]      = useState<SortKey>('date');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
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
      let data = await getReceivePayments(p);
      if (f.reference)        data = data.filter(r => (r.reference ?? '').toLowerCase().includes(f.reference.toLowerCase()));
      if (f.totalAmountFrom)  data = data.filter(r => Number(r.total_amount) >= Number(f.totalAmountFrom));
      if (f.totalAmountTo)    data = data.filter(r => Number(r.total_amount) <= Number(f.totalAmountTo));
      if (f.unadjAmountFrom)  data = data.filter(r => Number(r.unadjusted_amount) >= Number(f.unadjAmountFrom));
      if (f.unadjAmountTo)    data = data.filter(r => Number(r.unadjusted_amount) <= Number(f.unadjAmountTo));
      if (f.instrument)       data = data.filter(r => (r.bank_account_name ?? '').toLowerCase().includes(f.instrument.toLowerCase()));
      setRecords(data);
      setSelected(new Set());
    } catch (err: unknown) {
      setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(applied); }, [fetchRecords, applied]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = [...records].sort((a, b) => {
    if (!sortDir || !sortKey) return 0;
    const av = a[sortKey as keyof ReceivePayment] ?? '';
    const bv = b[sortKey as keyof ReceivePayment] ?? '';
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

  function exportCsv() {
    const rows = [
      ['Number', 'Date', 'Customer', 'Bank Account', 'Reference', 'Total Amount', 'Unadjusted Amount', 'Status'],
      ...sorted.map(r => [
        r.number, r.date.slice(0, 10), r.customer_name,
        r.bank_account_name ?? 'Undeposited Funds', r.reference ?? '',
        r.total_amount, r.unadjusted_amount, r.status,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'receive-payments.csv';
    a.click();
  }

  function printList() {
    const w = window.open('', '_blank')!;
    const fmtN = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const rows = sorted.map(r => `
      <tr>
        <td>${r.number}</td><td>${r.date.slice(0,10)}</td><td>${r.customer_name}</td>
        <td>${r.reference ?? ''}</td>
        <td style="text-align:right">${fmtN(r.total_amount)}</td>
        <td style="text-align:right">${fmtN(r.unadjusted_amount)}</td>
        <td>${RP_STATUS_LABELS[r.status]}</td>
      </tr>`).join('');
    const totalAmt  = sorted.reduce((s, r) => s + Number(r.total_amount), 0);
    const totalUnadj = sorted.reduce((s, r) => s + Number(r.unadjusted_amount), 0);
    w.document.write(`<html><head><title>Receive Payment</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5;font-weight:600}
      .total{font-weight:700;background:#f0f0f0}</style></head>
      <body><h2>Receive Payment</h2><table>
      <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Reference</th><th>Total Amount</th><th>Unadjusted Amount</th><th>Status</th></tr></thead>
      <tbody>${rows}
      <tr class="total"><td colspan="4">Total:</td>
        <td style="text-align:right">${fmtN(totalAmt)}</td>
        <td style="text-align:right">${fmtN(totalUnadj)}</td>
        <td></td></tr>
      </tbody></table></body></html>`);
    w.document.close(); w.print();
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalAmt   = sorted.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalUnadj = sorted.reduce((s, r) => s + Number(r.unadjusted_amount), 0);

  if (showForm) return (
    <ReceivePaymentForm
      payment={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={() => { setShowForm(false); setEditEntry(null); fetchRecords(applied); }}
    />
  );

  if (showBulkForm) return (
    <BulkReceivePaymentForm
      onClose={() => setShowBulkForm(false)}
      onSaved={() => { setShowBulkForm(false); fetchRecords(applied); }}
    />
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Receive Payment</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditEntry(null); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            ADD RECEIVE PAYMENT
          </button>
          <button
            onClick={() => setShowBulkForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            ADD BULK RECEIVE PAYMENT
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between gap-2">
        <button
          onClick={() => { setDraft({ ...applied }); setShowFilters(true); }}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h4" />
          </svg>
          FILTERS
        </button>
        <div className="flex items-center gap-2">
          <button onClick={printList} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800">
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
            <div className="px-6 py-4 space-y-3">

              {/* Number */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search number" value={draft.number} onChange={e => setDraft(d => ({ ...d, number: e.target.value }))} />
              </div>

              {/* Date */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateFrom} onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))} />
                  <span className="text-gray-400 text-sm">To</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateTo} onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))} />
                </div>
              </div>

              {/* Customer */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Customer</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.customerId} onChange={e => setDraft(d => ({ ...d, customerId: e.target.value }))}>
                  <option value="">Type to search customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Reference</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search reference" value={draft.reference} onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} />
              </div>

              {/* Total Amount */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Total Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={draft.totalAmountFrom} onChange={e => setDraft(d => ({ ...d, totalAmountFrom: e.target.value }))} />
                  <span className="text-gray-400 text-sm">To</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={draft.totalAmountTo} onChange={e => setDraft(d => ({ ...d, totalAmountTo: e.target.value }))} />
                </div>
              </div>

              {/* Unadjusted Amount */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Unadjusted Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={draft.unadjAmountFrom} onChange={e => setDraft(d => ({ ...d, unadjAmountFrom: e.target.value }))} />
                  <span className="text-gray-400 text-sm">To</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={draft.unadjAmountTo} onChange={e => setDraft(d => ({ ...d, unadjAmountTo: e.target.value }))} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                  <option value="">Select status</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Instrument */}
              <div className="flex items-center gap-3">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Instrument</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search instrument" value={draft.instrument} onChange={e => setDraft(d => ({ ...d, instrument: e.target.value }))} />
              </div>

              {/* Show Void */}
              <div className="flex items-center gap-3">
                <label className="w-36" />
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={draft.showVoid} onChange={e => setDraft(d => ({ ...d, showVoid: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-green-600" />
                  Show Void
                </label>
              </div>

            </div>
            <div className="flex items-center gap-2 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button type="button" className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button type="button" onClick={() => { setApplied({ ...draft }); setShowFilters(false); }}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                APPLY
              </button>
              <button type="button" onClick={() => setDraft(emptyFilter())}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full divide-y divide-gray-200 text-xs" style={{tableLayout:'fixed', minWidth:'1250px'}}>
              <colgroup>
                <col style={{width:'42px'}} />
                <col style={{width:'130px'}} />
                <col style={{width:'105px'}} />
                <col style={{width:'18%'}} />
                <col style={{width:'125px'}} />
                <col style={{width:'145px'}} />
                <col style={{width:'160px'}} />
                <col style={{width:'110px'}} />
                <col style={{width:'135px'}} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-9">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                  </th>
                  <SortTh label="Number"            sortKey="number"            current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Date"              sortKey="date"              current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Customer"          sortKey="customer_name"     current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Reference"         sortKey="reference"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Total Amount"      sortKey="total_amount"      current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortTh label="Unadjusted Amount" sortKey="unadjusted_amount" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortTh label="Status"            sortKey="status"            current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center">
                      <span className="text-amber-500 font-medium">No record found</span>
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
                        className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                        {r.number}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-1.5 text-xs text-blue-600 font-medium truncate">{r.customer_name}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 truncate">{r.reference ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold whitespace-nowrap">
                      {fmt(r.total_amount)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap">
                      <span className={Number(r.unadjusted_amount) === 0 && r.status === 'approved' ? 'text-green-600 font-semibold' : ''}>
                        {fmt(r.unadjusted_amount)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RP_STATUS_COLORS[r.status]}`}>
                        {RP_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {r.status === 'draft' && (
                          <>
                            <button onClick={() => { setEditEntry(r); setShowForm(true); }}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50">Edit</button>
                            <button onClick={() => act(r.id, () => approveReceivePayment(r.id), `Approve payment "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-green-600 border border-green-200 hover:bg-green-50 disabled:opacity-50">
                              {actionId === r.id ? '…' : 'Approve'}
                            </button>
                            <button onClick={() => act(r.id, () => deleteReceivePayment(r.id), `Delete "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">Del</button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button onClick={() => act(r.id, () => cancelReceivePayment(r.id), `Cancel payment "${r.number}"? This will reverse invoice allocations.`)}
                            disabled={actionId === r.id}
                            className="rounded px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                            {actionId === r.id ? '…' : 'Cancel'}
                          </button>
                        )}
                        {r.status === 'cancelled' && <span className="text-xs text-gray-400 px-2">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {sorted.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-700">Total:</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold text-gray-900 whitespace-nowrap">
                      {fmt(totalAmt)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold text-gray-900 whitespace-nowrap">
                      {fmt(totalUnadj)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

