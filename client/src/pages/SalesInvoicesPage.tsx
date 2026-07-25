import { apiFetch } from '../api/apiFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import SalesInvoiceDetailView from '../components/SalesInvoiceDetailView';
import InvoicePrintModal from '../components/InvoicePrintModal';
import type { PrintInvoice } from '../components/InvoicePrintModal';
import {
  getSalesInvoices, getSalesInvoice, approveSalesInvoice, cancelSalesInvoice, deleteSalesInvoice,
} from '../api/salesInvoices';
import type { SalesInvoice } from '../types/salesInvoice';
import { SI_STATUS_COLORS, SI_STATUS_LABELS } from '../types/salesInvoice';
import { getSalesDeliveries } from '../api/salesDeliveries';
import type { SalesDelivery } from '../types/salesDelivery';
import { SD_STATUS_COLORS, SD_STATUS_LABELS } from '../types/salesDelivery';

type SortDir = 'asc' | 'desc' | null;
type SortKey = keyof SalesInvoice | '';

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
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-400 text-xs">
          {active && dir === 'asc' ? '↑' : active && dir === 'desc' ? '↓' : '↕'}
        </span>
      </span>
    </th>
  );
}

interface FilterState {
  number: string; dateFrom: string; dateTo: string; reference: string;
  customerId: string; orderId: string; deliveryId: string;
  dueDateFrom: string; dueDateTo: string;
  balanceAmountFrom: string; balanceAmountTo: string;
  status: string; showVoid: boolean;
}
const emptyFilter = (): FilterState => ({
  number: '', dateFrom: '', dateTo: '', reference: '',
  customerId: '', orderId: '', deliveryId: '',
  dueDateFrom: '', dueDateTo: '',
  balanceAmountFrom: '', balanceAmountTo: '',
  status: '', showVoid: false,
});

interface Customer { id: number; print_name: string; }

