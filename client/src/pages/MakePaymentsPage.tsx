import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { MakePayment, MPStatus } from '../types/makePayment';
import { MP_STATUS_COLORS, MP_STATUS_LABELS } from '../types/makePayment';
import { getMakePayments, approveMakePayment, cancelMakePayment, deleteMakePayment } from '../api/makePayments';
import MakePaymentForm from '../components/MakePaymentForm';

interface Vendor { id: number; print_name: string; }
type SortKey = 'number' | 'date' | 'vendor_name' | 'reference' | 'total_amount' | 'unadjusted_amount' | 'status';

function printRows(rows: MakePayment[], fmt: (n: number) => string) {
  const win = window.open('', '_blank', 'width=1000,height=680');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Make Payments</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;padding:30px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;}.co{font-size:20px;font-weight:bold;}.ti{font-size:20px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:14px;}
table{width:100%;border-collapse:collapse;}
th{text-align:left;font-weight:bold;padding:5px 6px;border-bottom:1.5px solid #000;font-size:11px;}
th.r,td.r{text-align:right;}
td{padding:5px 6px;border-bottom:1px solid #eee;font-size:11px;}
</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Make Payments</span></div><hr/>
<table><thead><tr>
<th>Number</th><th>Date</th><th>Vendor</th><th>Reference</th>
<th class="r">Total Amount</th><th class="r">Unadjusted</th><th>Status</th>
</tr></thead><tbody>
${rows.map(r=>`<tr>
<td>${r.number}</td><td>${r.date?.slice(0,10)??''}</td><td>${r.vendor_name??''}</td><td>${r.reference??''}</td>
<td class="r">${fmt(Number(r.total_amount||0))}</td><td class="r">${fmt(Number(r.unadjusted_amount||0))}</td><td>${r.status}</td>
</tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close(); win.focus(); setTimeout(()=>win.print(),400);
}

function exportToExcel(rows: MakePayment[], fmt: (n: number) => string) {
  const esc = (v: string|null|undefined) => { const s=v??''; return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`  :s; };
  const csv = [
    ['Number','Date','Vendor','Reference','Total Amount','Unadjusted Amount','Status'].join(','),
    ...rows.map(r=>[esc(r.number),esc(r.date?.slice(0,10)),esc(r.vendor_name),esc(r.reference),fmt(Number(r.total_amount||0)),fmt(Number(r.unadjusted_amount||0)),esc(r.status)].join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a = document.createElement('a'); a.href=url; a.download='MakePayments.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function SortTh({ label, col, sort, setSort, right }: { label: string; col: SortKey; sort: [SortKey, 'asc' | 'desc']; setSort: (s: [SortKey, 'asc' | 'desc']) => void; right?: boolean }) {
  const active = sort[0] === col;
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 ${right ? 'text-right' : 'text-left'}`}
      onClick={() => setSort([col, active && sort[1] === 'asc' ? 'desc' : 'asc'])}>
      {label} <span className="text-gray-400">{active ? (sort[1] === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

export default function MakePaymentsPage() {
  const [rows,       setRows]       = useState<MakePayment[]>([]);
  const [vendors,    setVendors]    = useState<Vendor[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<MakePayment | null>(null);
  const [actErr,     setActErr]     = useState('');
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [sort,       setSort]       = useState<[SortKey, 'asc' | 'desc']>(['date', 'desc']);
  const [showFilter,    setShowFilter]    = useState(false);
  const [showOther,     setShowOther]     = useState(false);
  const [showMore,      setShowMore]      = useState(false);
  const otherRef = useRef<HTMLDivElement>(null);

  // draft filter state
  const [dNumber,        setDNumber]        = useState('');
  const [dDateFrom,      setDDateFrom]      = useState('');
  const [dDateTo,        setDDateTo]        = useState('');
  const [dReference,     setDReference]     = useState('');
  const [dVendor,        setDVendor]        = useState('');
  const [dTotalFrom,     setDTotalFrom]     = useState('');
  const [dTotalTo,       setDTotalTo]       = useState('');
  const [dUnadjFrom,     setDUnadjFrom]     = useState('');
  const [dUnadjTo,       setDUnadjTo]       = useState('');
  const [dStatus,        setDStatus]        = useState('');
  const [dDocNumber,     setDDocNumber]     = useState('');
  const [dInstrument,    setDInstrument]    = useState('');
  const [dShowVoid,      setDShowVoid]      = useState(false);

  // applied filter state
  const [aNumber,        setANumber]        = useState('');
  const [aDateFrom,      setADateFrom]      = useState('');
  const [aDateTo,        setADateTo]        = useState('');
  const [aReference,     setAReference]     = useState('');
  const [aVendorId,      setAVendorId]      = useState('');
  const [aTotalFrom,     setATotalFrom]     = useState('');
  const [aTotalTo,       setATotalTo]       = useState('');
  const [aUnadjFrom,     setAUnadjFrom]     = useState('');
  const [aUnadjTo,       setAUnadjTo]       = useState('');
  const [aStatus,        setAStatus]        = useState('');
  const [aDocNumber,     setADocNumber]     = useState('');
  const [aInstrument,    setAInstrument]    = useState('');

  const hasFilter = !!(aNumber || aDateFrom || aDateTo || aReference || aVendorId || aTotalFrom || aTotalTo || aUnadjFrom || aUnadjTo || aStatus || aDocNumber);

  async function load() {
    setLoading(true);
    const p: Record<string, string> = {};
    if (aNumber)   p.search    = aNumber;
    if (aDateFrom) p.date_from = aDateFrom;
    if (aDateTo)   p.date_to   = aDateTo;
    if (aVendorId) p.vendor_id = aVendorId;
    if (aStatus)   p.status    = aStatus;
    try { setRows(await getMakePayments(p)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [aNumber, aDateFrom, aDateTo, aVendorId, aStatus]);
  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);
  useEffect(() => {
    if (!showOther) return;
    function h(e: MouseEvent) { if (otherRef.current && !otherRef.current.contains(e.target as Node)) setShowOther(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showOther]);

  function openFilter() {
    setDNumber(aNumber); setDDateFrom(aDateFrom); setDDateTo(aDateTo);
    setDReference(aReference); setDVendor(aVendorId);
    setDTotalFrom(aTotalFrom); setDTotalTo(aTotalTo);
    setDUnadjFrom(aUnadjFrom); setDUnadjTo(aUnadjTo);
    setDStatus(aStatus); setDDocNumber(aDocNumber); setDInstrument(aInstrument);
    setShowFilter(true);
  }
  function applyFilter() {
    setANumber(dNumber); setADateFrom(dDateFrom); setADateTo(dDateTo);
    setAReference(dReference); setAVendorId(dVendor);
    setATotalFrom(dTotalFrom); setATotalTo(dTotalTo);
    setAUnadjFrom(dUnadjFrom); setAUnadjTo(dUnadjTo);
    setAStatus(dStatus); setADocNumber(dDocNumber); setAInstrument(dInstrument);
    setShowFilter(false);
  }
  function clearFilter() {
    setDNumber(''); setDDateFrom(''); setDDateTo(''); setDReference(''); setDVendor('');
    setDTotalFrom(''); setDTotalTo(''); setDUnadjFrom(''); setDUnadjTo('');
    setDStatus(''); setDDocNumber(''); setDInstrument(''); setDShowVoid(false);
    setANumber(''); setADateFrom(''); setADateTo(''); setAReference(''); setAVendorId('');
    setATotalFrom(''); setATotalTo(''); setAUnadjFrom(''); setAUnadjTo('');
    setAStatus(''); setADocNumber(''); setAInstrument('');
    setShowFilter(false);
  }

  async function act(fn: () => Promise<unknown>) {
    setActErr('');
    try { await fn(); setSelected(new Set()); await load(); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Error'); }
  }

  const visible = rows.filter(r => {
    if (aReference && !(r.reference ?? '').toLowerCase().includes(aReference.toLowerCase())) return false;
    if (aTotalFrom && Number(r.total_amount) < Number(aTotalFrom)) return false;
    if (aTotalTo   && Number(r.total_amount) > Number(aTotalTo))   return false;
    if (aUnadjFrom && Number(r.unadjusted_amount) < Number(aUnadjFrom)) return false;
    if (aUnadjTo   && Number(r.unadjusted_amount) > Number(aUnadjTo))   return false;
    return true;
  });

  const sorted = [...visible].sort((a, b) => {
    let av: string | number = '', bv: string | number = '';
    if (sort[0] === 'number')            { av = a.number;                   bv = b.number; }
    if (sort[0] === 'date')              { av = a.date;                     bv = b.date; }
    if (sort[0] === 'vendor_name')       { av = a.vendor_name ?? '';        bv = b.vendor_name ?? ''; }
    if (sort[0] === 'reference')         { av = a.reference ?? '';          bv = b.reference ?? ''; }
    if (sort[0] === 'total_amount')      { av = Number(a.total_amount || 0);     bv = Number(b.total_amount || 0); }
    if (sort[0] === 'unadjusted_amount') { av = Number(a.unadjusted_amount || 0); bv = Number(b.unadjusted_amount || 0); }
    if (sort[0] === 'status')            { av = a.status;                   bv = b.status; }
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sort[1] === 'asc' ? 1 : -1);
  });

  const allSel       = sorted.length > 0 && sorted.every(r => selected.has(r.id));
  const totalAmt   = sorted.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalUnadj = sorted.reduce((s, r) => s + Number(r.unadjusted_amount || 0), 0);
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (showForm) return (
    <MakePaymentForm payment={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Make Payments</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          ADD MAKE PAYMENT
        </button>
      </div>

      {actErr && <div className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{actErr}</div>}

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button onClick={openFilter}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded text-white ${hasFilter ? 'bg-green-600' : 'bg-green-700 hover:bg-green-800'}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M12 16h0" /></svg>
          FILTERS {hasFilter && <span className="ml-1 bg-white text-green-600 text-xs rounded-full px-1.5 py-0.5 font-bold">●</span>}
        </button>
        <button onClick={() => printRows(sorted, fmt)}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          PRINT
        </button>
        <button onClick={() => exportToExcel(sorted, fmt)}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          EXPORT TO EXCEL
        </button>
        <div className="relative" ref={otherRef}>
          <button onClick={() => setShowOther(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800">
            OTHER ACTIONS
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showOther && (
            <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-30">
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { act(() => Promise.all([...selected].filter(id => sorted.find(r => r.id === id)?.status === 'draft').map(id => approveMakePayment(id)))); setShowOther(false); }}>
                Approve Selected
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { act(() => Promise.all([...selected].filter(id => sorted.find(r => r.id === id)?.status === 'draft').map(id => deleteMakePayment(id)))); setShowOther(false); }}>
                Delete Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600"
                  checked={allSel} onChange={e => setSelected(e.target.checked ? new Set(sorted.map(r => r.id)) : new Set())} />
              </th>
              <SortTh label="Number"             col="number"            sort={sort} setSort={setSort} />
              <SortTh label="Date"               col="date"              sort={sort} setSort={setSort} />
              <SortTh label="Vendor"             col="vendor_name"       sort={sort} setSort={setSort} />
              <SortTh label="Reference"          col="reference"         sort={sort} setSort={setSort} />
              <SortTh label="Total Amount"       col="total_amount"      sort={sort} setSort={setSort} right />
              <SortTh label="Unadjusted Amount"  col="unadjusted_amount" sort={sort} setSort={setSort} right />
              <SortTh label="Status"             col="status"            sort={sort} setSort={setSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-sm text-amber-500 font-medium">No record found</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className={`hover:bg-gray-50 ${selected.has(r.id) ? 'bg-green-50' : ''}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600"
                    checked={selected.has(r.id)} onChange={e => setSelected(prev => { const s = new Set(prev); e.target.checked ? s.add(r.id) : s.delete(r.id); return s; })} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-800">{r.number}</td>
                <td className="px-4 py-3 text-gray-600">{r.date?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-gray-800">{r.vendor_name}</td>
                <td className="px-4 py-3 text-gray-600">{r.reference ?? '–'}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(Number(r.total_amount || 0))}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(Number(r.unadjusted_amount || 0))}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${MP_STATUS_COLORS[r.status]}`}>
                    {MP_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.status === 'draft' && <>
                      <button onClick={() => { setEditing(r); setShowForm(true); }}
                        className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                      <button onClick={() => act(() => approveMakePayment(r.id))}
                        className="text-xs text-green-600 hover:underline font-medium">Approve</button>
                      <button onClick={() => act(() => deleteMakePayment(r.id))}
                        className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                    </>}
                    {r.status === 'approved' && (
                      <button onClick={() => act(() => cancelMakePayment(r.id))}
                        className="text-xs text-red-500 hover:underline font-medium">Cancel</button>
                    )}
                    {r.status === 'cancelled' && <span className="text-xs text-gray-400">–</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-gray-600">Total ({sorted.length} records)</td>
              <td className="px-4 py-2 text-right font-mono font-bold text-gray-800">{fmt(totalAmt)}</td>
              <td className="px-4 py-2 text-right font-mono font-bold text-gray-800">{fmt(totalUnadj)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Filter Modal */}
      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 border-2 border-green-500">
            <button onClick={() => setShowFilter(false)}
              className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow z-10">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="px-6 py-5 space-y-3">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search number" value={dNumber} onChange={e => setDNumber(e.target.value)} />
              </div>
              {/* Date */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={dDateFrom} onChange={e => setDDateFrom(e.target.value)} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={dDateTo} onChange={e => setDDateTo(e.target.value)} />
                </div>
              </div>
              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Reference</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search reference" value={dReference} onChange={e => setDReference(e.target.value)} />
              </div>
              {/* Vendor */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Vendor</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={dVendor} onChange={e => setDVendor(e.target.value)}>
                  <option value="">Type to search vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                </select>
              </div>
              {/* Total Amount */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Total Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={dTotalFrom} onChange={e => setDTotalFrom(e.target.value)} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={dTotalTo} onChange={e => setDTotalTo(e.target.value)} />
                </div>
              </div>
              {/* Unadjusted Amount */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Unadjusted Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="From" value={dUnadjFrom} onChange={e => setDUnadjFrom(e.target.value)} />
                  <span className="text-sm text-gray-500">To:</span>
                  <input type="number" className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="To" value={dUnadjTo} onChange={e => setDUnadjTo(e.target.value)} />
                </div>
              </div>
              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                <select className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={dStatus} onChange={e => setDStatus(e.target.value)}>
                  <option value="">Select status</option>
                  {(['draft', 'approved', 'cancelled'] as MPStatus[]).map(s => <option key={s} value={s}>{MP_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              {/* Document Number */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Document Number</label>
                <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Type to search document number" value={dDocNumber} onChange={e => setDDocNumber(e.target.value)} />
              </div>
              {/* Instrument — only visible when SHOW MORE is active */}
              {showMore && (
                <div className="flex items-center gap-4">
                  <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Instrument</label>
                  <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Type to search instrument" value={dInstrument} onChange={e => setDInstrument(e.target.value)} />
                </div>
              )}
              {/* Show Void + SHOW MORE */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={dShowVoid} onChange={e => setDShowVoid(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600" />
                  Show Void
                </label>
                <button type="button" onClick={() => setShowMore(v => !v)}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMore ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} /></svg>
                  {showMore ? 'SHOW LESS' : 'SHOW MORE'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button onClick={() => {}}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilter}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                APPLY
              </button>
              <button onClick={clearFilter}
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

