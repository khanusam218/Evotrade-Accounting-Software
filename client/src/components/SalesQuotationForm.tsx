import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import { createSalesQuotation, getSalesQuotation, updateSalesQuotation, getNextQuotationNumber } from '../api/salesQuotations';
import type { SalesQuotation, SalesQuotationLine } from '../types/salesQuotation';
import { SQ_STATUS_LABELS, SQ_STATUS_COLORS } from '../types/salesQuotation';
import QuickAddModal from './QuickAddModal';

interface Props { quotation: SalesQuotation | null; onClose: () => void; onSaved: () => void; }
interface Customer { id: number; print_name: string; }
interface Product  { id: number; name: string; sale_price: number; sale_tax_id: number | null; }
interface Tax      { id: number; name: string; rate: number; }
interface AttachFile { name: string; size: string; }

const emptyLine = (): SalesQuotationLine => ({
  product_id: null, description: '', quantity: 1, unit_price: 0, discount_pct: 0, amount: 0, tax_id: null, tax_amount: 0,
});

function lineAmount(l: SalesQuotationLine) {
  return Number(l.quantity) * Number(l.unit_price) * (1 - Number(l.discount_pct) / 100);
}
function lineTaxAmt(l: SalesQuotationLine, taxes: Tax[]) {
  if (!l.tax_id) return 0;
  const t = taxes.find(x => x.id === l.tax_id);
  return t ? lineAmount(l) * t.rate / 100 : 0;
}
const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SalesQuotationForm({ quotation, onClose, onSaved }: Props) {
  const isEdit = quotation !== null;
  const [saving, setSaving]       = useState(false);
  const [error,  setError]        = useState<string | null>(null);
  const [nextNum, setNextNum]     = useState('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [taxes,     setTaxes]     = useState<Tax[]>([]);

  const [customerId,   setCustomerId]   = useState('');
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate,   setExpiryDate]   = useState('');
  const [reference,    setReference]    = useState('');
  const [subject,      setSubject]      = useState('');
  const [notes,        setNotes]        = useState('');
  const [discountPct,  setDiscountPct]  = useState(0);
  const [shippingCharges, setShipping]  = useState(0);
  const [lines,        setLines]        = useState<SalesQuotationLine[]>([emptyLine()]);
  const [attachFiles,    setAttachFiles]    = useState<AttachFile[]>([]);
  const [showQuickAdd,   setShowQuickAdd]   = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (d?.data ?? [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (d?.data ?? [])));
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : []));
    if (!isEdit) getNextQuotationNumber().then(d => setNextNum(d.number)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!quotation) return;
    setCustomerId(String(quotation.customer_id));
    setDate(quotation.date.slice(0, 10));
    setExpiryDate(quotation.expiry_date?.slice(0, 10) ?? '');
    setReference(quotation.reference ?? '');
    setSubject(quotation.subject ?? '');
    setNotes(quotation.notes ?? '');
    setDiscountPct(Number(quotation.discount_pct ?? 0));
    setShipping(Number(quotation.shipping_charges ?? 0));
    getSalesQuotation(quotation.id).then(q => setLines(q.lines?.length ? q.lines : [emptyLine()]));
  }, [quotation]);

  const gross       = lines.reduce((s, l) => s + lineAmount(l), 0);
  const taxTotal    = lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
  const discAmount  = gross * discountPct / 100;
  const netTotal    = gross - discAmount + taxTotal + shippingCharges;

  function updateLine(i: number, field: keyof SalesQuotationLine, value: string | number | null) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      if (field === 'product_id' && value) {
        const p = products.find(p => p.id === Number(value));
        if (p) { updated.description = p.name; updated.unit_price = Number(p.sale_price); updated.tax_id = p.sale_tax_id ?? null; }
      }
      updated.amount = lineAmount(updated);
      updated.tax_amount = lineTaxAmt(updated, taxes);
      return updated;
    }));
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setAttachFiles(prev => [...prev, ...files.map(f => ({
      name: f.name,
      size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`,
    }))]);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!customerId) { setError('Customer is required'); return; }
    if (!lines.some(l => l.description.trim())) { setError('At least one line with a description is required'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: Number(customerId), date, expiry_date: expiryDate || null,
        reference: reference || null, subject: subject || null, notes: notes || null,
        discount_pct: discountPct, shipping_charges: shippingCharges,
        lines: lines.filter(l => l.description.trim()),
      };
      if (isEdit) await updateSalesQuotation(quotation!.id, payload);
      else        await createSalesQuotation(payload);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const currentStatus = isEdit ? quotation!.status : 'draft';

  return (
    <>
    {showQuickAdd && (
      <QuickAddModal
        products={products}
        taxes={taxes}
        onAdd={line => setLines(prev => {
          const last = prev[prev.length - 1];
          const isBlank = !last.description.trim() && last.unit_price === 0;
          const base = isBlank ? prev.slice(0, -1) : prev;
          return [...base, line as SalesQuotationLine];
        })}
        onClose={() => setShowQuickAdd(false)}
      />
    )}
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit
              ? `Sale Quotation - Edit [${quotation!.number}]`
              : `Sale Quotation - Add [${nextNum || '…'}]`}
          </h2>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded text-sm font-bold uppercase tracking-wide ${SQ_STATUS_COLORS[currentStatus]}`}>
              {SQ_STATUS_LABELS[currentStatus]}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            {/* ── Row 1: Customer · Number · Date · Expiry · Reference ── */}
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="label">Customer <span className="text-red-500">*</span></label>
                <select className="input w-full" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                  <option value="">Type to search customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>
              <div className="w-40 shrink-0">
                <label className="label">Number <span className="text-red-500">*</span></label>
                <input className="input bg-gray-50 cursor-not-allowed font-mono text-sm" readOnly
                  value={isEdit ? quotation!.number : (nextNum || 'Auto')} />
              </div>
              <div className="w-36 shrink-0">
                <label className="label">Date <span className="text-red-500">*</span></label>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="w-36 shrink-0">
                <label className="label">Expiry Date <span className="text-red-500">*</span></label>
                <input type="date" className="input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
              </div>
              <div className="w-36 shrink-0">
                <label className="label">Reference</label>
                <input className="input" placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
            </div>

            {/* ── Subject ── */}
            <div>
              <label className="label">Subject</label>
              <input className="input w-full" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            {/* ── Line Items ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setShowQuickAdd(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    QUICKLY ADD PRODUCTS / SCAN
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-th w-40">Product</th>
                      <th className="table-th">Description</th>
                      <th className="table-th text-right w-20">Qty</th>
                      <th className="table-th text-right w-28">Price</th>
                      <th className="table-th text-right w-20">Disc.%</th>
                      <th className="table-th w-32">Tax</th>
                      <th className="table-th text-right w-24">Tax Amt</th>
                      <th className="table-th text-right w-28">Amount</th>
                      <th className="table-th w-10">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((l, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="table-td">
                          <select className="input w-full text-xs py-1"
                            value={l.product_id ?? ''}
                            onChange={e => updateLine(i, 'product_id', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">Type to search product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="table-td">
                          <input className="input w-full text-xs py-1" value={l.description}
                            onChange={e => updateLine(i, 'description', e.target.value)} />
                        </td>
                        <td className="table-td">
                          <input type="number" className="input w-full text-right text-xs py-1"
                            value={l.quantity} min="0.0001" step="0.0001"
                            onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 1)} />
                        </td>
                        <td className="table-td">
                          <input type="number" className="input w-full text-right text-xs py-1"
                            value={l.unit_price} min="0" step="0.0001"
                            onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-1">
                            <input type="number" className="input flex-1 text-right text-xs py-1"
                              value={l.discount_pct} min="0" max="100" step="0.01"
                              onChange={e => updateLine(i, 'discount_pct', parseFloat(e.target.value) || 0)} />
                            <span className="text-gray-400 text-xs">%</span>
                          </div>
                        </td>
                        <td className="table-td">
                          <select className="input w-full text-xs py-1"
                            value={l.tax_id ?? ''}
                            onChange={e => updateLine(i, 'tax_id', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">None</option>
                            {taxes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td className="table-td text-right font-mono text-xs text-gray-500">{fmt(Number(l.tax_amount || 0))}</td>
                        <td className="table-td text-right font-mono text-xs font-semibold">{fmt(lineAmount(l))}</td>
                        <td className="table-td text-center">
                          <button type="button"
                            onClick={() => lines.length > 1 ? setLines(p => p.filter((_, idx) => idx !== i)) : updateLine(i, 'description', '')}
                            className="text-red-400 hover:text-red-600 text-lg leading-none font-bold">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setLines(p => [...p, emptyLine()])}
                className="mt-2 text-xs text-indigo-600 hover:underline font-medium">+ Add Line</button>
            </div>

            {/* ── Bottom: Terms + Attachments (left) | Summary (right) ── */}
            <div className="flex gap-6">

              {/* Left: Terms + Attachments */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="label">Terms</label>
                  <textarea className="input resize-none w-full" rows={4} placeholder="Terms and conditions"
                    value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Attachments</p>
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
                  <div
                    className="flex items-center justify-between rounded-lg border-2 border-dashed border-gray-200 px-5 py-4 cursor-pointer hover:border-indigo-400 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <span className="text-sm text-gray-400">Drop files here or</span>
                    <button type="button"
                      className="px-5 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 uppercase tracking-wide">
                      Browse Files
                    </button>
                  </div>
                  {attachFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachFiles.map((f, i) => (
                        <li key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-sm">
                          <span className="text-gray-700 truncate">{f.name}</span>
                          <span className="text-xs text-gray-400 mr-2">{f.size}</span>
                          <button type="button"
                            onClick={() => setAttachFiles(p => p.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right: Summary */}
              <div className="w-80 shrink-0">
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700">Gross</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(gross)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-700">Discount</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <input type="number" min={0} max={100} step="0.01"
                              className="input w-16 text-right text-xs py-1"
                              value={discountPct}
                              onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)} />
                            <span className="text-gray-500 text-xs">%</span>
                            <span className="font-mono text-sm w-20 text-right">{fmt(discAmount)}</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700">Tax</td>
                        <td className="px-4 py-3 text-right font-mono">{fmt(taxTotal)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-700">Shipping Charges</td>
                        <td className="px-4 py-3 flex justify-end">
                          <input type="number" min={0} step="0.01"
                            className="input w-28 text-right text-xs py-1"
                            value={shippingCharges}
                            onChange={e => setShipping(parseFloat(e.target.value) || 0)} />
                        </td>
                      </tr>
                      <tr className="bg-indigo-50">
                        <td className="px-4 py-3 font-bold text-gray-900">Net (PKR)</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700 text-base">{fmt(netTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

