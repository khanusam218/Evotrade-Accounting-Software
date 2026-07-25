import { useCallback, useEffect, useState } from 'react';
import OtherPaymentForm from '../components/OtherPaymentForm';
import {
  approveOtherPayment, cancelOtherPayment,
  deleteOtherPayment, getOtherPayments,
} from '../api/otherPayments';
import { getBankAccountsLookup } from '../api/bankAccounts';
import type { OtherPayment } from '../types/otherTransaction';
import type { BankAccount } from '../types/bankAccount';

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  approved:  'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function SortIcon() {
  return (
    <svg className="inline-block ml-1 w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
    </svg>
  );
}

interface Filters {
  number: string;
  dateFrom: string;
  dateTo: string;
  reference: string;
  contact: string;
  amountFrom: string;
  amountTo: string;
  bankAccountId: string;
  status: string;
  instrument: string;
  showVoid: boolean;
}

const EMPTY_FILTERS: Filters = {
  number: '', dateFrom: '', dateTo: '', reference: '', contact: '',
  amountFrom: '', amountTo: '', bankAccountId: '', status: '', instrument: '', showVoid: false,
};

function printOtherPayments(rows: OtherPayment[]) {
  const win=window.open('','_blank','width=1000,height=680');if(!win)return;
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Other Payments</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Other Payments</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Reference</th><th>Other Contact</th><th>Account</th><th class="r">Total Amount</th><th>Status</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.number}</td><td>${new Date(r.date).toLocaleDateString()}</td><td>${r.reference??''}</td><td>${r.contact_name??''}</td><td>${r.bank_account_name??''}</td><td class="r">${f(Number(r.total_amount||0))}</td><td>${r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();win.focus();setTimeout(()=>win.print(),400);
}