export default function SalesInvoicesPage() {
  const [records,      setRecords]      = useState<SalesInvoice[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [draft,        setDraft]        = useState<FilterState>(emptyFilter());
  const [applied,      setApplied]      = useState<FilterState>(emptyFilter());
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [showForm,     setShowForm]     = useState(false);
  const [editEntry,    setEditEntry]    = useState<SalesInvoice | null>(null);
  const [detailEntry,  setDetailEntry]  = useState<SalesInvoice | null>(null);
  const [actionId,     setActionId]     = useState<number | null>(null);
  const [printInv,     setPrintInv]     = useState<PrintInvoice | null>(null);
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [deliveriesFor,    setDeliveriesFor]    = useState<SalesInvoice | null>(null);
  const [deliveriesData,   setDeliveriesData]   = useState<SalesDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [sortKey,      setSortKey]      = useState<SortKey>('date');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const [showActions,  setShowActions]  = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [filterOrders,    setFilterOrders]    = useState<{id:number;number:string}[]>([]);
  const [filterDeliveries,setFilterDeliveries]= useState<{id:number;number:string}[]>([]);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/sales-orders?limit=500').then(r => r.json()).then(d => setFilterOrders(Array.isArray(d) ? d : []));
    apiFetch('/api/sales-deliveries?limit=500').then(r => r.json()).then(d => setFilterDeliveries(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
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
      let data = await getSalesInvoices(p);
      if (f.reference)          data = data.filter(r => (r.reference ?? '').toLowerCase().includes(f.reference.toLowerCase()));
      if (f.orderId)            data = data.filter(r => r.order_id === Number(f.orderId));
      if (f.dueDateFrom)        data = data.filter(r => (r.due_date ?? '') >= f.dueDateFrom);
      if (f.dueDateTo)          data = data.filter(r => (r.due_date ?? '') <= f.dueDateTo);
      if (f.balanceAmountFrom)  data = data.filter(r => Number(r.balance_amount) >= Number(f.balanceAmountFrom));
      if (f.balanceAmountTo)    data = data.filter(r => Number(r.balance_amount) <= Number(f.balanceAmountTo));
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
    const av = a[sortKey as keyof SalesInvoice] ?? '';
    const bv = b[sortKey as keyof SalesInvoice] ?? '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const allSelected = sorted.length > 0 && sorted.every(r => selected.has(r.id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sorted.map(r => r.id)));
  }
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

  async function bulkApprove() {
    if (!selected.size) return;
    if (!window.confirm(`Approve ${selected.size} invoice(s)?`)) return;
    const draftIds = sorted.filter(r => selected.has(r.id) && r.status === 'draft').map(r => r.id);
    if (!draftIds.length) { alert('No draft invoices selected.'); return; }
    try { await Promise.all(draftIds.map(id => approveSalesInvoice(id))); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Bulk approve failed'); }
  }

  async function bulkCancel() {
    if (!selected.size) return;
    if (!window.confirm(`Cancel ${selected.size} invoice(s)?`)) return;
    const ids = sorted.filter(r => selected.has(r.id) && ['draft', 'approved'].includes(r.status)).map(r => r.id);
    if (!ids.length) { alert('No cancellable invoices selected.'); return; }
    try { await Promise.all(ids.map(id => cancelSalesInvoice(id))); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Bulk cancel failed'); }
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} invoice(s)?`)) return;
    const ids = sorted.filter(r => selected.has(r.id) && r.status === 'draft').map(r => r.id);
    if (!ids.length) { alert('No draft invoices selected.'); return; }
    try { await Promise.all(ids.map(id => deleteSalesInvoice(id))); fetchRecords(applied); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Bulk delete failed'); }
  }

  function exportCsv() {
    const rows = [
      ['Number', 'Date', 'Customer', 'Reference', 'Due Date', 'Net Amount', 'Paid', 'Balance', 'Status'],
      ...sorted.map(r => [
        r.number, r.date.slice(0, 10), r.customer_name, r.reference ?? '',
        r.due_date?.slice(0, 10) ?? '', r.net_amount, r.paid_amount, r.balance_amount, r.status,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'sale-invoices.csv';
    a.click();
  }

  function printList() {
    const w = window.open('', '_blank')!;
    const rows = sorted.map(r => `
      <tr>
        <td>${r.number}</td>
        <td>${r.date.slice(0,10)}</td>
        <td>${r.customer_name}</td>
        <td>${r.reference ?? ''}</td>
        <td>${r.due_date?.slice(0,10) ?? ''}</td>
        <td style="text-align:right">PKR ${Number(r.net_amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
        <td style="text-align:right">${Number(r.balance_amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
        <td>${SI_STATUS_LABELS[r.status]}</td>
      </tr>`).join('');
    const totalNet = sorted.reduce((s, r) => s + Number(r.net_amount), 0);
    const totalBal = sorted.reduce((s, r) => s + Number(r.balance_amount), 0);
    w.document.write(`<html><head><title>Sale Invoices</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5;font-weight:600}
      .total{font-weight:700;background:#f0f0f0}</style></head>
      <body><h2>Sale Invoices</h2><table>
      <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Reference</th><th>Due Date</th><th>Net Amount</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>${rows}
      <tr class="total"><td colspan="5">Total:</td>
        <td style="text-align:right">PKR ${totalNet.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
        <td style="text-align:right">${totalBal.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
        <td></td></tr>
      </tbody></table></body></html>`);
    w.document.close();
    w.print();
  }

  async function openPrint(r: SalesInvoice) {
    try {
      const full = await getSalesInvoice(r.id);
      setPrintInv({
        number: full.number, date: full.date, due_date: full.due_date,
        reference: full.reference, notes: full.notes,
        party_label: 'Customer', party_name: full.customer_name,
        gross_amount: full.gross_amount, tax_amount: full.tax_amount,
        discount: full.discount, net_amount: full.net_amount,
        paid_amount: full.paid_amount, balance_amount: full.balance_amount,
        status: full.status,
        lines: (full.lines || []).map(l => ({
          description: l.description, quantity: l.quantity, unit_price: l.unit_price,
          discount_pct: l.discount_pct, amount: l.amount,
          tax_name: l.tax_name, tax_amount: l.tax_amount,
        })),
      });
    } catch { alert('Failed to load invoice'); }
  }

  async function openDeliveries(r: SalesInvoice) {
    setDeliveriesFor(r);
    setDeliveriesData([]);
    setDeliveriesLoading(true);
    try {
      const params: Record<string, string> = {};
      if (r.order_id) params.order_id = String(r.order_id);
      else params.customer_id = String(r.customer_id);
      const data = await getSalesDeliveries(params);
      setDeliveriesData(data);
    } catch { setDeliveriesData([]); }
    finally { setDeliveriesLoading(false); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalNet = sorted.reduce((s, r) => s + Number(r.net_amount), 0);
  const totalBal = sorted.reduce((s, r) => s + Number(r.balance_amount), 0);

  if (showForm) return (
        <SalesInvoiceForm
      invoice={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={() => { setShowForm(false); setEditEntry(null); setDetailEntry(null); fetchRecords(applied); }}
    />
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Sale Invoices</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD SALE INVOICE
        </button>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between gap-2">
        {/* Left: FILTERS */}
        <button
          onClick={() => { setDraft({ ...applied }); setShowFilters(true); }}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h4" />
          </svg>
          FILTERS
        </button>

        {/* Right: PRINT | ACTIONS | EXPORT TO EXCEL */}
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

          {/* ACTIONS dropdown */}
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
                <button onClick={() => { setShowActions(false); bulkApprove(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Approve Selected {selected.size > 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 rounded-full px-1.5">{selected.size}</span>}
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
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search number" value={draft.number} onChange={e => setDraft(d => ({ ...d, number: e.target.value }))} />
              </div>

              {/* Date */}
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={draft.dateFrom} onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))} />
                  <span className="text-gray-400 text-sm">To</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dateTo} onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))} />
                </div>
              </div>

              {/* Customer */}
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Customer</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.customerId} onChange={e => setDraft(d => ({ ...d, customerId: e.target.value }))}>
                  <option value="">Type to search customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Reference</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search reference" value={draft.reference} onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} />
              </div>

              {/* Sale Order */}
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Sale Order</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.orderId} onChange={e => setDraft(d => ({ ...d, orderId: e.target.value }))}>
                  <option value="">Type to search sale order</option>
                  {filterOrders.map(o => <option key={o.id} value={o.id}>{o.number}</option>)}
                </select>
              </div>

              {/* Sale Delivery */}
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Sale Delivery</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.deliveryId} onChange={e => setDraft(d => ({ ...d, deliveryId: e.target.value }))}>
                  <option value="">Type to search sale delivery</option>
                  {filterDeliveries.map(d => <option key={d.id} value={d.id}>{d.number}</option>)}
                </select>
              </div>

              {/* Due Date */}
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Due Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dueDateFrom} onChange={e => setDraft(d => ({ ...d, dueDateFrom: e.target.value }))} />
                  <span className="text-gray-400 text-sm">To</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={draft.dueDateTo} onChange={e => setDraft(d => ({ ...d, dueDateTo: e.target.value }))} />
                </div>
              </div>

              {/* Balance Amount */}
              <div className="flex items-center gap-3">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Balance Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={draft.balanceAmountFrom} onChange={e => setDraft(d => ({ ...d, balanceAmountFrom: e.target.value }))} />
                  <span className="text-gray-400 text-sm">To</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={draft.balanceAmountTo} onChange={e => setDraft(d => ({ ...d, balanceAmountTo: e.target.value }))} />
                </div>
              </div>

              {/* Show Void */}
              <div className="flex items-center gap-3">
                <label className="w-32" />
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={draft.showVoid} onChange={e => setDraft(d => ({ ...d, showVoid: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-green-600" />
                  Show Void
                </label>
                <button type="button" onClick={() => setShowMoreFilters(v => !v)}
                  className="ml-auto flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded">
                  {showMoreFilters ? '▲ SHOW LESS' : '▼ SHOW MORE'}
                </button>
              </div>

              {/* SHOW MORE section */}
              {showMoreFilters && (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-3">
                    <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                    <select className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                      <option value="">Select status</option>
                      <option value="draft">Draft</option>
                      <option value="approved">Approved</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="paid">Paid</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              )}

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

      {/* Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
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
            <table className="w-full divide-y divide-gray-200 text-xs" style={{tableLayout:'fixed', minWidth:'1400px'}}>
              <colgroup>
                <col style={{width:'40px'}} />
                <col style={{width:'120px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'15%'}} />
                <col style={{width:'115px'}} />
                <col style={{width:'95px'}} />
                <col style={{width:'95px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'130px'}} />
                <col style={{width:'130px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'130px'}} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 w-9">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                  </th>
                  <SortTh label="Number"         sortKey="number"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Date"           sortKey="date"           current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Customer"       sortKey="customer_name"  current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Reference"      sortKey="reference"      current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deliveries</th>
                  <SortTh label="Due Date"       sortKey="due_date"       current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Net Amount"     sortKey="net_amount"     current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortTh label="Balance Amount" sortKey="balance_amount" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortTh label="Status"         sortKey="status"         current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-sm">
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
                      <button
                        onClick={() => setDetailEntry(r)}
                        className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                      >{r.number}</button>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-1.5 text-xs text-blue-600 font-medium truncate">{r.customer_name}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 truncate">{r.reference ?? '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">—</td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        title="Show Invoice Deliveries"
                        onClick={() => openDeliveries(r)}
                        className="text-gray-400 hover:text-blue-600 text-lg transition-colors"
                      >☰</button>
                    </td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                      {r.due_date ? (
                        <span className={r.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                          {r.due_date.slice(0, 10)}
                          {r.is_overdue && <span className="ml-1 text-xs bg-red-100 text-red-700 rounded px-1">Overdue</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold whitespace-nowrap">
                      PKR {fmt(r.net_amount)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap">
                      <span className={Number(r.balance_amount) === 0 && r.status === 'paid' ? 'text-green-600 font-semibold' : ''}>
                        {fmt(r.balance_amount)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SI_STATUS_COLORS[r.status]}`}>
                        {SI_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openPrint(r)}
                          className="rounded px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                          Print
                        </button>
                        {r.status === 'draft' && (
                          <>
                            <button onClick={() => { setEditEntry(r); setShowForm(true); }}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50">Edit</button>
                            <button onClick={() => act(r.id, () => approveSalesInvoice(r.id), `Approve "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-green-600 border border-green-200 hover:bg-green-50 disabled:opacity-50">
                              {actionId === r.id ? '…' : 'Approve'}
                            </button>
                            <button onClick={() => act(r.id, () => deleteSalesInvoice(r.id), `Delete "${r.number}"?`)}
                              disabled={actionId === r.id}
                              className="rounded px-2 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">Del</button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button onClick={() => act(r.id, () => cancelSalesInvoice(r.id), `Cancel "${r.number}"?`)}
                            disabled={actionId === r.id}
                            className="rounded px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                            {actionId === r.id ? '…' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {sorted.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={8} className="px-2 py-2 text-xs font-bold text-gray-700">Total:</td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-bold text-gray-900 whitespace-nowrap">
                      PKR {fmt(totalNet)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-bold text-gray-900 whitespace-nowrap">
                      {fmt(totalBal)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {detailEntry && !showForm && (
        <SalesInvoiceDetailView
          invoice={detailEntry}
          onClose={() => setDetailEntry(null)}
          onEdit={() => { setEditEntry(detailEntry); setShowForm(true); }}
          onRefresh={() => fetchRecords(applied)}
        />
      )}

      {printInv && (
        <InvoicePrintModal
          invoice={printInv}
          title="Sales Invoice"
          onClose={() => setPrintInv(null)}
        />
      )}

      {/* Deliveries Popup */}
      {deliveriesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeliveriesFor(null)}>
          <div className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Invoice Deliveries</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Invoice: <span className="font-mono font-semibold text-blue-600">{deliveriesFor.number}</span>
                  {deliveriesFor.order_id ? ` · Order linked` : ` · By customer`}
                </p>
              </div>
              <button
                onClick={() => setDeliveriesFor(null)}
                className="h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 max-h-80 overflow-auto">
              {deliveriesLoading ? (
                <div className="flex justify-center py-10">
                  <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
              ) : deliveriesData.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No deliveries found for this invoice.</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-th whitespace-nowrap">Number</th>
                      <th className="table-th whitespace-nowrap">Date</th>
                      <th className="table-th whitespace-nowrap">Warehouse</th>
                      <th className="table-th whitespace-nowrap">Reference</th>
                      <th className="table-th whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deliveriesData.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="table-td font-mono text-xs font-semibold text-blue-600">{d.number}</td>
                        <td className="table-td text-gray-600 whitespace-nowrap">{d.date.slice(0, 10)}</td>
                        <td className="table-td text-gray-600">{d.warehouse_name ?? '—'}</td>
                        <td className="table-td text-gray-500">{d.reference ?? '—'}</td>
                        <td className="table-td">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SD_STATUS_COLORS[d.status]}`}>
                            {SD_STATUS_LABELS[d.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg text-xs text-gray-400 text-right">
              {deliveriesData.length} delivery record{deliveriesData.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

