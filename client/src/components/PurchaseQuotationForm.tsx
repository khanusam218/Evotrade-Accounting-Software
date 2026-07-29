import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { PurchaseQuotation, PurchaseQuotationLine } from '../types/purchaseQuotation';
import { createPurchaseQuotation, updatePurchaseQuotation, getPurchaseQuotation } from '../api/purchaseQuotations';
import { validatePercent, validatePositive } from '../utils/validators';

interface Vendor  { id: number; print_name: string; }
interface Product { id: number; name: string; purchase_price: number; purchase_tax_id: number | null; }
interface Tax     { id: number; name: string; rate: number; }

interface Props { quotation: PurchaseQuotation | null; onClose: () => void; onSaved: () => void; }

const emptyLine = (): PurchaseQuotationLine => ({ product_id: null, description: '', quantity: 1, unit_price: 0, discount_pct: 0, amount: 0, tax_id: null, tax_amount: 0 });
const lineAmt   = (l: PurchaseQuotationLine) => l.quantity * l.unit_price * (1 - l.discount_pct / 100);
const lineTax   = (l: PurchaseQuotationLine, taxes: Tax[]) => { const t = taxes.find(x => x.id === l.tax_id); return t ? lineAmt(l) * t.rate / 100 : 0; };

export default function PurchaseQuotationForm({ quotation, onClose, onSaved }: Props) {
  const [vendors,  setVendors]  = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxes,    setTaxes]    = useState<Tax[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().slice(0,10));
  const [reference,setReference]= useState('');
  const [notes,    setNotes]    = useState('');
  const [discount, setDiscount] = useState('0');
  const [lines,    setLines]    = useState<PurchaseQuotationLine[]>([emptyLine()]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!quotation) return;
    getPurchaseQuotation(quotation.id).then(full => {
      setVendorId(String(full.vendor_id)); setDate(full.date?.slice(0,10) ?? '');
      setReference(full.reference ?? ''); setNotes(full.notes ?? '');
      setDiscount(String(full.discount ?? 0));
      setLines(full.lines?.length ? full.lines.map(l => ({ ...l, quantity: Math.round(Number(l.quantity)) })) : [emptyLine()]);
    });
  }, [quotation]);

  function updateLine(i: number, patch: Partial<PurchaseQuotationLine>) {
    setLines(prev => {
      const next = prev.map((l, idx) => idx !== i ? l : { ...l, ...patch });
      if ('product_id' in patch) {
        const p = products.find(x => x.id === patch.product_id);
        if (p) next[i] = { ...next[i], unit_price: p.purchase_price, tax_id: p.purchase_tax_id };
      }
      const l = next[i];
      next[i] = { ...l, amount: lineAmt(l), tax_amount: lineTax(l, taxes) };
      return next;
    });
  }

  const gross = lines.reduce((s,l) => s + lineAmt(l), 0);
  const taxTotal = lines.reduce((s,l) => s + lineTax(l, taxes), 0);
  const disc = Number(discount || 0);
  const net = gross - disc + taxTotal;

  function validate() {
    const e: Record<string, string> = {};
    if (!vendorId) e.vendor = 'Vendor is required.';
    if (!date) e.date = 'Date is required.';
    const discErr = validatePositive(disc, 'Header discount'); if (discErr) e.discount = discErr;
    const validLines = lines.filter(l => l.description);
    if (!validLines.length) e.lines = 'At least one product line is required.';
    lines.forEach((l, i) => {
      if (!l.description) return;
      const qtyErr = validatePositive(l.quantity, 'Quantity'); if (qtyErr) e[`qty_${i}`] = qtyErr;
      const priceErr = validatePositive(l.unit_price, 'Unit price'); if (priceErr) e[`price_${i}`] = priceErr;
      const discPctErr = validatePercent(l.discount_pct, 'Discount %'); if (discPctErr) e[`disc_${i}`] = discPctErr;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { vendor_id: Number(vendorId), date, reference: reference || null, notes: notes || null, discount: disc, lines: lines.filter(l => l.description) };
      if (quotation) await updatePurchaseQuotation(quotation.id, payload);
      else await createPurchaseQuotation(payload);
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{quotation ? 'Edit RFQ' : 'New Purchase Quotation (RFQ)'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Vendor *</label>
                <select className={`input ${errors.vendor ? 'border-red-500' : ''}`} value={vendorId} onChange={e => setVendorId(e.target.value)} required>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                </select>
                {errors.vendor && <p className="text-xs text-red-500 mt-1">{errors.vendor}</p>}</div>
              <div><label className="label">Date *</label><input type="date" className={`input ${errors.date ? 'border-red-500' : ''}`} value={date} onChange={e => setDate(e.target.value)} required />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}</div>
              <div><label className="label">Reference</label><input className="input" value={reference} onChange={e => setReference(e.target.value)} /></div>
              <div className="col-span-3"><label className="label">Notes</label><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-50">
                  <th className="table-th w-36">Product</th><th className="table-th">Description</th>
                  <th className="table-th w-24 text-right">Qty</th><th className="table-th w-32 text-right">Unit Price</th>
                  <th className="table-th w-24 text-right">Disc%</th><th className="table-th w-32">Tax</th>
                  <th className="table-th w-24 text-right">Tax Amt</th><th className="table-th w-28 text-right">Amount</th><th className="table-th w-8"></th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="table-td"><select className="input py-1 text-xs" value={l.product_id ?? ''} onChange={e => updateLine(i, { product_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">–</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select></td>
                      <td className="table-td"><input className="input py-1 text-xs" value={l.description} onChange={e => updateLine(i, { description: e.target.value })} /></td>
                      <td className="table-td px-1"><input type="number" min="0" step="1" className={`input px-1 py-1 text-xs text-right w-full ${errors[`qty_${i}`] ? 'border-red-500' : ''}`} value={l.quantity} onChange={e => updateLine(i, { quantity: Math.round(Number(e.target.value)) })} /></td>
                      <td className="table-td px-1"><input type="number" min="0" step="any" className={`input px-1 py-1 text-xs text-right w-full ${errors[`price_${i}`] ? 'border-red-500' : ''}`} value={l.unit_price} onChange={e => updateLine(i, { unit_price: Number(e.target.value) })} /></td>
                      <td className="table-td px-1"><input type="number" min="0" max="100" step="any" className={`input px-1 py-1 text-xs text-right w-full ${errors[`disc_${i}`] ? 'border-red-500' : ''}`} value={l.discount_pct} onChange={e => updateLine(i, { discount_pct: Number(e.target.value) })} /></td>
                      <td className="table-td"><select className="input py-1 text-xs" value={l.tax_id ?? ''} onChange={e => { const tid = e.target.value ? Number(e.target.value) : null; setLines(prev => { const n=[...prev]; n[i]={...n[i],tax_id:tid,tax_amount:lineTax({...n[i],tax_id:tid},taxes)}; return n; }); }}>
                        <option value="">None</option>{taxes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
                      </select></td>
                      <td className="table-td text-right text-xs font-mono">{lineTax(l,taxes).toFixed(2)}</td>
                      <td className="table-td text-right text-xs font-mono">{lineAmt(l).toFixed(2)}</td>
                      <td className="table-td text-center">{lines.length > 1 && <button type="button" onClick={() => setLines(prev => prev.filter((_,j) => j !== i))} className="text-red-400 hover:text-red-600">&times;</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])} className="mt-2 text-sm text-indigo-600 hover:underline">+ Add Line</button>
              {errors.lines && <p className="text-xs text-red-500 mt-1">{errors.lines}</p>}
            </div>
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Gross Amount</span><span>{gross.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tax Amount</span><span>{taxTotal.toFixed(2)}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500">Header Discount</span>
                  <div>
                    <input type="number" min="0" step="any" className={`input py-0.5 text-xs w-28 text-right ${errors.discount ? 'border-red-500' : ''}`} value={discount} onChange={e => setDiscount(e.target.value)} />
                    {errors.discount && <p className="text-xs text-red-500 mt-1">{errors.discount}</p>}
                  </div></div>
                <div className="flex justify-between font-semibold border-t pt-1"><span>Net Amount</span><span>{net.toFixed(2)}</span></div>
              </div>
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

