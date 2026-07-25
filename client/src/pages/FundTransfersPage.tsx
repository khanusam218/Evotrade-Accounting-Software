import { useCallback, useEffect, useState } from 'react';
import FundTransferForm from '../components/FundTransferForm';
import {
  cancelFundTransfer, deleteFundTransfer,
  getFundTransfers, postFundTransfer,
} from '../api/fundTransfers';
import type { FundTransfer } from '../types/fundTransfer';
import { FT_STATUS_COLORS, FT_STATUS_LABELS } from '../types/fundTransfer';

interface Filters {
  number: string;
  dateFrom: string;
  dateTo: string;
  fromAccount: string;
  toAccount: string;
  reference: string;
  amountFrom: string;
  amountTo: string;
  status: string;
  showVoid: boolean;
}

function emptyFilters(): Filters {
  return {
    number: '', dateFrom: '', dateTo: '',
    fromAccount: '', toAccount: '', reference: '',
    amountFrom: '', amountTo: '', status: '', showVoid: false,
  };
}

const SortIcon = () => (
  <svg className="inline-block w-3 h-3 ml-1 opacity-60" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

function printFundTransfers(rows: FundTransfer[]) {
  const win=window.open('','_blank','width=1000,height=680');if(!win)return;
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fund Transfers</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Fund Transfers</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Reference</th><th>From Account</th><th>To Account</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.number}</td><td>${new Date(r.date).toLocaleDateString('en-GB')}</td><td>${r.reference??''}</td><td>${r.from_account_name??''}</td><td>${r.to_account_name??''}</td><td class="r">${f(Number(r.amount||0))}</td><td>${r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();win.focus();setTimeout(()=>win.print(),400);
}

function exportFundTransfersToExcel(rows: FundTransfer[]) {
  const esc=(v:string|null|undefined)=>{const s=v??'';return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s;};
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  const csv=[['Number','Date','Reference','From Account','To Account','Amount','Status'].join(','),...rows.map(r=>[esc(r.number),new Date(r.date).toLocaleDateString('en-GB'),esc(r.reference),esc(r.from_account_name),esc(r.to_account_name),f(Number(r.amount||0)),esc(r.status)].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='FundTransfers.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function FundTransfersPage() {
  const [allTransfers, setAllTransfers] = useState<FundTransfer[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const [showModal,  setShowModal]  = useState(false);
  const [pending,    setPending]    = useState<Filters>(emptyFilters());
  const [applied,    setApplied]    = useState<Filters>(emptyFilters());

  const [showForm,  setShowForm]    = useState(false);
  const [editEntry, setEditEntry]   = useState<FundTransfer | null>(null);
  const [actionId,  setActionId]    = useState<number | null>(null);

  const fetchTransfers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getFundTransfers({
        status:    applied.status   || undefined,
        search:    applied.number   || applied.reference || undefined,
        date_from: applied.dateFrom || undefined,
        date_to:   applied.dateTo   || undefined,
      });
      setAllTransfers(data);
    } catch (err: unknown) {
      setError(`Failed to load fund transfers: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, [applied]);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  // Client-side filters for fromAccount, toAccount, amount range, showVoid
  const transfers = allTransfers.filter((ft) => {
    if (applied.fromAccount && !ft.from_account_name.toLowerCase().includes(applied.fromAccount.toLowerCase())) return false;
    if (applied.toAccount   && !ft.to_account_name.toLowerCase().includes(applied.toAccount.toLowerCase()))   return false;
    if (applied.amountFrom  && ft.amount < parseFloat(applied.amountFrom)) return false;
    if (applied.amountTo    && ft.amount > parseFloat(applied.amountTo))   return false;
    if (!applied.showVoid   && ft.status === 'cancelled') return false;
    return true;
  });

  function openModal()        { setPending({ ...applied }); setShowModal(true); }
  function handleApplyModal() { setApplied({ ...pending }); setShowModal(false); }
  function handleClear()      { setPending(emptyFilters()); }
  function handleSaveFilter() { setApplied({ ...pending }); setShowModal(false); }

  const hasActiveFilters = Object.entries(applied).some(([k, v]) =>
    k === 'showVoid' ? v === true : Boolean(v)
  );

  async function handlePost(ft: FundTransfer) {
    if (!window.confirm(`Post "${ft.number}"? This will update account balances.`)) return;
    setActionId(ft.id);
    try { await postFundTransfer(ft.id); fetchTransfers(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleCancel(ft: FundTransfer) {
    const msg = ft.status === 'posted'
      ? `Cancel "${ft.number}"? This will reverse account balance changes.`
      : `Cancel "${ft.number}"?`;
    if (!window.confirm(msg)) return;
    setActionId(ft.id);
    try { await cancelFundTransfer(ft.id); fetchTransfers(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleDelete(ft: FundTransfer) {
    if (!window.confirm(`Delete "${ft.number}"? This cannot be undone.`)) return;
    setActionId(ft.id);
    try { await deleteFundTransfer(ft.id); fetchTransfers(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  if (showForm) return (
        <FundTransferForm
      transfer={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={() => { setShowForm(false); setEditEntry(null); fetchTransfers(); }}
    />
  );

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Funds Transfer</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          ADD FUND TRANSFER
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 pb-4">
        {/* FILTERS button */}
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          FILTERS
          {hasActiveFilters && (
            <span className="bg-white text-blue-700 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">!</span>
          )}
        </button>

        {/* PRINT + EXPORT TO EXCEL */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => printFundTransfers(transfers)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => exportFundTransfersToExcel(transfers)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
            <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
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
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">From Account <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">To Account <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Amount <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-sm text-orange-500 font-medium">No record found</td>
                </tr>
              ) : (
                transfers.map((ft) => (
                  <tr key={ft.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{ft.number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{new Date(ft.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{ft.reference ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{ft.from_account_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{ft.to_account_name}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{fmt(ft.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${FT_STATUS_COLORS[ft.status]}`}>
                        {FT_STATUS_LABELS[ft.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {ft.status === 'draft' && (
                          <>
                            <button onClick={() => { setEditEntry(ft); setShowForm(true); }} title="Edit"
                              className="text-gray-400 hover:text-blue-600">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handlePost(ft)} disabled={actionId === ft.id} title="Post"
                              className="text-gray-400 hover:text-green-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(ft)} disabled={actionId === ft.id} title="Delete"
                              className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                        {ft.status === 'posted' && (
                          <button onClick={() => handleCancel(ft)} disabled={actionId === ft.id} title="Cancel"
                            className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        {ft.status === 'cancelled' && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

              {/* From Account */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">From Account</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded px-3 py-2 bg-white focus-within:ring-1 focus-within:ring-blue-400">
                  <input
                    type="text"
                    placeholder="Type to search from account"
                    className="flex-1 text-sm outline-none bg-transparent"
                    value={pending.fromAccount}
                    onChange={(e) => setPending((p) => ({ ...p, fromAccount: e.target.value }))}
                  />
                  <svg className="w-4 h-4 text-gray-400 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* To Account */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">To Account</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded px-3 py-2 bg-white focus-within:ring-1 focus-within:ring-blue-400">
                  <input
                    type="text"
                    placeholder="Type to search to account"
                    className="flex-1 text-sm outline-none bg-transparent"
                    value={pending.toAccount}
                    onChange={(e) => setPending((p) => ({ ...p, toAccount: e.target.value }))}
                  />
                  <svg className="w-4 h-4 text-gray-400 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">Reference</label>
                <input
                  type="text"
                  placeholder="Type to search reference"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pending.reference}
                  onChange={(e) => setPending((p) => ({ ...p, reference: e.target.value }))}
                />
              </div>

              {/* Amount From/To */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-semibold text-gray-700 shrink-0">Amount</label>
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
                  <option value="posted">Posted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Show Void */}
              <div className="flex items-center gap-3 pl-36">
                <input
                  type="checkbox"
                  id="ftShowVoid"
                  className="w-4 h-4 accent-blue-600"
                  checked={pending.showVoid}
                  onChange={(e) => setPending((p) => ({ ...p, showVoid: e.target.checked }))}
                />
                <label htmlFor="ftShowVoid" className="text-sm font-medium text-gray-700">Show Void</label>
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
