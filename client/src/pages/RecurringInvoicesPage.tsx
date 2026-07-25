import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { RecurringInvoice, RIStatus, RIFrequency } from '../types/recurringInvoice';
import { RI_STATUS_COLORS, RI_STATUS_LABELS, RI_FREQUENCY_LABELS } from '../types/recurringInvoice';
import {
  getRecurringInvoices,
  pauseRecurringInvoice,
  resumeRecurringInvoice,
  cancelRecurringInvoice,
  executeRecurringInvoice,
  deleteRecurringInvoice,
} from '../api/recurringInvoices';
import RecurringInvoiceForm from '../components/RecurringInvoiceForm';

interface Customer { id: number; print_name: string; }

function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 text-gray-400" style={{ fontSize: 8, lineHeight: 1 }}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className="mt-0.5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  );
}

const emptyFilters = {
  number:      '',
  customerId:  '',
  reference:   '',
  frequency:   '',
  status:      '',
  startFrom:   '',
  startTo:     '',
  endFrom:     '',
  endTo:       '',
  showVoid:    false,
};
type Filters = typeof emptyFilters;

export default function RecurringInvoicesPage() {
  const [rows,     setRows]     = useState<RecurringInvoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<RecurringInvoice | null>(null);
  const [actErr,   setActErr]   = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Filters state
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...emptyFilters });
  const [showMore,       setShowMore]       = useState(false);

  const activeFilterCount = Object.entries(appliedFilters).filter(([, v]) => v !== '' && v !== false).length;

  async function load(f: Filters = appliedFilters) {
    setLoading(true);
    const p: Record<string, string> = {};
    if (f.status)     p.status = f.status;
    if (f.customerId) p.customer_id = f.customerId;
    if (f.frequency)  p.frequency = f.frequency;
    try {
      let data = await getRecurringInvoices(p);
      if (f.number)    data = data.filter(r => r.number?.toLowerCase().includes(f.number.toLowerCase()));
      if (f.reference) data = data.filter(r => (r.reference ?? '').toLowerCase().includes(f.reference.toLowerCase()));
      if (f.startFrom) data = data.filter(r => r.start_date >= f.startFrom);
      if (f.startTo)   data = data.filter(r => r.start_date <= f.startTo);
      if (f.endFrom)   data = data.filter(r => r.end_date ? r.end_date >= f.endFrom : false);
      if (f.endTo)     data = data.filter(r => r.end_date ? r.end_date <= f.endTo : false);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setActErr('');
    try { await fn(); await load(); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Action failed'); }
  }

  function openNew()                      { setEditing(null); setShowForm(true); }
  function openEdit(r: RecurringInvoice)  { setEditing(r); setShowForm(true); }
  function onSaved()                      { setShowForm(false); load(); }

  function applyFilters() {
    const f = { ...pendingFilters };
    setAppliedFilters(f);
    setShowFilters(false);
    load(f);
  }

  function clearFilters() {
    setPendingFilters({ ...emptyFilters });
    setAppliedFilters({ ...emptyFilters });
    setShowFilters(false);
    load({ ...emptyFilters });
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  }

  function printRI() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Recurring Invoices</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:4px 8px}th{background:#f5f5f5}</style></head><body>
      <h2>Recurring Invoices</h2>
      <table><thead><tr><th>Number</th><th>Customer</th><th>Reference</th><th>Frequency</th><th>Interval</th>
      <th>Start Date</th><th>End Date</th><th>Next Execution</th><th>Last Execution</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r.number}</td><td>${r.customer_name ?? ''}</td><td>${r.reference ?? ''}</td>
        <td>${RI_FREQUENCY_LABELS[r.frequency]}</td><td>${r.interval_num}</td>
        <td>${r.start_date?.slice(0,10) ?? ''}</td><td>${r.end_date?.slice(0,10) ?? '–'}</td>
        <td>${r.next_exec_date?.slice(0,10) ?? '–'}</td><td>${r.last_exec_date?.slice(0,10) ?? '–'}</td>
        <td>${RI_STATUS_LABELS[r.status]}</td></tr>`).join('')}
      </tbody></table></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  function exportToExcel() {
    const headers = ['Number','Customer','Reference','Frequency','Interval','Start Date','End Date','Next Execution','Last Execution','Status'];
    const csvRows = rows.map(r => [
      r.number, r.customer_name ?? '', r.reference ?? '',
      RI_FREQUENCY_LABELS[r.frequency], r.interval_num,
      r.start_date?.slice(0,10) ?? '', r.end_date?.slice(0,10) ?? '',
      r.next_exec_date?.slice(0,10) ?? '', r.last_exec_date?.slice(0,10) ?? '',
      RI_STATUS_LABELS[r.status],
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'recurring-invoices.csv'; a.click();
  }

  if (showForm) return (
        <RecurringInvoiceForm ri={editing} onClose={() => setShowForm(false)} onSaved={onSaved} />
  );

  return (
    <div className="p-6">
      {/* Row 1: Title + Add button */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Recurring Invoices</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600"
        >
          + ADD RECURRING INVOICE
        </button>
      </div>

      {actErr && <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{actErr}</div>}

      {/* Row 2: Filters + Print + Approve + Export */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPendingFilters({ ...appliedFilters }); setShowFilters(true); }}
            className="relative flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
            FILTERS
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={printRI} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            PRINT
          </button>
          <button
            onClick={() => { /* batch approve selected */ }}
            className="flex items-center gap-1 bg-gray-200 text-gray-600 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            APPROVE SELECTED RECURRING INVOICES
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-blue-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-3 w-10">
                <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Number <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Customer <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Reference <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Frequency <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Interval <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Start Date <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">End Date <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Next Execution <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Last Execution <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-orange-500">No record found</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                </td>
                <td className="px-3 py-2 text-xs font-mono">{r.number}</td>
                <td className="px-3 py-2 text-xs">{r.customer_name}</td>
                <td className="px-3 py-2 text-xs">{r.reference ?? '–'}</td>
                <td className="px-3 py-2 text-xs">{RI_FREQUENCY_LABELS[r.frequency]}</td>
                <td className="px-3 py-2 text-xs text-center">{r.interval_num}</td>
                <td className="px-3 py-2 text-xs">{r.start_date?.slice(0,10)}</td>
                <td className="px-3 py-2 text-xs">{r.end_date?.slice(0,10) ?? '–'}</td>
                <td className="px-3 py-2 text-xs">{r.next_exec_date?.slice(0,10) ?? '–'}</td>
                <td className="px-3 py-2 text-xs">{r.last_exec_date?.slice(0,10) ?? '–'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {(r.status === 'active' || r.status === 'paused') && (
                      <button onClick={() => openEdit(r)} title="Edit" className="text-blue-500 hover:text-blue-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    )}
                    {r.status === 'active' && (
                      <>
                        <button onClick={() => act(() => executeRecurringInvoice(r.id))} title="Run Now" className="text-green-500 hover:text-green-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button onClick={() => act(() => pauseRecurringInvoice(r.id))} title="Pause" className="text-yellow-500 hover:text-yellow-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button onClick={() => act(() => cancelRecurringInvoice(r.id))} title="Cancel" className="text-red-400 hover:text-red-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      </>
                    )}
                    {r.status === 'paused' && (
                      <>
                        <button onClick={() => act(() => resumeRecurringInvoice(r.id))} title="Resume" className="text-green-500 hover:text-green-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button onClick={() => act(() => cancelRecurringInvoice(r.id))} title="Cancel" className="text-red-400 hover:text-red-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      </>
                    )}
                    {r.status === 'cancelled' && !r.last_exec_date && (
                      <button onClick={() => act(() => deleteRecurringInvoice(r.id))} title="Delete" className="text-red-400 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                    <span className={`ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${RI_STATUS_COLORS[r.status]}`}>
                      {RI_STATUS_LABELS[r.status]}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FILTERS Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white border-2 border-green-500 rounded-lg shadow-2xl w-full max-w-lg mx-4">
            {/* Floating × */}
            <button
              onClick={() => setShowFilters(false)}
              className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-red-600 z-10"
            >
              ×
            </button>

            <div className="px-6 py-5 space-y-3">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm text-gray-600 text-right">Number</label>
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.number}
                  onChange={e => setPendingFilters(p => ({ ...p, number: e.target.value }))}
                />
              </div>

              {/* Customer */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm text-gray-600 text-right">Customer</label>
                <select
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.customerId}
                  onChange={e => setPendingFilters(p => ({ ...p, customerId: e.target.value }))}
                >
                  <option value="">-All-</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm text-gray-600 text-right">Reference</label>
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.reference}
                  onChange={e => setPendingFilters(p => ({ ...p, reference: e.target.value }))}
                />
              </div>

              {/* Frequency */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm text-gray-600 text-right">Frequency</label>
                <select
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.frequency}
                  onChange={e => setPendingFilters(p => ({ ...p, frequency: e.target.value }))}
                >
                  <option value="">-All-</option>
                  {(['daily','weekly','monthly','quarterly','yearly'] as RIFrequency[]).map(f => (
                    <option key={f} value={f}>{RI_FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>

              {/* Start Date From/To */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm text-gray-600 text-right">Start Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none min-w-0"
                    value={pendingFilters.startFrom} onChange={e => setPendingFilters(p => ({ ...p, startFrom: e.target.value }))} />
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none min-w-0"
                    value={pendingFilters.startTo} onChange={e => setPendingFilters(p => ({ ...p, startTo: e.target.value }))} />
                </div>
              </div>

              {/* Show More */}
              {!showMore && (
                <div className="flex justify-center pt-1">
                  <button onClick={() => setShowMore(true)} className="flex items-center gap-1 bg-green-500 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-600">
                    SHOW MORE
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              )}

              {showMore && (
                <>
                  {/* End Date From/To */}
                  <div className="flex items-center gap-4">
                    <label className="w-36 shrink-0 text-sm text-gray-600 text-right">End Date</label>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500 shrink-0">From:</span>
                      <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none min-w-0"
                        value={pendingFilters.endFrom} onChange={e => setPendingFilters(p => ({ ...p, endFrom: e.target.value }))} />
                      <span className="text-xs text-gray-500 shrink-0">To:</span>
                      <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none min-w-0"
                        value={pendingFilters.endTo} onChange={e => setPendingFilters(p => ({ ...p, endTo: e.target.value }))} />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-4">
                    <label className="w-36 shrink-0 text-sm text-gray-600 text-right">Status</label>
                    <select
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                      value={pendingFilters.status}
                      onChange={e => setPendingFilters(p => ({ ...p, status: e.target.value }))}
                    >
                      <option value="">-All-</option>
                      {(['active','paused','cancelled','completed'] as RIStatus[]).map(s => (
                        <option key={s} value={s}>{RI_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Show Void */}
                  <div className="flex items-center gap-4">
                    <label className="w-36 shrink-0 text-sm text-gray-600 text-right">Show Void</label>
                    <div className="flex-1">
                      <input
                        type="checkbox"
                        checked={pendingFilters.showVoid}
                        onChange={e => setPendingFilters(p => ({ ...p, showVoid: e.target.checked }))}
                        className="w-4 h-4"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3 flex items-center gap-2">
              <button onClick={() => {}} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters} className="flex items-center gap-1 bg-gray-200 text-gray-600 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                APPLY
              </button>
              <button onClick={clearFilters} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

