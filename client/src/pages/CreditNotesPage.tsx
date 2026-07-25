import { useCallback, useEffect, useState } from 'react';
import CreditNoteForm from '../components/CreditNoteForm';
import {
  approveCreditNote, cancelCreditNote, deleteCreditNote, getCreditNotes,
} from '../api/creditNotes';
import type { CreditNote } from '../types/creditNote';
import { CN_STATUS_COLORS, CN_STATUS_LABELS } from '../types/creditNote';

const SortIcon = () => (
  <svg className="inline-block w-3 h-3 ml-1 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

interface Filters {
  number: string;
  dateFrom: string;
  dateTo: string;
  contact: string;
  reference: string;
  account: string;
  amountFrom: string;
  amountTo: string;
  unadjustedFrom: string;
  unadjustedTo: string;
  status: string;
  showVoid: boolean;
}

const EMPTY_FILTERS: Filters = {
  number: '', dateFrom: '', dateTo: '', contact: '', reference: '', account: '',
  amountFrom: '', amountTo: '', unadjustedFrom: '', unadjustedTo: '', status: '', showVoid: false,
};

function printCreditNotes(rows: CreditNote[]) {
  const win=window.open('','_blank','width=1000,height=680');if(!win)return;
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Credit Notes</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Credit Notes</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Reference</th><th>Contact</th><th>Account</th><th class="r">Amount</th><th class="r">Unadjusted</th><th>Status</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.number}</td><td>${new Date(r.date).toLocaleDateString('en-GB')}</td><td>${r.reference??''}</td><td>${r.contact_name??''}</td><td>${r.account_name??''}</td><td class="r">${f(Number(r.amount||0))}</td><td class="r">${f(Number(r.unadjusted_amount||0))}</td><td>${r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();win.focus();setTimeout(()=>win.print(),400);
}

function exportCreditNotesToExcel(rows: CreditNote[]) {
  const esc=(v:string|null|undefined)=>{const s=v??'';return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s;};
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  const csv=[['Number','Date','Reference','Contact','Account','Amount','Unadjusted Amount','Status'].join(','),...rows.map(r=>[esc(r.number),new Date(r.date).toLocaleDateString('en-GB'),esc(r.reference),esc(r.contact_name),esc(r.account_name),f(Number(r.amount||0)),f(Number(r.unadjusted_amount||0)),esc(r.status)].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='CreditNotes.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function CreditNotesPage() {
  const [notes, setNotes]         = useState<CreditNote[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [pendingFilters, setPendingFilters]   = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters]   = useState<Filters>(EMPTY_FILTERS);

  const [showForm, setShowForm]   = useState(false);
  const [editEntry, setEditEntry] = useState<CreditNote | null>(null);
  const [actionId, setActionId]   = useState<number | null>(null);
  const [formKey, setFormKey]     = useState(0);

  const fetchNotes = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getCreditNotes({
        status:    appliedFilters.status   || undefined,
        search:    appliedFilters.number   || undefined,
        date_from: appliedFilters.dateFrom || undefined,
        date_to:   appliedFilters.dateTo   || undefined,
      });
      setNotes(data);
    } catch (err: unknown) {
      setError(`Failed to load credit notes: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, [appliedFilters]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Client-side post-filters
  const visibleNotes = notes.filter((cn) => {
    if (appliedFilters.contact   && !cn.contact_name.toLowerCase().includes(appliedFilters.contact.toLowerCase())) return false;
    if (appliedFilters.reference && !String(cn.reference ?? '').toLowerCase().includes(appliedFilters.reference.toLowerCase())) return false;
    if (appliedFilters.account   && !String(cn.account_name ?? '').toLowerCase().includes(appliedFilters.account.toLowerCase())) return false;
    if (appliedFilters.amountFrom    && Number(cn.amount) < Number(appliedFilters.amountFrom)) return false;
    if (appliedFilters.amountTo      && Number(cn.amount) > Number(appliedFilters.amountTo))   return false;
    if (appliedFilters.unadjustedFrom && Number(cn.unadjusted_amount) < Number(appliedFilters.unadjustedFrom)) return false;
    if (appliedFilters.unadjustedTo   && Number(cn.unadjusted_amount) > Number(appliedFilters.unadjustedTo))   return false;
    if (!appliedFilters.showVoid && cn.status === 'cancelled') return false;
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

  async function handleApprove(cn: CreditNote) {
    if (!window.confirm(`Approve "${cn.number}"? This will post: Debit ${cn.account_name}, Credit A/R.`)) return;
    setActionId(cn.id);
    try { await approveCreditNote(cn.id); fetchNotes(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleCancel(cn: CreditNote) {
    const msg = cn.status === 'approved'
      ? `Cancel "${cn.number}"? This will reverse account balance changes.`
      : `Cancel "${cn.number}"?`;
    if (!window.confirm(msg)) return;
    setActionId(cn.id);
    try { await cancelCreditNote(cn.id); fetchNotes(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleDelete(cn: CreditNote) {
    if (!window.confirm(`Delete "${cn.number}"? This cannot be undone.`)) return;
    setActionId(cn.id);
    try { await deleteCreditNote(cn.id); fetchNotes(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPendingFilters((f) => ({ ...f, [key]: e.target.value }));

  if (showForm) return (
        <CreditNoteForm
      key={formKey}
      creditNote={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={(addNew) => {
        fetchNotes();
        if (addNew) { setEditEntry(null); setFormKey((k) => k + 1); }
        else { setShowForm(false); setEditEntry(null); }
      }}
    />
  );

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Credit Notes</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          ADD CREDIT NOTE
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 pb-4">
        <button
          onClick={openFilters}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white ${
            hasActiveFilters ? 'bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
          }`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2" />
          </svg>
          FILTERS
          {hasActiveFilters && (
            <span className="bg-white text-blue-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {Object.entries(appliedFilters).filter(([k, v]) => k === 'showVoid' ? v === true : v !== '').length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => printCreditNotes(visibleNotes)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => exportCreditNotesToExcel(visibleNotes)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-3 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Number <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Date <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Reference <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Contact <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Account <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Amount <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Unadjusted Amount <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleNotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-sm text-orange-500">No record found</td>
                </tr>
              ) : (
                visibleNotes.map((cn) => (
                  <tr key={cn.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{cn.number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(cn.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{cn.reference ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{cn.contact_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{cn.account_name}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{fmt(cn.amount)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{fmt(cn.unadjusted_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CN_STATUS_COLORS[cn.status]}`}>
                        {CN_STATUS_LABELS[cn.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {cn.status === 'draft' && (
                          <>
                            <button onClick={() => { setEditEntry(cn); setShowForm(true); }}
                              title="Edit" className="text-gray-400 hover:text-blue-600">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleApprove(cn)} disabled={actionId === cn.id}
                              title="Approve" className="text-gray-400 hover:text-green-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(cn)} disabled={actionId === cn.id}
                              title="Delete" className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                        {cn.status === 'approved' && (
                          <button onClick={() => handleCancel(cn)} disabled={actionId === cn.id}
                            title="Cancel" className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        {cn.status === 'cancelled' && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

              {/* Contact */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Contact</label>
                <div className="flex-1 relative">
                  <input type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                    placeholder="Type to search contact"
                    value={pendingFilters.contact} onChange={set('contact')} />
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
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

              {/* Account */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Account</label>
                <div className="flex-1 relative">
                  <input type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 pr-8"
                    placeholder="Type to search account"
                    value={pendingFilters.account} onChange={set('account')} />
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Amount From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Amount</label>
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

              {/* Unadjusted Amount From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Unadjusted Amount</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="number"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="From"
                    value={pendingFilters.unadjustedFrom} onChange={set('unadjustedFrom')} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="number"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="To"
                    value={pendingFilters.unadjustedTo} onChange={set('unadjustedTo')} />
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

              {/* Show Void */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="cnShowVoid"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  checked={pendingFilters.showVoid}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, showVoid: e.target.checked }))} />
                <label htmlFor="cnShowVoid" className="text-sm font-medium text-gray-700 cursor-pointer">Show Void</label>
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
