import { useCallback, useEffect, useState } from 'react';
import BankDepositForm from '../components/BankDepositForm';
import {
  cancelBankDeposit, clearBankDeposit, deleteBankDeposit,
  depositBankDeposit, getBankDeposits,
} from '../api/bankDeposits';
import { getBankAccountsLookup } from '../api/bankAccounts';
import type { BankDeposit } from '../types/bankDeposit';
import { BD_STATUS_COLORS, BD_STATUS_LABELS } from '../types/bankDeposit';
import type { BankAccount } from '../types/bankAccount';

const SortIcon = () => (
  <svg className="inline-block w-3 h-3 ml-1 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

interface Filters {
  number: string;
  dateFrom: string;
  dateTo: string;
  bankAccountId: string;
  amountFrom: string;
  amountTo: string;
  depositNumber: string;
  status: string;
  showVoid: boolean;
}

const EMPTY_FILTERS: Filters = {
  number: '', dateFrom: '', dateTo: '', bankAccountId: '',
  amountFrom: '', amountTo: '', depositNumber: '', status: '', showVoid: false,
};

function printBankDeposits(rows: BankDeposit[]) {
  const win=window.open('','_blank','width=1000,height=680');if(!win)return;
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Bank Deposits</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Bank Deposits</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Bank Account</th><th>Deposit No.</th><th class="r">Total Amount</th><th>Status</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.number}</td><td>${new Date(r.date).toLocaleDateString('en-GB')}</td><td>${r.bank_account_name??''}</td><td>${r.deposit_no??''}</td><td class="r">${f(Number(r.total_amount||0))}</td><td>${r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();win.focus();setTimeout(()=>win.print(),400);
}

function exportBankDepositsToExcel(rows: BankDeposit[]) {
  const esc=(v:string|null|undefined)=>{const s=v??'';return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s;};
  const f=(n:number)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:2});
  const csv=[['Number','Date','Bank Account','Deposit No.','Total Amount','Status'].join(','),...rows.map(r=>[esc(r.number),new Date(r.date).toLocaleDateString('en-GB'),esc(r.bank_account_name),esc(r.deposit_no),f(Number(r.total_amount||0)),esc(r.status)].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='BankDeposits.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function BankDepositsPage() {
  const [deposits, setDeposits]         = useState<BankDeposit[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [pendingFilters, setPendingFilters]   = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters]   = useState<Filters>(EMPTY_FILTERS);

  const [showForm, setShowForm]   = useState(false);
  const [editEntry, setEditEntry] = useState<BankDeposit | null>(null);
  const [actionId, setActionId]   = useState<number | null>(null);

  useEffect(() => {
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
  }, []);

  const fetchDeposits = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getBankDeposits({
        status:    appliedFilters.status    || undefined,
        search:    appliedFilters.number    || undefined,
        date_from: appliedFilters.dateFrom  || undefined,
        date_to:   appliedFilters.dateTo    || undefined,
      });
      setDeposits(data);
    } catch (err: unknown) {
      setError(`Failed to load deposits: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, [appliedFilters]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  // Client-side post-filters
  const visibleDeposits = deposits.filter((bd) => {
    if (appliedFilters.bankAccountId && String(bd.bank_account_id) !== appliedFilters.bankAccountId) return false;
    if (appliedFilters.amountFrom && Number(bd.total_amount) < Number(appliedFilters.amountFrom)) return false;
    if (appliedFilters.amountTo   && Number(bd.total_amount) > Number(appliedFilters.amountTo))   return false;
    if (appliedFilters.depositNumber && !String(bd.deposit_no ?? '').toLowerCase().includes(appliedFilters.depositNumber.toLowerCase())) return false;
    if (!appliedFilters.showVoid && bd.status === 'cancelled') return false;
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

  async function handleDeposit(bd: BankDeposit) {
    if (!window.confirm(`Deposit "${bd.number}"? This will update account balances.`)) return;
    setActionId(bd.id);
    try { await depositBankDeposit(bd.id); fetchDeposits(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleClear(bd: BankDeposit) {
    if (!window.confirm(`Mark "${bd.number}" as Cleared?`)) return;
    setActionId(bd.id);
    try { await clearBankDeposit(bd.id); fetchDeposits(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleCancel(bd: BankDeposit) {
    const msg = bd.status === 'deposited'
      ? `Cancel "${bd.number}"? This will reverse account balance changes.`
      : `Cancel "${bd.number}"?`;
    if (!window.confirm(msg)) return;
    setActionId(bd.id);
    try { await cancelBankDeposit(bd.id); fetchDeposits(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  async function handleDelete(bd: BankDeposit) {
    if (!window.confirm(`Delete "${bd.number}"? This cannot be undone.`)) return;
    setActionId(bd.id);
    try { await deleteBankDeposit(bd.id); fetchDeposits(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionId(null); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  if (showForm) return (
        <BankDepositForm
      deposit={editEntry}
      onClose={() => { setShowForm(false); setEditEntry(null); }}
      onSaved={() => { setShowForm(false); setEditEntry(null); fetchDeposits(); }}
    />
  );

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Bank Deposits</h1>
        <button
          onClick={() => { setEditEntry(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          ADD BANK DEPOSIT
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
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => printBankDeposits(visibleDeposits)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => exportBankDepositsToExcel(visibleDeposits)}>
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
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Bank Account</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Deposit No. <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Total Amount <SortIcon /></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Status <SortIcon /></th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-orange-500">No record found</td>
                </tr>
              ) : (
                visibleDeposits.map((bd) => (
                  <tr key={bd.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{bd.number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(bd.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{bd.bank_account_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{bd.deposit_no ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{fmt(bd.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BD_STATUS_COLORS[bd.status]}`}>
                        {BD_STATUS_LABELS[bd.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {bd.status === 'draft' && (
                          <>
                            <button onClick={() => { setEditEntry(bd); setShowForm(true); }}
                              title="Edit"
                              className="text-gray-400 hover:text-blue-600">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDeposit(bd)} disabled={actionId === bd.id}
                              title="Deposit"
                              className="text-gray-400 hover:text-green-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(bd)} disabled={actionId === bd.id}
                              title="Delete"
                              className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                        {bd.status === 'deposited' && (
                          <>
                            <button onClick={() => handleClear(bd)} disabled={actionId === bd.id}
                              title="Mark Cleared"
                              className="text-gray-400 hover:text-green-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button onClick={() => handleCancel(bd)} disabled={actionId === bd.id}
                              title="Cancel"
                              className="text-gray-400 hover:text-red-600 disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                        {bd.status === 'cleared'   && <span className="text-xs text-green-500 font-medium">Cleared</span>}
                        {bd.status === 'cancelled' && <span className="text-xs text-gray-400">—</span>}
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
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Type to search number"
                  value={pendingFilters.number}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, number: e.target.value }))}
                />
              </div>

              {/* Date From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input
                    type="date"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateFrom}
                    onChange={(e) => setPendingFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">To:</span>
                  <input
                    type="date"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateTo}
                    onChange={(e) => setPendingFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Bank Account */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Bank Account</label>
                <div className="flex-1 relative">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none bg-white pr-8"
                    value={pendingFilters.bankAccountId}
                    onChange={(e) => setPendingFilters((f) => ({ ...f, bankAccountId: e.target.value }))}>
                    <option value="">Select bank account</option>
                    {bankAccounts.map((ba) => (
                      <option key={ba.id} value={String(ba.id)}>{ba.name}</option>
                    ))}
                  </select>
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
                  <input
                    type="number"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="From"
                    value={pendingFilters.amountFrom}
                    onChange={(e) => setPendingFilters((f) => ({ ...f, amountFrom: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">To:</span>
                  <input
                    type="number"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="To"
                    value={pendingFilters.amountTo}
                    onChange={(e) => setPendingFilters((f) => ({ ...f, amountTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Deposit Number */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Deposit Number</label>
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Type to search deposit number"
                  value={pendingFilters.depositNumber}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, depositNumber: e.target.value }))}
                />
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 shrink-0">Status</label>
                <div className="flex-1 relative">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none bg-white pr-8"
                    value={pendingFilters.status}
                    onChange={(e) => setPendingFilters((f) => ({ ...f, status: e.target.value }))}>
                    <option value="">Select status</option>
                    <option value="draft">Draft</option>
                    <option value="deposited">Deposited</option>
                    <option value="cleared">Cleared</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Show Void */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showVoid"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  checked={pendingFilters.showVoid}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, showVoid: e.target.checked }))}
                />
                <label htmlFor="showVoid" className="text-sm font-medium text-gray-700 cursor-pointer">Show Void</label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-6 pb-5">
              {/* SAVE FILTER */}
              <button
                onClick={applyFilters}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                SAVE FILTER
              </button>
              {/* APPLY */}
              <button
                onClick={applyFilters}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                </svg>
                APPLY
              </button>
              {/* CLEAR */}
              <button
                onClick={clearPending}
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
