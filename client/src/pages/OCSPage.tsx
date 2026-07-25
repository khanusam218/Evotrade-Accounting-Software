import { useCallback, useEffect, useState } from 'react';
import OCSForm from '../components/OCSForm';
import {
  approveOCSSettlement, cancelOCSSettlement, deleteOCSSettlement, getOCSSettlements,
} from '../api/ocsSettlements';
import type { OCSSettlement } from '../types/ocsSettlement';
import { OCS_STATUS_COLORS, OCS_STATUS_LABELS } from '../types/ocsSettlement';

interface Filters {
  number: string;
  dateFrom: string;
  dateTo: string;
  contact: string;
  amountFrom: string;
  amountTo: string;
  status: string;
  showVoid: boolean;
}

function emptyFilters(): Filters {
  return {
    number: '', dateFrom: '', dateTo: '', contact: '',
    amountFrom: '', amountTo: '', status: '', showVoid: false,
  };
}

function SortIcon() {
  return (
    <svg className="inline-block ml-1 w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
    </svg>
  );
}

function printOCSSettlements(rows: OCSSettlement[]) {
  const win=window.open('','_blank','width=1000,height=680');if(!win)return;
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Other Contact Settlements</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Other Contact Settlements</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Contact</th><th>Reference</th><th class="r">Total Receivable</th><th class="r">Total Received</th><th>Status</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.number}</td><td>${new Date(r.date).toLocaleDateString()}</td><td>${r.contact_name??''}</td><td>${r.reference??''}</td><td class="r">${f(Number(r.total_receivable||0))}</td><td class="r">${f(Number(r.total_received||0))}</td><td>${r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();win.focus();setTimeout(()=>win.print(),400);
}

