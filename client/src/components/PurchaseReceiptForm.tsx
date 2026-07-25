import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { PurchaseReceipt, PurchaseReceiptLine } from '../types/purchaseReceipt';
import { createPurchaseReceipt, updatePurchaseReceipt, getPurchaseReceipt } from '../api/purchaseReceipts';

interface Vendor        { id: number; print_name: string; }
interface Warehouse     { id: number; name: string; }
interface Product       { id: number; name: string; purchase_price: number; }
interface PurchaseOrder { id: number; number: string; }
interface Props         { receipt: PurchaseReceipt | null; onClose: () => void; onSaved: () => void; }

const emptyLine = (): PurchaseReceiptLine => ({ product_id: null, description: '', ordered_qty: 0, received_qty: 0, unit_cost: 0 });

export default function PurchaseReceiptForm({ receipt, onClose, onSaved }: Props) {
  const [vendors,     setVendors]     = useState<Vendor[]>([]);
  const [warehouses,  setWarehouses]  = useState<Warehouse[]>([]);
  const [products,    setProducts]    = useState<Product[]>([]);
  const [orders,      setOrders]      = useState<PurchaseOrder[]>([]);
  const [vendorId,    setVendorId]    = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [orderId,     setOrderId]     = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0,10));
  const [reference,   setReference]   = useState('');
  const [notes,       setNotes]       = useState('');
  const [lines,       setLines]       = useState<PurchaseReceiptLine[]>([emptyLine()]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/warehouses').then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  useEffect(() => {
    if (!vendorId) { setOrders([]); return; }
    apiFetch(`/api/purchase-orders?status=confirmed&vendor_id=${vendorId}`).then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : []));
  }, [vendorId]);

  useEffect(() => {
    if (!receipt) return;
    getPurchaseReceipt(receipt.id).then(full => {
      setVendorId(String(full.vendor_id)); setWarehouseId(String(full.warehouse_id));
      setOrderId(full.order_id ? String(full.order_id) : '');
      setDate(full.date?.slice(0,10) ?? ''); setReference(full.reference ?? ''); setNotes(full.notes ?? '');
      setLines(full.lines?.length ? full.lines : [emptyLine()]);
    });
  }, [receipt]);

  function updLine(i: number, patch: Partial<PurchaseReceiptLine>) {
    setLines(prev => prev.map((l, idx) => idx !== i ? l : { ...l, ...patch }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!vendorId)    { setError('Vendor is required'); return; }
    if (!warehouseId) { setError('Warehouse is required'); return; }
    setSaving(true);
    try {
      const payload = { vendor_id: Number(vendorId), warehouse_id: Number(warehouseId), order_id: orderId ? Number(orderId) : null, date, reference: reference || null, notes: notes || null, lines: lines.filter(l => l.description) };
      if (receipt) await updatePurchaseReceipt(receipt.id, payload);
      else await createPurchaseReceipt(payload);
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{receipt ? 'Edit Purchase Receipt' : 'New Purchase Receipt (GRN)'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Vendor *</label>
                <select className="input" value={vendorId} onChange={e => setVendorId(e.target.value)} required>
                  <option value="">Select vendor…</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                </select></div>
              <div><label className="label">Warehouse *</label>
                <select className="input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
                  <option value="">Select warehouse…</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select></div>
              <div><label className="label">Linked Purchase Order</label>
                <select className="input" value={orderId} onChange={e => setOrderId(e.target.value)}>
                  <option value="">None</option>{orders.map(o => <option key={o.id} value={o.id}>{o.number}</option>)}
                </select></div>
              <div><label className="label">Date</label><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required /></div>
              <div><label className="label">Reference</label><input className="input" value={reference} onChange={e => setReference(e.target.value)} /></div>
              <div><label className="label">Notes</label><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Receipt Lines</h3>
                <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])} className="text-sm text-indigo-600 hover:underline">+ Add Line</button>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-50">
                  <th className="table-th w-36">Product</th><th className="table-th">Description</th>
                  <th className="table-th w-24">Ordered Qty</th><th className="table-th w-24">Received Qty</th>
                  <th className="table-th w-28">Unit Cost</th><th className="table-th w-8"></th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="table-td"><select className="input py-1 text-xs" value={l.product_id ?? ''} onChange={e => { const pid = e.target.value ? Number(e.target.value) : null; const p = products.find(x => x.id === pid); updLine(i, { product_id: pid, description: p?.name ?? l.description, unit_cost: p?.purchase_price ?? l.unit_cost }); }}>
                        <option value="">–</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select></td>
                      <td className="table-td"><input className="input py-1 text-xs" value={l.description} onChange={e => updLine(i, { description: e.target.value })} /></td>
                      <td className="table-td"><input type="number" min="0" step="any" className="input py-1 text-xs text-right" value={l.ordered_qty} onChange={e => updLine(i, { ordered_qty: Number(e.target.value) })} /></td>
                      <td className="table-td"><input type="number" min="0" step="any" className="input py-1 text-xs text-right" value={l.received_qty} onChange={e => updLine(i, { received_qty: Number(e.target.value) })} /></td>
                      <td className="table-td"><input type="number" min="0" step="any" className="input py-1 text-xs text-right" value={l.unit_cost} onChange={e => updLine(i, { unit_cost: Number(e.target.value) })} /></td>
                      <td className="table-td text-center">{lines.length > 1 && <button type="button" onClick={() => setLines(prev => prev.filter((_,j) => j !== i))} className="text-red-400 hover:text-red-600">&times;</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t px-6 py-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


