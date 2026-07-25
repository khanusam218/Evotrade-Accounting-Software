import { useCallback, useEffect, useState } from 'react';
import BankAccountForm from '../components/BankAccountForm';
import { deleteBankAccount, getBankAccounts } from '../api/bankAccounts';
import type { BankAccount } from '../types/bankAccount';

function printBankAccounts(rows: BankAccount[]) {
  const win=window.open('','_blank','width=1000,height=680');if(!win)return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Bank Accounts</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Bank Accounts</span></div><hr/>
<table><thead><tr><th>Bank Name</th><th>Branch Name</th><th>Account Title</th><th>Account Number</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.bank_name??''}</td><td>${r.branch_name??''}</td><td>${r.account_holder??''}</td><td>${r.account_number??''}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();win.focus();setTimeout(()=>win.print(),400);
}

function exportBankAccountsToExcel(rows: BankAccount[]) {
  const esc=(v:string|null|undefined)=>{const s=v??'';return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s;};
  const csv=[['Bank Name','Branch Name','Account Title','Account Number'].join(','),...rows.map(r=>[esc(r.bank_name),esc(r.branch_name),esc(r.account_holder),esc(r.account_number)].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='BankAccounts.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');

  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState<BankAccount | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formKey, setFormKey]       = useState(0);

  const fetchAccounts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getBankAccounts({ search: search || undefined });
      setAccounts(data);
    } catch (err: unknown) {
      setError(`Failed to load bank accounts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  async function handleDelete(account: BankAccount) {
    if (!window.confirm(`Delete "${account.name}"? This cannot be undone.`)) return;
    setDeletingId(account.id);
    try {
      await deleteBankAccount(account.id);
      fetchAccounts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not delete account');
    } finally { setDeletingId(null); }
  }

  function handleFormSaved(_saved: BankAccount, addNew: boolean) {
    fetchAccounts();
    if (addNew) {
      setEditTarget(null);
      setFormKey((k) => k + 1);
    } else {
      setShowForm(false);
      setEditTarget(null);
    }
  }

  if (showForm) return (
        <BankAccountForm
      key={formKey}
      account={editTarget}
      onClose={() => { setShowForm(false); setEditTarget(null); }}
      onSaved={handleFormSaved}
    />
  );

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Bank Accounts</h1>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          ADD BANK ACCOUNT
        </button>
      </div>

      {/* Search + toolbar */}
      <div className="flex items-end justify-end gap-2 px-6 pb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
          <input
            type="text"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder=""
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => printBankAccounts(accounts)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          PRINT
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => exportBankAccountsToExcel(accounts)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          EXPORT TO EXCEL
        </button>
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
                {(['Bank Name', 'Branch Name', 'Account Title', 'Account Number'] as const).map((col) => (
                  <th key={col} className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                    <span className="flex items-center gap-1">
                      {col}
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </span>
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-orange-500">No record found</td>
                </tr>
              ) : (
                accounts.map((acct) => (
                  <tr key={acct.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">{acct.bank_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{acct.branch_name ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{acct.account_holder ?? ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{acct.account_number ?? ''}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditTarget(acct); setShowForm(true); }}
                          title="Edit"
                          className="text-gray-500 hover:text-blue-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(acct)}
                          disabled={deletingId === acct.id}
                          title="Delete"
                          className="text-gray-500 hover:text-red-600 disabled:opacity-40">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
