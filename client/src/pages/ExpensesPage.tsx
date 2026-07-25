import { useCallback, useEffect, useRef, useState } from 'react';
import ExpenseForm from '../components/ExpenseForm';
import { approveExpense, cancelExpense, deleteExpense, getExpense, getExpenses } from '../api/expenses';
import type { Expense } from '../types/expense';

type SortKey = 'number' | 'date' | 'reference' | 'vendor_name' | 'bank_account_name' | 'comments' | 'gross_amount' | 'status';

function SortTh({ col, label, sort, dir, onSort, right }: {
  col: SortKey; label: string; sort: SortKey; dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void; right?: boolean;
}) {
  return (
    <th onClick={() => onSort(col)}
      className={`px-4 py-3 text-xs font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 ${right ? 'text-right' : 'text-left'}`}>
      {label} <span className="text-gray-400 font-normal">{sort === col ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};
const fmt = (n: number) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function printExpenses(rows: Expense[]) {
  const win=window.open('','_blank','width=1000,height=680');if(!win)return;
  const f=(n:number)=>Number(n).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Expenses</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Expenses</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Reference</th><th>Contact</th><th>Pay From</th><th class="r">Gross Amount</th><th>Status</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.number}</td><td>${r.date?.slice(0,10)??''}</td><td>${r.reference??''}</td><td>${r.vendor_name??''}</td><td>${r.bank_account_name??''}</td><td class="r">${f(Number(r.gross_amount||0))}</td><td>${r.status}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();win.focus();setTimeout(()=>win.print(),400);
}

function exportExpensesToExcel(rows: Expense[]) {
  const esc=(v:string|null|undefined)=>{const s=v??'';return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s;};
  const f=(n:number)=>Number(n).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
  const csv=[['Number','Date','Reference','Contact','Pay From','Gross Amount','Status'].join(','),...rows.map(r=>[esc(r.number),esc(r.date?.slice(0,10)),esc(r.reference),esc(r.vendor_name),esc(r.bank_account_name),f(Number(r.gross_amount||0)),esc(r.status)].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download='Expenses.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function ExpensesPage() {
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [actErr,     setActErr]     = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Expense | null>(null);
  const [sort,       setSort]       = useState<SortKey>('date');
  const [dir,        setDir]        = useState<'asc' | 'desc'>('desc');
  const [showFilter, setShowFilter] = useState(false);

  // Draft filter state
  const [dNumber,       setDNumber]       = useState('');
  const [dDateFrom,     setDDateFrom]     = useState('');
  const [dDateTo,       setDDateTo]       = useState('');
  const [dReference,    setDReference]    = useState('');
  const [dContact,      setDContact]      = useState('');
  const [dPayFrom,      setDPayFrom]      = useState('');
  const [dComments,     setDComments]     = useState('');
  const [dGrossFrom,    setDGrossFrom]    = useState('');
  const [dGrossTo,      setDGrossTo]      = useState('');
  const [dStatus,       setDStatus]       = useState('');
  const [dExpenseAcct,  setDExpenseAcct]  = useState('');
  const [dShowVoid,     setDShowVoid]     = useState(false);
  const [showMore,      setShowMore]      = useState(false);

  // Applied filter state
  const [aNumber,       setANumber]       = useState('');
  const [aDateFrom,     setADateFrom]     = useState('');
  const [aDateTo,       setADateTo]       = useState('');
  const [aReference,    setAReference]    = useState('');
  const [aContact,      setAContact]      = useState('');
  const [aPayFrom,      setAPayFrom]      = useState('');
  const [aComments,     setAComments]     = useState('');
  const [aGrossFrom,    setAGrossFrom]    = useState('');
  const [aGrossTo,      setAGrossTo]      = useState('');
  const [aStatus,       setAStatus]       = useState('');
  const [aExpenseAcct,  setAExpenseAcct]  = useState('');
  const [aShowVoid,     setAShowVoid]     = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

  const filtersActive = !!(aNumber || aDateFrom || aDateTo || aReference || aContact || aPayFrom ||
    aComments || aGrossFrom || aGrossTo || aStatus || aExpenseAcct || aShowVoid);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getExpenses({
        search:    aNumber    || aReference || aContact || undefined,
        status:    aStatus    || undefined,
        date_from: aDateFrom  || undefined,
        date_to:   aDateTo    || undefined,
      });
      setExpenses(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [aNumber, aDateFrom, aDateTo, aReference, aContact, aStatus]);

  useEffect(() => { load(); }, [load]);

  function applyFilters() {
    setANumber(dNumber); setADateFrom(dDateFrom); setADateTo(dDateTo);
    setAReference(dReference); setAContact(dContact); setAPayFrom(dPayFrom);
    setAComments(dComments); setAGrossFrom(dGrossFrom); setAGrossTo(dGrossTo);
    setAStatus(dStatus); setAExpenseAcct(dExpenseAcct); setAShowVoid(dShowVoid);
    setShowFilter(false);
  }
  function clearFilters() {
    setDNumber(''); setDDateFrom(''); setDDateTo(''); setDReference('');
    setDContact(''); setDPayFrom(''); setDComments(''); setDGrossFrom('');
    setDGrossTo(''); setDStatus(''); setDExpenseAcct(''); setDShowVoid(false);
    setANumber(''); setADateFrom(''); setADateTo(''); setAReference('');
    setAContact(''); setAPayFrom(''); setAComments(''); setAGrossFrom('');
    setAGrossTo(''); setAStatus(''); setAExpenseAcct(''); setAShowVoid(false);
    setShowFilter(false);
  }
  function openFilter() {
    setDNumber(aNumber); setDDateFrom(aDateFrom); setDDateTo(aDateTo);
    setDReference(aReference); setDContact(aContact); setDPayFrom(aPayFrom);
    setDComments(aComments); setDGrossFrom(aGrossFrom); setDGrossTo(aGrossTo);
    setDStatus(aStatus); setDExpenseAcct(aExpenseAcct); setDShowVoid(aShowVoid);
    setShowFilter(true);
  }

  function handleSort(k: SortKey) {
    if (sort === k) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(k); setDir('asc'); }
  }

  async function handleEdit(id: number) {
    try { const full = await getExpense(id); setEditing(full); setShowForm(true); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Failed to load'); }
  }
  async function handleApprove(exp: Expense) {
    if (!confirm(`Approve "${exp.number}"?`)) return;
    setActErr('');
    try { await approveExpense(exp.id); await load(); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Error'); }
  }
  async function handleCancel(exp: Expense) {
    if (!confirm(`Cancel "${exp.number}"?`)) return;
    setActErr('');
    try { await cancelExpense(exp.id); await load(); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Error'); }
  }
  async function handleDelete(exp: Expense) {
    if (!confirm(`Delete "${exp.number}"? This cannot be undone.`)) return;
    setActErr('');
    try { await deleteExpense(exp.id); await load(); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Error'); }
  }

  function handleFormSaved(saved: Expense, continueEdit: boolean) {
    if (continueEdit) setEditing(saved);
    load();
  }

  const sorted = [...expenses].sort((a, b) => {
    const av = a[sort] ?? '';
    const bv = b[sort] ?? '';
    if (typeof av === 'string' && typeof bv === 'string')
      return av.localeCompare(bv) * (dir === 'asc' ? 1 : -1);
    return (Number(av) - Number(bv)) * (dir === 'asc' ? 1 : -1);
  });

  const totalGross = sorted.reduce((s, e) => s + Number(e.gross_amount), 0);

  if (showForm) return (
        <ExpenseForm
      expense={editing}
      onClose={() => { setShowForm(false); setEditing(null); }}
      onSaved={handleFormSaved}
    />
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Expenses</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD EXPENSE
        </button>
      </div>

      {actErr && (
        <div className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{actErr}</div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={openFilter}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded ${filtersActive ? 'bg-blue-700' : 'bg-blue-600'} hover:bg-blue-700 text-white`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
          </svg>
          FILTERS
          {filtersActive && <span className="ml-1 text-blue-200">●</span>}
        </button>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => printExpenses(sorted)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => exportExpensesToExcel(sorted)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <SortTh col="number"           label="Number"       sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="date"             label="Date"         sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="reference"        label="Reference"    sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="vendor_name"      label="Contact"      sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="bank_account_name" label="Pay From"    sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="comments"         label="Comments"     sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="gross_amount"     label="Gross Amount" sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="gross_amount"     label="Net Amount"   sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="status"           label="Status"       sort={sort} dir={dir} onSort={handleSort} />
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-6 text-sm text-amber-500 font-medium">No record found</td></tr>
            ) : sorted.map(exp => (
              <tr key={exp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-blue-600 font-medium">{exp.number}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(exp.date)}</td>
                <td className="px-4 py-3 text-gray-600">{exp.reference ?? ''}</td>
                <td className="px-4 py-3 text-gray-600">{exp.vendor_name ?? ''}</td>
                <td className="px-4 py-3 text-gray-800">{exp.bank_account_name}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{exp.comments ?? ''}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(exp.gross_amount)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(exp.gross_amount)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[exp.status] ?? ''}`}>
                    {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {exp.status === 'draft' && (
                      <>
                        <button onClick={() => handleEdit(exp.id)}
                          className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                        <button onClick={() => handleApprove(exp)}
                          className="text-xs text-green-600 hover:underline font-medium">Approve</button>
                        <button onClick={() => handleDelete(exp)}
                          className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                      </>
                    )}
                    {exp.status === 'approved' && (
                      <button onClick={() => handleCancel(exp)}
                        className="text-xs text-gray-500 hover:underline font-medium">Cancel</button>
                    )}
                    {exp.status === 'cancelled' && (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-gray-600 text-right">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{fmt(totalGross)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{fmt(totalGross)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Filter Modal — matches Splendid Expenses layout exactly */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div ref={filterRef} className="relative bg-white rounded-lg shadow-2xl border-2 border-green-500 w-full max-w-lg mx-4">
            {/* Red × close */}
            <button onClick={() => setShowFilter(false)}
              className="absolute -top-3 -right-3 w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full text-lg leading-none font-bold hover:bg-red-600 z-10">
              ×
            </button>

            <div className="px-5 py-4 max-h-[85vh] overflow-y-auto space-y-3">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search number" value={dNumber} onChange={e => setDNumber(e.target.value)} />
              </div>

              {/* Date */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={dDateFrom} onChange={e => setDDateFrom(e.target.value)} />
                  <span className="text-sm text-gray-500 flex-shrink-0">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={dDateTo} onChange={e => setDDateTo(e.target.value)} />
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Reference</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search reference" value={dReference} onChange={e => setDReference(e.target.value)} />
              </div>

              {/* Contact */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Contact</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search contact" value={dContact} onChange={e => setDContact(e.target.value)} />
              </div>

              {/* Pay From */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Pay From</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search pay from" value={dPayFrom} onChange={e => setDPayFrom(e.target.value)} />
              </div>

              {/* Comments */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Comments</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search comments" value={dComments} onChange={e => setDComments(e.target.value)} />
              </div>

              {/* Gross Amount */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Gross Amount</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">From:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={dGrossFrom} onChange={e => setDGrossFrom(e.target.value)} />
                  <span className="text-sm text-gray-500 flex-shrink-0">To:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={dGrossTo} onChange={e => setDGrossTo(e.target.value)} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={dStatus} onChange={e => setDStatus(e.target.value)}>
                  <option value="">Select status</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* SHOW MORE fields */}
              {showMore && (
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm font-medium text-gray-700 flex-shrink-0">Expense Account</label>
                  <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Type to search expense account" value={dExpenseAcct} onChange={e => setDExpenseAcct(e.target.value)} />
                </div>
              )}

              {/* Show Void + SHOW MORE/LESS */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 accent-green-600"
                    checked={dShowVoid} onChange={e => setDShowVoid(e.target.checked)} />
                  <span className="text-sm font-medium text-gray-700">Show Void</span>
                </label>
                <button type="button" onClick={() => setShowMore(s => !s)}
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded">
                  {showMore
                    ? <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg> SHOW LESS</>
                    : <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg> SHOW MORE</>
                  }
                </button>
              </div>
            </div>

            {/* Footer: SAVE FILTER | APPLY | CLEAR */}
            <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-2">
              <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters}
                className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded ml-auto">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                APPLY
              </button>
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
