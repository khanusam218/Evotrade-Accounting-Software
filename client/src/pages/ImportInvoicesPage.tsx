import { apiFetch } from '../api/apiFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImportInvoice, IIStatus } from '../types/importInvoice';
import { II_STATUS_COLORS, II_STATUS_LABELS } from '../types/importInvoice';
import { getImportInvoices, approveImportInvoice, cancelImportInvoice, deleteImportInvoice } from '../api/importInvoices';
import ImportInvoiceForm from '../components/ImportInvoiceForm';

type SortDir = 'asc' | 'desc' | null;
type SortKey = keyof ImportInvoice | '';

interface FilterState {
  number: string; dateFrom: string; dateTo: string;
  reference: string;
  dueDateFrom: string; dueDateTo: string;
  balanceFrom: string; balanceTo: string;
  netFrom: string; netTo: string;
  vendorId: string; status: string;
  productId: string; description: string; serialNumber: string;
  showVoid: boolean;
}
const emptyFilter = (): FilterState => ({
  number: '', dateFrom: '', dateTo: '',
  reference: '',
  dueDateFrom: '', dueDateTo: '',
  balanceFrom: '', balanceTo: '',
  netFrom: '', netTo: '',
  vendorId: '', status: '',
  productId: '', description: '', serialNumber: '',
  showVoid: false,
});

interface Vendor { id: number; print_name: string; }

function SortTh({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-400 text-xs">{active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↕'}</span>
      </span>
    </th>
  );
}

