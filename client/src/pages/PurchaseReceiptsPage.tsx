import { useEffect, useState } from 'react';
import type { PurchaseReceipt, GRNStatus } from '../types/purchaseReceipt';
import { getPurchaseReceipts, confirmPurchaseReceipt, cancelPurchaseReceipt, deletePurchaseReceipt } from '../api/purchaseReceipts';
import PurchaseReceiptForm from '../components/PurchaseReceiptForm';

const STATUS_COLORS: Record<GRNStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseReceiptsPage() {
  const [items,   setItems]   = useState<PurchaseReceipt[]>([]);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('');
  const [editing, setEditing] = useState<PurchaseReceipt | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const p: Record<string,string> = {};
    if (search) p.search = search;
    if (status) p.status = status;
    try { setItems(await getPurchaseReceipts(p)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [search, status]);

  async function act(fn: () => Promise<PurchaseReceipt | void>, label: string) {
    try { await fn(); load(); } catch (e: unknown) { alert(e instanceof Error ? e.message : label + ' failed'); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Receipts (GRN)</h1>
        <button className="btn-primary" onClick={() => setEditing(null)}>+ New GRN</button>
      </div>
      <div className="flex gap-3 mb-4">
        <input className="input w-64" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-36" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {loading ? <p className="text-gray-500">Loading…</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="table-th">Number</th><th className="table-th">Date</th>
              <th className="table-th">Vendor</th><th className="table-th">Warehouse</th>
              <th className="table-th">Reference</th><th className="table-th">Status</th>
              <th className="table-th w-36"></th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="table-td font-medium">{item.number}</td>
                  <td className="table-td">{item.date?.slice(0,10)}</td>
                  <td className="table-td">{item.vendor_name}</td>
                  <td className="table-td">{item.warehouse_name}</td>
                  <td className="table-td text-gray-500">{item.reference || '—'}</td>
                  <td className="table-td">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                  </td>
                  <td className="table-td text-right space-x-2">
                    {item.status === 'draft' && <>
                      <button onClick={() => setEditing(item)} className="text-indigo-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => act(() => confirmPurchaseReceipt(item.id), 'Confirm')} className="text-green-600 hover:underline text-xs">Confirm</button>
                      <button onClick={() => act(() => deletePurchaseReceipt(item.id), 'Delete')} className="text-red-500 hover:underline text-xs">Delete</button>
                    </>}
                    {item.status === 'confirmed' && <button onClick={() => act(() => cancelPurchaseReceipt(item.id), 'Cancel')} className="text-red-500 hover:underline text-xs">Cancel</button>}
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={7} className="table-td text-center text-gray-400 py-8">No receipts found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && <PurchaseReceiptForm receipt={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
    </div>
  );
}
