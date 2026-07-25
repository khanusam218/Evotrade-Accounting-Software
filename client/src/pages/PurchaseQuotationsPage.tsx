import { useEffect, useState } from 'react';
import type { PurchaseQuotation, PQStatus } from '../types/purchaseQuotation';
import { PQ_STATUS_COLORS, PQ_STATUS_LABELS } from '../types/purchaseQuotation';
import { getPurchaseQuotations, sendPurchaseQuotation, approvePurchaseQuotation, cancelPurchaseQuotation, deletePurchaseQuotation } from '../api/purchaseQuotations';
import PurchaseQuotationForm from '../components/PurchaseQuotationForm';

export default function PurchaseQuotationsPage() {
  const [rows, setRows] = useState<PurchaseQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PurchaseQuotation | null>(null);
  const [actErr, setActErr] = useState('');

  async function load() {
    setLoading(true);
    const p: Record<string,string> = {};
    if (search) p.search = search; if (status) p.status = status;
    if (dateFrom) p.date_from = dateFrom; if (dateTo) p.date_to = dateTo;
    try { setRows(await getPurchaseQuotations(p)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [search, status, dateFrom, dateTo]);

  async function act(fn: () => Promise<unknown>) {
    setActErr('');
    try { await fn(); await load(); } catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Error'); }
  }

  if (showForm) return (
    <PurchaseQuotationForm quotation={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
  );

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Purchase Quotations (RFQ)</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ New RFQ</button>
      </div>
      {actErr && <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{actErr}</div>}
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input w-56" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {(['draft','sent','approved','cancelled'] as PQStatus[]).map(s => <option key={s} value={s}>{PQ_STATUS_LABELS[s]}</option>)}
        </select>
        <input type="date" className="input w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" className="input w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="table-th">Number</th><th className="table-th">Date</th><th className="table-th">Vendor</th>
            <th className="table-th text-right">Net Amount</th><th className="table-th">Status</th><th className="table-th">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="table-td text-center text-gray-400 py-10">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={6} className="table-td text-center text-gray-400 py-10">No records found.</td></tr>
            : rows.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="table-td font-mono text-xs">{r.number}</td>
                <td className="table-td text-xs">{r.date?.slice(0,10)}</td>
                <td className="table-td">{r.vendor_name}</td>
                <td className="table-td text-right">{Number(r.net_amount).toFixed(2)}</td>
                <td className="table-td"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PQ_STATUS_COLORS[r.status]}`}>{PQ_STATUS_LABELS[r.status]}</span></td>
                <td className="table-td">
                  <div className="flex gap-2 flex-wrap">
                    {r.status === 'draft' && <>
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="btn-secondary text-xs py-0.5 px-2">Edit</button>
                      <button onClick={() => act(() => sendPurchaseQuotation(r.id))} className="text-xs py-0.5 px-2 text-blue-600 hover:underline">Send</button>
                      <button onClick={() => act(() => approvePurchaseQuotation(r.id))} className="btn-primary text-xs py-0.5 px-2">Approve</button>
                      <button onClick={() => act(() => deletePurchaseQuotation(r.id))} className="text-xs py-0.5 px-2 text-red-600 hover:underline">Delete</button>
                    </>}
                    {r.status === 'sent' && <>
                      <button onClick={() => act(() => approvePurchaseQuotation(r.id))} className="btn-primary text-xs py-0.5 px-2">Approve</button>
                      <button onClick={() => act(() => cancelPurchaseQuotation(r.id))} className="text-xs py-0.5 px-2 text-red-600 hover:underline">Cancel</button>
                    </>}
                    {r.status === 'approved' && <button onClick={() => act(() => cancelPurchaseQuotation(r.id))} className="text-xs py-0.5 px-2 text-red-600 hover:underline">Cancel</button>}
                    {r.status === 'cancelled' && <span className="text-xs text-gray-400">–</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