const fmt = (n: number) => Number(n||0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ImportInvoicesPage() {
  const [rows,        setRows]        = useState<ImportInvoice[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [actErr,      setActErr]      = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [draft,       setDraft]       = useState<FilterState>(emptyFilter());
  const [applied,     setApplied]     = useState<FilterState>(emptyFilter());
  const [vendors,     setVendors]     = useState<Vendor[]>([]);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<ImportInvoice | null>(null);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());
  const [sortKey,     setSortKey]     = useState<SortKey>('date');
  const [sortDir,     setSortDir]     = useState<SortDir>('desc');
  const [showActions, setShowActions] = useState(false);
  const [showMore,    setShowMore]    = useState(false);
  const [products,    setProducts]    = useState<{ id: number; name: string }[]>([]);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=1000').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  const load = useCallback(async (f: FilterState) => {
    setLoading(true);
    const p: Record<string, string> = {};
    if (f.number)    p.search    = f.number;
    if (f.status)    p.status    = f.status;
    if (f.vendorId)  p.vendor_id = f.vendorId;
    if (f.reference) p.reference = f.reference;
    try { setRows(await getImportInvoices(p)); setSelected(new Set()); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Load failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(applied); }, [load, applied]);

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

  const filtered = rows.filter(r => {
    const f = applied;
    if (f.dateFrom && r.date && r.date.slice(0,10) < f.dateFrom) return false;
    if (f.dateTo   && r.date && r.date.slice(0,10) > f.dateTo)   return false;
    if (f.dueDateFrom && r.due_date && r.due_date.slice(0,10) < f.dueDateFrom) return false;
    if (f.dueDateTo   && r.due_date && r.due_date.slice(0,10) > f.dueDateTo)   return false;
    if (f.balanceFrom !== '' && Number(r.balance_amount) < Number(f.balanceFrom)) return false;
    if (f.balanceTo   !== '' && Number(r.balance_amount) > Number(f.balanceTo))   return false;
    if (f.netFrom !== '' && Number(r.net_amount) < Number(f.netFrom)) return false;
    if (f.netTo   !== '' && Number(r.net_amount) > Number(f.netTo))   return false;
    if (f.description  && !r.notes?.toLowerCase().includes(f.description.toLowerCase()))  return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortDir || !sortKey) return 0;
    const av = a[sortKey as keyof ImportInvoice] ?? '';
    const bv = b[sortKey as keyof ImportInvoice] ?? '';
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

  async function bulkAct(fn: (id: number) => Promise<unknown>, label: string) {
    if (!selected.size) { alert('Select at least one row'); return; }
    if (!window.confirm(`${label} ${selected.size} selected item(s)?`)) return;
    setShowActions(false);
    await Promise.allSettled([...selected].map(id => fn(id)));
    load(applied);
  }

  function exportCsv() {
    const r = [
      ['Number', 'Date', 'Vendor', 'Reference', 'Due Date', 'Net Amount', 'Balance Amount', 'Status'],
      ...sorted.map(r => [r.number, r.date?.slice(0,10), r.vendor_name, r.reference ?? '', r.due_date?.slice(0,10) ?? '', fmt(r.net_amount), fmt(r.balance_amount), II_STATUS_LABELS[r.status]]),
    ];
    const csv = r.map(row => row.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'import-invoices.csv'; a.click();
  }

  function printList() {
    const w = window.open('', '_blank')!;
    const rows2 = sorted.map(r => `<tr><td>${r.number}</td><td>${r.date?.slice(0,10)}</td><td>${r.vendor_name}</td><td>${r.reference??'—'}</td><td>${r.due_date?.slice(0,10)??'—'}</td><td style="text-align:right">PKR ${fmt(r.net_amount)}</td><td style="text-align:right">PKR ${fmt(r.balance_amount)}</td><td>${II_STATUS_LABELS[r.status]}</td></tr>`).join('');
    const total = sorted.reduce((s, r) => s + Number(r.balance_amount), 0);
    w.document.write(`<html><head><title>Import Invoices</title><style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5}</style></head><body><h2>Import Invoices</h2><table><thead><tr><th>Number</th><th>Date</th><th>Vendor</th><th>Reference</th><th>Due Date</th><th>Net Amount</th><th>Balance Amount</th><th>Status</th></tr></thead><tbody>${rows2}<tr style="font-weight:700"><td colspan="6">Balance Amount:</td><td style="text-align:right">PKR ${fmt(total)}</td><td></td></tr></tbody></table></body></html>`);
    w.document.close(); w.print();
  }

  const hasActiveFilters = Object.entries(applied).some(([k, v]) => k !== 'showVoid' ? Boolean(v) : v === true);

  if (showForm) return (
        <ImportInvoiceForm invoice={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(applied); }} />
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Import Invoices</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          ADD IMPORT INVOICE
        </button>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between gap-2">
        <button onClick={() => { setDraft({ ...applied }); setShowFilters(true); }}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white ${hasActiveFilters ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h4" /></svg>
          FILTERS {hasActiveFilters && <span className="ml-1 bg-white text-green-600 text-xs rounded-full px-1.5 py-0.5 font-bold">●</span>}
        </button>

        <div className="flex items-center gap-2">
          <button onClick={printList}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            PRINT
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            EXPORT TO EXCEL
          </button>
          <div className="relative" ref={actionsRef}>
            <button onClick={() => setShowActions(a => !a)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
              OTHER ACTIONS
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded shadow-lg z-20">
                <button onClick={() => bulkAct(approveImportInvoice, 'Approve')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between">
                  Approve Selected {selected.size > 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{selected.size}</span>}
                </button>
                <button onClick={() => bulkAct(cancelImportInvoice, 'Cancel')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between">
                  Cancel Selected {selected.size > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{selected.size}</span>}
                </button>
                <button onClick={() => bulkAct(deleteImportInvoice, 'Delete')}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between">
                  Delete Selected {selected.size > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{selected.size}</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
                <SortTh label="Number"         sortKey="number"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Date"           sortKey="date"           current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Vendor"         sortKey="vendor_name"    current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Reference"      sortKey="reference"      current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Due Date"       sortKey="due_date"       current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Net Amount"     sortKey="net_amount"     current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Balance Amount" sortKey="balance_amount" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"         sortKey="status"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-6 text-amber-500 text-sm">No record found</td></tr>
              ) : sorted.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${selected.has(r.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} className="h-4 w-4 rounded border-gray-300" />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-blue-600 cursor-pointer hover:underline"
                    onClick={() => { setEditing(r); setShowForm(true); }}>{r.number}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.date?.slice(0,10)}</td>
                  <td className="px-3 py-2 text-gray-800">{r.vendor_name}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.reference ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.due_date?.slice(0,10) ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">PKR {fmt(r.net_amount)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-green-700">PKR {fmt(r.balance_amount)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${II_STATUS_COLORS[r.status]}`}>
                      {II_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 items-center flex-wrap">
                      {r.status === 'draft' && <>
                        <button onClick={() => { setEditing(r); setShowForm(true); }} className="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-600">Edit</button>
                        <button onClick={() => act(() => approveImportInvoice(r.id), 'Approve this invoice?')} className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-200">Approve</button>
                        <button onClick={() => act(() => deleteImportInvoice(r.id), 'Delete this invoice?')} className="text-xs px-2 py-0.5 text-red-500 hover:underline">Delete</button>
                      </>}
                      {r.status === 'approved' && (
                        <button onClick={() => act(() => cancelImportInvoice(r.id), 'Cancel this invoice?')} className="text-xs px-2 py-0.5 text-red-500 hover:underline">Cancel</button>
                      )}
                      {r.status === 'cancelled' && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                <tr>
                  <td colSpan={7} className="px-3 py-2 font-bold text-gray-700 text-sm">Balance Amount:</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-green-700 text-sm whitespace-nowrap">
                    PKR {fmt(sorted.reduce((s, r) => s + Number(r.balance_amount), 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative w-full max-w-xl mx-4 bg-white rounded-lg shadow-2xl border-2 border-green-500">
            <button onClick={() => { setShowFilters(false); setShowMore(false); }}
              className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600 z-10">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="px-6 py-5 space-y-3">

              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search number" value={draft.number}
                  onChange={e => setDraft(d => ({ ...d, number: e.target.value }))} />
              </div>

              {/* Date */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500 w-10 flex-shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateFrom} onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500 w-5 flex-shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateTo} onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))} />
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Reference</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search reference" value={draft.reference}
                  onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} />
              </div>

              {/* Vendor */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Vendor</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.vendorId} onChange={e => setDraft(d => ({ ...d, vendorId: e.target.value }))}>
                  <option value="">Type to search vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                </select>
              </div>

              {/* Due Date */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Due Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500 w-10 flex-shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dueDateFrom} onChange={e => setDraft(d => ({ ...d, dueDateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500 w-5 flex-shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dueDateTo} onChange={e => setDraft(d => ({ ...d, dueDateTo: e.target.value }))} />
                </div>
              </div>

              {/* Balance Amount */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Balance Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500 w-10 flex-shrink-0">From:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={draft.balanceFrom} onChange={e => setDraft(d => ({ ...d, balanceFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500 w-5 flex-shrink-0">To:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={draft.balanceTo} onChange={e => setDraft(d => ({ ...d, balanceTo: e.target.value }))} />
                </div>
              </div>

              {/* Net Amount */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Net Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500 w-10 flex-shrink-0">From:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={draft.netFrom} onChange={e => setDraft(d => ({ ...d, netFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500 w-5 flex-shrink-0">To:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={draft.netTo} onChange={e => setDraft(d => ({ ...d, netTo: e.target.value }))} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                  <option value="">Select status</option>
                  {(['draft','approved','cancelled'] as IIStatus[]).map(s => (
                    <option key={s} value={s}>{II_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* SHOW MORE extra fields */}
              {showMore && <>
                {/* Product */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Product</label>
                  <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.productId} onChange={e => setDraft(d => ({ ...d, productId: e.target.value }))}>
                    <option value="">Type to search product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {/* Description */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Description</label>
                  <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Type to search description" value={draft.description}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                </div>

                {/* Serial Number */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Serial Number</label>
                  <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Type to search serial number" value={draft.serialNumber}
                    onChange={e => setDraft(d => ({ ...d, serialNumber: e.target.value }))} />
                </div>
              </>}

              {/* Show Void + Show More/Less */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={draft.showVoid} onChange={e => setDraft(d => ({ ...d, showVoid: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-green-600" />
                  Show Void
                </label>
                <button type="button" onClick={() => setShowMore(s => !s)}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
                  <svg className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  {showMore ? 'SHOW LESS' : 'SHOW MORE'}
                </button>
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
              <button type="button" onClick={() => { setDraft(emptyFilter()); setShowMore(false); }}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