function exportOtherPaymentsToExcel(rows: OtherPayment[]) {
  const esc=(v:string|null|undefined)=>{const s=v??'';return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s;};
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  const csv=[['Number','Date','Reference','Other Contact','Account','Total Amount','Status'].join(','),...rows.map(r=>[esc(r.number),new Date(r.date).toLocaleDateString(),esc(r.reference),esc(r.contact_name),esc(r.bank_account_name),f(Number(r.total_amount||0)),esc(r.status)].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='OtherPayments.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function OtherPaymentsPage() {
  const [payments, setPayments]         = useState<OtherPayment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [pendingFilters, setPendingFilters]   = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters]   = useState<Filters>(EMPTY_FILTERS);

  const [showForm, setShowForm]   = useState(false);
  const [editEntry, setEditEntry] = useState<OtherPayment | null>(null);
  const [formKey, setFormKey]     = useState(0);
  const [actionId, setActionId]   = useState<number | null>(null);

  useEffect(() => {
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getOtherPayments({
        status:    appliedFilters.status   || undefined,
        search:    appliedFilters.number   || undefined,
        date_from: appliedFilters.dateFrom || undefined,
        date_to:   appliedFilters.dateTo   || undefined,
      });
      setPayments(data);
    } catch (err: unknown) {
      setError(`Failed to load payments: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, [appliedFilters]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Client-side post-filters
  const visiblePayments = payments.filter((op) => {
    if (appliedFilters.reference    && !String(op.reference ?? '').toLowerCase().includes(appliedFilters.reference.toLowerCase())) return false;
    if (appliedFilters.contact      && !op.contact_name.toLowerCase().includes(appliedFilters.contact.toLowerCase())) return false;
    if (appliedFilters.amountFrom   && Number(op.total_amount) < Number(appliedFilters.amountFrom)) return false;
    if (appliedFilters.amountTo     && Number(op.total_amount) > Number(appliedFilters.amountTo))   return false;
    if (appliedFilters.bankAccountId && String(op.bank_account_id) !== appliedFilters.bankAccountId) return false;
    if (appliedFilters.instrument   && !(op.instruments ?? []).some((i) =>
      i.instrument_no?.toLowerCase().includes(appliedFilters.instrument.toLowerCase()))) return false;
    if (!appliedFilters.showVoid    && op.status === 'cancelled') return false;
    return true;
  });

  function openFilters() {
    setPendingFilters(appliedFilters);
    setShowFilterModal(true);
  }

  function applyFilters() {
    setAppliedFilters(pendingFilters);
    setShowFilterModal(false);
  }

  function clearPending() {
    setPendingFilters(EMPTY_FILTERS);
  }

  const hasActiveFilters = Object.entries(appliedFilters).some(([k, v]) =>
    k === 'showVoid' ? v === true : v !== ''
  );

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPendingFilters((f) => ({ ...f, [key]: e.target.value }));

  async function handleApprove(op: OtherPayment) {
    if (!window.confirm(`Approve "${op.number}"? This will update account balances.`)) return;
    setActionId(op.id);
    try { await approveOtherPayment(op.id); fetchPayments(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to approve'); }
    finally { setActionId(null); }
  }

  async function handleCancel(op: OtherPayment) {
    const msg = op.status === 'approved'
      ? `Cancel "${op.number}"? This will reverse account balance changes.`
      : `Cancel "${op.number}"?`;
    if (!window.confirm(msg)) return;
    setActionId(op.id);
    try { await cancelOtherPayment(op.id); fetchPayments(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to cancel'); }
    finally { setActionId(null); }
  }

  async function handleDelete(op: OtherPayment) {
    if (!window.confirm(`Delete "${op.number}"? This cannot be undone.`)) return;
    setActionId(op.id);
    try { await deleteOtherPayment(op.id); fetchPayments(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setActionId(null); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  if (showForm) return (
        <OtherPaymentForm
      key={formKey}
      record={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={(addNew) => {
        fetchPayments();
        if (addNew) { setEditEntry(null); setFormKey((k) => k + 1); }
        else { setShowForm(false); setEditEntry(null); }
      }}
    />
  );

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Page header */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-3">
        <h1 className="text-lg font-bold text-gray-800">Other Payments</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD OTHER PAYMENTS
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-white border-b border-gray-200 px-6 py-2">
        <button
          onClick={openFilters}
          className={`flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-1.5 rounded ${
            hasActiveFilters ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          FILTERS
          {hasActiveFilters && (
            <span className="bg-white text-blue-600 text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">
              {Object.entries(appliedFilters).filter(([k, v]) => k === 'showVoid' ? v === true : v !== '').length}
            </span>
          )}
        </button>

        <div className="flex-1" />

        <button className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => printOtherPayments(visiblePayments)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          PRINT
        </button>
        <button className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => exportOtherPaymentsToExcel(visiblePayments)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          EXPORT TO EXCEL
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Number <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Date <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Reference <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Other Contact <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Account <SortIcon /></th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Total Amount <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Status <SortIcon /></th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-orange-500 font-medium">No record found</td>
                  </tr>
                ) : (
                  visiblePayments.map((op) => (
                    <tr key={op.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{op.number}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {new Date(op.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{op.reference ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-800">{op.contact_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">
                        <div>{op.bank_account_name}</div>
                        {op.bank_name && <div className="text-xs text-gray-400">{op.bank_name}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(op.total_amount)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[op.status] ?? ''}`}>
                          {op.status.charAt(0).toUpperCase() + op.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {op.status === 'draft' && (
                            <>
                              <button title="Edit" onClick={() => { setEditEntry(op); setShowForm(true); }}
                                className="p-1 rounded text-blue-500 hover:bg-blue-50 border border-blue-200">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button title="Approve" onClick={() => handleApprove(op)} disabled={actionId === op.id}
                                className="p-1 rounded text-green-600 hover:bg-green-50 border border-green-200 disabled:opacity-50">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button title="Delete" onClick={() => handleDelete(op)} disabled={actionId === op.id}
                                className="p-1 rounded text-red-500 hover:bg-red-50 border border-red-200 disabled:opacity-50">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                          {op.status === 'approved' && (
                            <button title="Cancel" onClick={() => handleCancel(op)} disabled={actionId === op.id}
                              className="p-1 rounded text-gray-500 hover:bg-gray-100 border border-gray-300 disabled:opacity-50">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          {op.status === 'cancelled' && <span className="text-xs text-gray-400">—</span>}
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

      {/* Splendid Filters Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white rounded-lg border-2 border-green-400 shadow-2xl w-full max-w-lg mx-4">
            {/* Red × close button */}
            <button
              onClick={() => setShowFilterModal(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm font-bold z-10">
              ×
            </button>

            <div className="p-6 space-y-4">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Number</label>
                <input type="text"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Type to search number"
                  value={pendingFilters.number} onChange={set('number')} />
              </div>

              {/* Date From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="date"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateFrom} onChange={set('dateFrom')} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="date"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateTo} onChange={set('dateTo')} />
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Reference</label>
                <input type="text"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Type to search reference"
                  value={pendingFilters.reference} onChange={set('reference')} />
              </div>

              {/* Other Contact */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Other Contact</label>
                <div className="flex-1 relative">
                  <input type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                    placeholder="Type to search other contact"
                    value={pendingFilters.contact} onChange={set('contact')} />
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Total Amount From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Total Amount</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="number"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="From"
                    value={pendingFilters.amountFrom} onChange={set('amountFrom')} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="number"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="To"
                    value={pendingFilters.amountTo} onChange={set('amountTo')} />
                </div>
              </div>

              {/* Account */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Account</label>
                <div className="flex-1 relative">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none bg-white pr-8"
                    value={pendingFilters.bankAccountId} onChange={set('bankAccountId')}>
                    <option value="">Select account</option>
                    {bankAccounts.map((ba) => (
                      <option key={ba.id} value={String(ba.id)}>{ba.name}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Status</label>
                <div className="flex-1 relative">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none bg-white pr-8"
                    value={pendingFilters.status} onChange={set('status')}>
                    <option value="">Select status</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Instrument */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Instrument</label>
                <div className="flex-1 relative">
                  <input type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                    placeholder="Type to search instrument"
                    value={pendingFilters.instrument} onChange={set('instrument')} />
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Show Void */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="opShowVoid"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  checked={pendingFilters.showVoid}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, showVoid: e.target.checked }))} />
                <label htmlFor="opShowVoid" className="text-sm font-medium text-gray-700 cursor-pointer">Show Void</label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-6 pb-5">
              <button onClick={applyFilters}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                </svg>
                APPLY
              </button>
              <button onClick={clearPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