function exportOCSSettlementsToExcel(rows: OCSSettlement[]) {
  const esc=(v:string|null|undefined)=>{const s=v??'';return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s;};
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  const csv=[['Number','Date','Contact','Reference','Total Receivable','Total Received','Status'].join(','),...rows.map(r=>[esc(r.number),new Date(r.date).toLocaleDateString(),esc(r.contact_name),esc(r.reference),f(Number(r.total_receivable||0)),f(Number(r.total_received||0)),esc(r.status)].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='OCSSettlements.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function OCSPage() {
  const [allRecords, setAllRecords]   = useState<OCSSettlement[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error,   setError]           = useState<string | null>(null);

  const [showModal,  setShowModal]    = useState(false);
  const [pending,    setPending]      = useState<Filters>(emptyFilters());
  const [applied,    setApplied]      = useState<Filters>(emptyFilters());

  const [showForm,  setShowForm]      = useState(false);
  const [editEntry, setEditEntry]     = useState<OCSSettlement | null>(null);
  const [formKey,   setFormKey]       = useState(0);
  const [actionId,  setActionId]      = useState<number | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getOCSSettlements({
        status:    applied.status   || undefined,
        search:    applied.contact  || applied.number || undefined,
        date_from: applied.dateFrom || undefined,
        date_to:   applied.dateTo   || undefined,
      });
      setAllRecords(data);
    } catch (err: unknown) {
      setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, [applied]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Client-side filters for number, contact, amount range, showVoid
  const records = allRecords.filter((s) => {
    if (applied.number  && !s.number.toLowerCase().includes(applied.number.toLowerCase())) return false;
    if (applied.contact && !s.contact_name.toLowerCase().includes(applied.contact.toLowerCase())) return false;
    if (applied.amountFrom && s.total_receivable < parseFloat(applied.amountFrom)) return false;
    if (applied.amountTo   && s.total_receivable > parseFloat(applied.amountTo))   return false;
    if (!applied.showVoid  && s.status === 'cancelled') return false;
    return true;
  });

  function openModal()        { setPending({ ...applied }); setShowModal(true); }
  function handleApplyModal() { setApplied({ ...pending }); setShowModal(false); }
  function handleClear()      { setPending(emptyFilters()); }
  function handleSaveFilter() { setApplied({ ...pending }); setShowModal(false); }

  const hasActiveFilters = Object.entries(applied).some(([k, v]) =>
    k === 'showVoid' ? v === true : Boolean(v)
  );

  async function handleApprove(s: OCSSettlement) {
    if (!window.confirm(`Approve "${s.number}"?`)) return;
    setActionId(s.id);
    try { await approveOCSSettlement(s.id); fetchRecords(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleCancel(s: OCSSettlement) {
    if (!window.confirm(`Cancel "${s.number}"?`)) return;
    setActionId(s.id);
    try { await cancelOCSSettlement(s.id); fetchRecords(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleDelete(s: OCSSettlement) {
    if (!window.confirm(`Delete "${s.number}"? This cannot be undone.`)) return;
    setActionId(s.id);
    try { await deleteOCSSettlement(s.id); fetchRecords(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  if (showForm) return (
        <OCSForm
      key={formKey}
      settlement={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={(addNew) => {
        fetchRecords();
        if (addNew) { setEditEntry(null); setFormKey((k) => k + 1); }
        else { setShowForm(false); setEditEntry(null); }
      }}
    />
  );

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Page header */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-6 py-3">
        <h1 className="text-lg font-bold text-gray-800">Other Contact Settlements</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD OTHER CONTACT SETTLEMENT
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-white border-b border-gray-200 px-6 py-2">
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          FILTERS
          {hasActiveFilters && (
            <span className="bg-white text-blue-600 text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">!</span>
          )}
        </button>

        <div className="flex-1" />

        <button className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => printOCSSettlements(records)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          PRINT
        </button>

        <button className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => exportOCSSettlementsToExcel(records)}>
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
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">Number <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">Date <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">Contact <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">Reference <SortIcon /></th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">Total Receivable <SortIcon /></th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">Total Received <SortIcon /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">Status <SortIcon /></th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-orange-500 font-medium">
                      No record found
                    </td>
                  </tr>
                ) : (
                  records.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{s.number}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-gray-800">{s.contact_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{s.reference ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(s.total_receivable)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(s.total_received)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${OCS_STATUS_COLORS[s.status]}`}>
                          {OCS_STATUS_LABELS[s.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {s.status === 'draft' && (
                            <>
                              <button title="Edit" onClick={() => { setEditEntry(s); setShowForm(true); }}
                                className="p-1 rounded text-blue-500 hover:bg-blue-50 border border-blue-200">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button title="Approve" onClick={() => handleApprove(s)} disabled={actionId === s.id}
                                className="p-1 rounded text-green-600 hover:bg-green-50 border border-green-200 disabled:opacity-50">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button title="Delete" onClick={() => handleDelete(s)} disabled={actionId === s.id}
                                className="p-1 rounded text-red-500 hover:bg-red-50 border border-red-200 disabled:opacity-50">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                          {(s.status === 'approved' || s.status === 'completed') && (
                            <button title="Cancel" onClick={() => handleCancel(s)} disabled={actionId === s.id}
                              className="p-1 rounded text-gray-500 hover:bg-gray-100 border border-gray-300 disabled:opacity-50">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          {s.status === 'cancelled' && <span className="text-xs text-gray-400">—</span>}
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

      {/* ── Filter Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white border-2 border-green-400 rounded-lg shadow-xl w-full max-w-lg mx-4">

            {/* Red × close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm font-bold shadow"
            >
              ×
            </button>

            <div className="p-6 space-y-4">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">Number</label>
                <input
                  type="text"
                  placeholder="Type to search number"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pending.number}
                  onChange={(e) => setPending((p) => ({ ...p, number: e.target.value }))}
                />
              </div>

              {/* Date From/To */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input
                    type="date"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.dateFrom}
                    onChange={(e) => setPending((p) => ({ ...p, dateFrom: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">To:</span>
                  <input
                    type="date"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.dateTo}
                    onChange={(e) => setPending((p) => ({ ...p, dateTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">Contact</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded px-3 py-2 bg-white focus-within:ring-1 focus-within:ring-blue-400">
                  <input
                    type="text"
                    placeholder="Type to search contact"
                    className="flex-1 text-sm outline-none bg-transparent"
                    value={pending.contact}
                    onChange={(e) => setPending((p) => ({ ...p, contact: e.target.value }))}
                  />
                  <svg className="w-4 h-4 text-gray-400 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Total Amount From/To */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">Total Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input
                    type="number"
                    placeholder="From"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.amountFrom}
                    onChange={(e) => setPending((p) => ({ ...p, amountFrom: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">To:</span>
                  <input
                    type="number"
                    placeholder="To"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.amountTo}
                    onChange={(e) => setPending((p) => ({ ...p, amountTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">Status</label>
                <select
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pending.status}
                  onChange={(e) => setPending((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="">Select status</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Show Void */}
              <div className="flex items-center gap-3 pl-36">
                <input
                  type="checkbox"
                  id="ocsShowVoid"
                  className="w-4 h-4 accent-blue-600"
                  checked={pending.showVoid}
                  onChange={(e) => setPending((p) => ({ ...p, showVoid: e.target.checked }))}
                />
                <label htmlFor="ocsShowVoid" className="text-sm font-medium text-gray-700">Show Void</label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
              {/* SAVE FILTER */}
              <button
                onClick={handleSaveFilter}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                SAVE FILTER
              </button>

              {/* APPLY */}
              <button
                onClick={handleApplyModal}
                className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                APPLY
              </button>

              {/* CLEAR */}
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
