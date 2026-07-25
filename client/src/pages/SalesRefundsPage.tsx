import { useEffect, useState } from 'react';
import { apiFetch } from '../api/apiFetch';
import type { SalesRefund, SRefundStatus } from '../types/salesRefund';
import { SREFUND_STATUS_COLORS, SREFUND_STATUS_LABELS } from '../types/salesRefund';
import { getSalesRefunds, approveSalesRefund, cancelSalesRefund, deleteSalesRefund } from '../api/salesRefunds';
import SalesRefundForm from '../components/SalesRefundForm';

function printRefunds(rows: SalesRefund[]) {
  const win = window.open('', '_blank', 'width=1000,height=680');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Customer Refunds</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#f5f5f5;font-weight:bold}h2{margin-bottom:12px}</style></head><body>
<h2>Customer Refunds</h2><table><thead><tr>
<th>Number</th><th>Date</th><th>Customer</th><th>Reference</th>
<th>Total Amount</th><th>Unadjusted Amount</th><th>Status</th></tr></thead><tbody>
${rows.map(r => `<tr>
<td>${r.number || ''}</td><td>${r.date?.slice(0, 10) || ''}</td>
<td>${r.customer_name || ''}</td><td>${r.reference || '—'}</td>
<td style="text-align:right">${Number(r.total_amount).toFixed(2)}</td>
<td style="text-align:right">${Number(r.unadjusted_amount).toFixed(2)}</td>
<td>${SREFUND_STATUS_LABELS[r.status] || r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

function exportRefundsToExcel(rows: SalesRefund[]) {
  const header = ['Number', 'Date', 'Customer', 'Reference', 'Total Amount', 'Unadjusted Amount', 'Status'];
  const data = rows.map(r => [
    r.number, r.date?.slice(0, 10), r.customer_name, r.reference || '',
    Number(r.total_amount).toFixed(2), Number(r.unadjusted_amount).toFixed(2),
    SREFUND_STATUS_LABELS[r.status],
  ]);
  const csv = [header, ...data].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'customer_refunds.csv'; a.click();
  URL.revokeObjectURL(url);
}

function SortIcon({ col, sort }: { col: string; sort: { col: string; dir: 'asc' | 'desc' } }) {
  return (
    <svg className="inline w-3 h-3 ml-0.5" viewBox="0 0 8 10" fill="none">
      <path d="M4 0L7 4H1L4 0Z" fill={sort.col === col && sort.dir === 'asc' ? '#6b7280' : '#d1d5db'} />
      <path d="M4 10L1 6H7L4 10Z" fill={sort.col === col && sort.dir === 'desc' ? '#6b7280' : '#d1d5db'} />
    </svg>
  );
}

export default function SalesRefundsPage() {
  const [rows,     setRows]     = useState<SalesRefund[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<SalesRefund | null>(null);

  const emptyFilters = {
    number: '', dateFrom: '', dateTo: '', customerId: '',
    reference: '', totalFrom: '', totalTo: '',
    unadjustedFrom: '', unadjustedTo: '', status: '', instrument: '', showVoid: false,
  };
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'number', dir: 'asc' });
  const [customers, setCustomers] = useState<{id:number; print_name:string}[]>([]);

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== '' && v !== false).length;

  async function load() {
    setLoading(true);
    const p: Record<string, string> = {};
    if (appliedFilters.status)     p.status      = appliedFilters.status;
    if (appliedFilters.dateFrom)   p.date_from   = appliedFilters.dateFrom;
    if (appliedFilters.dateTo)     p.date_to     = appliedFilters.dateTo;
    if (appliedFilters.customerId) p.customer_id = appliedFilters.customerId;
    try { setRows(await getSalesRefunds(p)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [appliedFilters]);

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Action failed'); }
  }

  function toggleSort(col: string) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  }

  let visible = [...rows];
  if (appliedFilters.number)        visible = visible.filter(r => r.number?.toLowerCase().includes(appliedFilters.number.toLowerCase()));
  if (appliedFilters.reference)     visible = visible.filter(r => r.reference?.toLowerCase().includes(appliedFilters.reference.toLowerCase()));
  if (appliedFilters.totalFrom)     visible = visible.filter(r => Number(r.total_amount) >= Number(appliedFilters.totalFrom));
  if (appliedFilters.totalTo)       visible = visible.filter(r => Number(r.total_amount) <= Number(appliedFilters.totalTo));
  if (appliedFilters.unadjustedFrom) visible = visible.filter(r => Number(r.unadjusted_amount) >= Number(appliedFilters.unadjustedFrom));
  if (appliedFilters.unadjustedTo)  visible = visible.filter(r => Number(r.unadjusted_amount) <= Number(appliedFilters.unadjustedTo));
  if (appliedFilters.instrument)    visible = visible.filter(r => (r.bank_account_name ?? '').toLowerCase().includes(appliedFilters.instrument.toLowerCase()));
  visible.sort((a, b) => {
    let av: string | number = (a as Record<string, unknown>)[sort.col] as string | number ?? '';
    let bv: string | number = (b as Record<string, unknown>)[sort.col] as string | number ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return av < bv ? (sort.dir === 'asc' ? -1 : 1) : av > bv ? (sort.dir === 'asc' ? 1 : -1) : 0;
  });

  if (showForm) return (
        <SalesRefundForm refund={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
  );

  return (
    <div className="p-6">
      {/* Row 1: Title + ADD button */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Customer Refunds</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-green-600 text-white text-xs font-semibold px-4 py-1.5 rounded hover:bg-green-700">
          + ADD CUSTOMER REFUND
        </button>
      </div>

      {/* Row 2: FILTERS (left) + PRINT | EXPORT TO EXCEL (right) */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { setPendingFilters(appliedFilters); setShowFilters(true); }}
          className="relative flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-green-800">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          FILTERS
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-white text-blue-600 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => printRefunds(visible)}
            className="flex items-center gap-1.5 text-white bg-green-700 hover:bg-green-800 text-xs font-semibold px-3 py-1.5 rounded">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button onClick={() => exportRefundsToExcel(visible)}
            className="flex items-center gap-1.5 text-white bg-green-700 hover:bg-green-800 text-xs font-semibold px-3 py-1.5 rounded">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs" style={{tableLayout:'fixed', minWidth:'1050px'}}>
          <colgroup>
            <col style={{width:'120px'}} />
            <col style={{width:'100px'}} />
            <col style={{width:'18%'}} />
            <col style={{width:'115px'}} />
            <col style={{width:'130px'}} />
            <col style={{width:'155px'}} />
            <col style={{width:'100px'}} />
            <col style={{width:'120px'}} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b">
              {[
                { col: 'number',             label: 'Number' },
                { col: 'date',               label: 'Date' },
                { col: 'customer_name',      label: 'Customer' },
                { col: 'reference',          label: 'Reference' },
                { col: 'total_amount',       label: 'Total Amount' },
                { col: 'unadjusted_amount',  label: 'Unadjusted Amount' },
                { col: 'status',             label: 'Status' },
              ].map(({ col, label }) => (
                <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(col)}>
                  {label} <SortIcon col={col} sort={sort} />
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-gray-400">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-xs text-orange-500">No record found</td></tr>
            ) : visible.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-1.5 text-xs font-medium text-blue-600 cursor-pointer hover:underline"
                  onClick={() => { setEditing(r); setShowForm(true); }}>{r.number}</td>
                <td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">{r.date?.slice(0, 10)}</td>
                <td className="px-3 py-1.5 text-xs text-gray-800 truncate">{r.customer_name}</td>
                <td className="px-3 py-1.5 text-xs text-gray-500 truncate">{r.reference ?? '—'}</td>
                <td className="px-3 py-1.5 text-xs text-right font-mono">{Number(r.total_amount).toFixed(2)}</td>
                <td className="px-3 py-1.5 text-xs text-right font-mono">{Number(r.unadjusted_amount).toFixed(2)}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SREFUND_STATUS_COLORS[r.status]}`}>
                    {SREFUND_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-center gap-1.5">
                    {r.status === 'draft' && (
                      <>
                        <button title="Edit" onClick={() => { setEditing(r); setShowForm(true); }} className="text-blue-500 hover:text-blue-700">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 13.172V16h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button title="Approve" onClick={() => act(() => approveSalesRefund(r.id))} className="text-green-600 hover:text-green-800">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button title="Delete" onClick={() => act(() => deleteSalesRefund(r.id))} className="text-red-500 hover:text-red-700">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <button title="Cancel" onClick={() => act(() => cancelSalesRefund(r.id))} className="text-orange-500 hover:text-orange-700">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {r.status === 'cancelled' && <span className="text-gray-300">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Filters Modal — Splendid style */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl border-2 border-green-500 mx-4">

            <button onClick={() => setShowFilters(false)}
              className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold hover:bg-red-600 z-10 leading-none shadow-md">
              ×
            </button>

            <div className="px-8 py-6 space-y-4">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Number</label>
                <input type="text" placeholder="Type to search number"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.number}
                  onChange={e => setPendingFilters(f => ({ ...f, number: e.target.value }))} />
              </div>

              {/* Date From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-600 shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateFrom} onChange={e => setPendingFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-600 shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateTo} onChange={e => setPendingFilters(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>

              {/* Customer */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Customer</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={pendingFilters.customerId} onChange={e => setPendingFilters(f => ({ ...f, customerId: e.target.value }))}>
                  <option value="">Type to search customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Reference</label>
                <input type="text" placeholder="Type to search reference"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.reference}
                  onChange={e => setPendingFilters(f => ({ ...f, reference: e.target.value }))} />
              </div>

              {/* Total Amount */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Total Amount</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-600 shrink-0">From:</span>
                  <input type="number" placeholder="From" className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.totalFrom} onChange={e => setPendingFilters(f => ({ ...f, totalFrom: e.target.value }))} />
                  <span className="text-sm text-gray-600 shrink-0">To:</span>
                  <input type="number" placeholder="To" className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.totalTo} onChange={e => setPendingFilters(f => ({ ...f, totalTo: e.target.value }))} />
                </div>
              </div>

              {/* Unadjusted Amount */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700 leading-tight">Unadjusted<br />Amount</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-600 shrink-0">From:</span>
                  <input type="number" placeholder="From" className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.unadjustedFrom} onChange={e => setPendingFilters(f => ({ ...f, unadjustedFrom: e.target.value }))} />
                  <span className="text-sm text-gray-600 shrink-0">To:</span>
                  <input type="number" placeholder="To" className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.unadjustedTo} onChange={e => setPendingFilters(f => ({ ...f, unadjustedTo: e.target.value }))} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Status</label>
                <div className="relative flex-1">
                  <select className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white appearance-none"
                    value={pendingFilters.status} onChange={e => setPendingFilters(f => ({ ...f, status: e.target.value }))}>
                    <option value="">Select status</option>
                    {(['draft', 'approved', 'cancelled'] as SRefundStatus[]).map(s => (
                      <option key={s} value={s}>{SREFUND_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Instrument */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Instrument</label>
                <input type="text" placeholder="Type to search instrument"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={pendingFilters.instrument}
                  onChange={e => setPendingFilters(f => ({ ...f, instrument: e.target.value }))} />
              </div>

              {/* Show Void + SHOW MORE */}
              <div className="flex items-center justify-between pl-40">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-green-600"
                    checked={pendingFilters.showVoid}
                    onChange={e => setPendingFilters(f => ({ ...f, showVoid: e.target.checked }))} />
                  Show Void
                </label>
                <button className="flex items-center gap-1.5 bg-green-500 text-white text-sm font-semibold px-4 py-1.5 rounded hover:bg-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  SHOW MORE
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-8 py-4 border-t border-gray-200">
              <button className="flex items-center gap-2 bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-green-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                SAVE FILTER
              </button>
              <button onClick={() => { setAppliedFilters(pendingFilters); setShowFilters(false); }}
                className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-green-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                APPLY
              </button>
              <button onClick={() => { setPendingFilters(emptyFilters); setAppliedFilters(emptyFilters); setShowFilters(false); }}
                className="flex items-center gap-2 bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-green-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
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
