import { apiFetch } from '../api/apiFetch';
import { useCallback, useEffect, useState } from 'react';
import type { SalesSettlement, SSStatus } from '../types/salesSettlement';
import { SS_STATUS_COLORS, SS_STATUS_LABELS } from '../types/salesSettlement';
import { getSalesSettlements, approveSalesSettlement, cancelSalesSettlement, deleteSalesSettlement } from '../api/salesSettlements';
import SalesSettlementForm from '../components/SalesSettlementForm';

type SortDir = 'asc' | 'desc' | null;
type SortKey = keyof SalesSettlement | '';

function SortTh({ label, sortKey, current, dir, onSort, className = '' }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = current === sortKey;
  return (
    <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-400 text-xs">{active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↕'}</span>
      </span>
    </th>
  );
}

interface FilterState {
  number: string; dateFrom: string; dateTo: string;
  customerId: string; totalAmountFrom: string; totalAmountTo: string;
  status: string; showVoid: boolean;
}
const emptyFilter = (): FilterState => ({
  number: '', dateFrom: '', dateTo: '', customerId: '',
  totalAmountFrom: '', totalAmountTo: '', status: '', showVoid: false,
});

interface Customer { id: number; print_name: string; }

export default function SalesSettlementsPage() {
  const [rows,        setRows]        = useState<SalesSettlement[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [draft,       setDraft]       = useState<FilterState>(emptyFilter());
  const [applied,     setApplied]     = useState<FilterState>(emptyFilter());
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<SalesSettlement | null>(null);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());
  const [sortKey,     setSortKey]     = useState<SortKey>('date');
  const [sortDir,     setSortDir]     = useState<SortDir>('desc');
  const [actErr,      setActErr]      = useState('');

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  const load = useCallback(async (f: FilterState) => {
    setLoading(true);
    const p: Record<string, string> = {};
    if (f.number)     p.search      = f.number;
    if (f.status)     p.status      = f.status;
    if (f.dateFrom)   p.date_from   = f.dateFrom;
    if (f.dateTo)     p.date_to     = f.dateTo;
    if (f.customerId) p.customer_id = f.customerId;
    try {
      let data = await getSalesSettlements(p);
      if (f.totalAmountFrom) data = data.filter(r => Number(r.total_amount) >= Number(f.totalAmountFrom));
      if (f.totalAmountTo)   data = data.filter(r => Number(r.total_amount) <= Number(f.totalAmountTo));
      setRows(data); setSelected(new Set());
    }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(applied); }, [load, applied]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = [...rows].sort((a, b) => {
    if (!sortDir || !sortKey) return 0;
    const av = a[sortKey as keyof SalesSettlement] ?? '';
    const bv = b[sortKey as keyof SalesSettlement] ?? '';
    return (sortDir === 'asc' ? 1 : -1) * String(av).localeCompare(String(bv), undefined, { numeric: true });
  });

  const allSelected = sorted.length > 0 && sorted.every(r => selected.has(r.id));
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(sorted.map(r => r.id))); }
  function toggleRow(id: number) { setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); }

  async function act(fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActErr('');
    try { await fn(); load(applied); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Action failed'); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalAmount = sorted.reduce((s, r) => s + Number(r.total_amount), 0);

  function exportCsv() {
    const csvRows = [
      ['Number', 'Date', 'Customer', 'Total Amount', 'Status'],
      ...sorted.map(r => [r.number, r.date?.slice(0, 10), r.customer_name, r.total_amount, SS_STATUS_LABELS[r.status]]),
    ];
    const csv = csvRows.map(row => row.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'customer-settlements.csv';
    a.click();
  }

  function printList() {
    const w = window.open('', '_blank')!;
    const bodyRows = sorted.map(r => `
      <tr>
        <td>${r.number}</td>
        <td>${r.date?.slice(0, 10)}</td>
        <td>${r.customer_name}</td>
        <td style="text-align:right">${fmt(r.total_amount)}</td>
        <td>${SS_STATUS_LABELS[r.status]}</td>
      </tr>`).join('');
    w.document.write(`<html><head><title>Customer Settlements</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5;font-weight:600}
      .total{font-weight:700;background:#f0f0f0}</style></head>
      <body><h2>Customer Settlements</h2><table>
      <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Total Amount</th><th>Status</th></tr></thead>
      <tbody>${bodyRows}
      <tr class="total"><td colspan="3">Total:</td>
        <td style="text-align:right">${fmt(totalAmount)}</td><td></td>
      </tr></tbody></table></body></html>`);
    w.document.close(); w.print();
  }

  if (showForm) return (
        <SalesSettlementForm
      settlement={editing}
      onClose={() => { setShowForm(false); setEditing(null); }}
      onSaved={() => { setShowForm(false); setEditing(null); load(applied); }}
    />
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Customer Settlements</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD CUSTOMER SETTLEMENT
        </button>
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
          <button onClick={printList}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm font-medium text-gray-700 flex-shrink-0">Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search number" value={draft.number} onChange={e => setDraft(d => ({ ...d, number: e.target.value }))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm font-medium text-gray-700 flex-shrink-0">Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateFrom} onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateTo} onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm font-medium text-gray-700 flex-shrink-0">Customer</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.customerId} onChange={e => setDraft(d => ({ ...d, customerId: e.target.value }))}>
                  <option value="">Type to search customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm font-medium text-gray-700 flex-shrink-0">Total Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={draft.totalAmountFrom} onChange={e => setDraft(d => ({ ...d, totalAmountFrom: e.target.value }))} />
                  <span className="text-gray-400 text-sm">To</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={draft.totalAmountTo} onChange={e => setDraft(d => ({ ...d, totalAmountTo: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                  <option value="">Select status</option>
                  {(['draft', 'approved', 'cancelled'] as SSStatus[]).map(s => (
                    <option key={s} value={s}>{SS_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28" />
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={draft.showVoid} onChange={e => setDraft(d => ({ ...d, showVoid: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-green-600" />
                  Show Void
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button type="button"
                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded">
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

      {actErr && <div className="mx-6 mt-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{actErr}</div>}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="px-3 py-2 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300" />
                </th>
                <SortTh label="Number"       sortKey="number"       current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Date"         sortKey="date"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Customer"     sortKey="customer_name" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Total Amount" sortKey="total_amount" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Status"       sortKey="status"       current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-amber-500 text-sm">No record found</td></tr>
              ) : sorted.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${selected.has(r.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} className="h-4 w-4 rounded border-gray-300" />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-blue-600 cursor-pointer hover:underline" onClick={() => { setEditing(r); setShowForm(true); }}>
                    {r.number}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.date?.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-gray-800">{r.customer_name}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(r.total_amount)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SS_STATUS_COLORS[r.status]}`}>
                      {SS_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 flex-wrap items-center">
                      {r.status === 'draft' && (
                        <>
                          <button onClick={() => { setEditing(r); setShowForm(true); }}
                            className="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-600">Edit</button>
                          <button onClick={() => act(() => approveSalesSettlement(r.id), 'Approve this settlement?')}
                            className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-200">Approve</button>
                          <button onClick={() => act(() => deleteSalesSettlement(r.id), 'Delete this settlement?')}
                            className="text-xs px-2 py-0.5 text-red-500 hover:underline">Delete</button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={() => act(() => cancelSalesSettlement(r.id), 'Cancel this settlement?')}
                          className="text-xs px-2 py-0.5 text-red-500 hover:underline">Cancel</button>
                      )}
                      {r.status === 'cancelled' && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-sm text-gray-700">Total:</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-gray-900">{fmt(totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

