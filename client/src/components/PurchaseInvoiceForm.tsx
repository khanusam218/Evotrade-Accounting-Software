import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { PurchaseInvoice, PurchaseInvoiceLine } from '../types/purchaseInvoice';
import { PI_STATUS_LABELS } from '../types/purchaseInvoice';
import { createPurchaseInvoice, updatePurchaseInvoice, getPurchaseInvoice, getNextPurchaseInvoiceNumber } from '../api/purchaseInvoices';
import { validatePercent, validatePositive } from '../utils/validators';

interface Vendor      { id: number; print_name: string; }
interface Product     { id: number; name: string; purchase_price: number; purchase_tax_id: number | null; }
interface Tax         { id: number; name: string; rate: number; }
interface BankAccount { id: number; name: string; }

interface Props { invoice: PurchaseInvoice | null; onClose: () => void; onSaved: () => void; }

const emptyLine = (): PurchaseInvoiceLine => ({ product_id: null, description: '', quantity: 1, unit_price: 0, discount_pct: 0, amount: 0, tax_id: null, tax_amount: 0 });
const lineAmt   = (l: PurchaseInvoiceLine) => l.quantity * l.unit_price * (1 - l.discount_pct / 100);
const lineTax   = (l: PurchaseInvoiceLine, taxes: Tax[]) => { const t = taxes.find(x => x.id === l.tax_id); return t ? lineAmt(l) * t.rate / 100 : 0; };

export default function PurchaseInvoiceForm({ invoice, onClose, onSaved }: Props) {
  const [vendors,      setVendors]      = useState<Vendor[]>([]);
  const [products,     setProducts]     = useState<Product[]>([]);
  const [taxes,        setTaxes]        = useState<Tax[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [nextNum,      setNextNum]      = useState('PI-000001');

  const [vendorId,    setVendorId]    = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0,10));
  const [dueDate,     setDueDate]     = useState('');
  const [reference,   setReference]   = useState('');
  const [subject,     setSubject]     = useState('');
  const [notes,       setNotes]       = useState('');
  const [discPct,      setDiscPct]      = useState('0');
  const [shippingChgs, setShippingChgs] = useState('0');
  const [roundOff,     setRoundOff]     = useState('0');
  const [bankAccountId, setBankAccountId] = useState('');
  const [payReference,  setPayReference]  = useState('');
  const [payment,       setPayment]       = useState('0');
  const [lines,        setLines]        = useState<PurchaseInvoiceLine[]>([emptyLine()]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  const [showQuick,   setShowQuick]   = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const quickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : []));
    apiFetch('/api/bank-accounts?limit=200').then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    if (!invoice) getNextPurchaseInvoiceNumber().then(r => setNextNum(r.number)).catch(() => {});
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    getPurchaseInvoice(invoice.id).then(full => {
      setVendorId(String(full.vendor_id));
      setDate(full.date?.slice(0,10) ?? '');
      setDueDate(full.due_date?.slice(0,10) ?? '');
      setReference(full.reference ?? '');
      setSubject(full.subject ?? '');
      setNotes(full.notes ?? '');
      const grossAmt = Number(full.gross_amount ?? 0);
      setDiscPct(grossAmt > 0 ? String((Number(full.discount ?? 0) / grossAmt) * 100) : '0');
      setShippingChgs(String(full.shipping_charges ?? 0));
      setRoundOff(String(full.round_off ?? 0));
      setLines(full.lines?.length ? full.lines : [emptyLine()]);
      setNextNum(full.number);
    });
  }, [invoice]);

  useEffect(() => {
    if (!showQuick) return;
    function h(e: MouseEvent) { if (quickRef.current && !quickRef.current.contains(e.target as Node)) setShowQuick(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showQuick]);

  function updateLine(i: number, patch: Partial<PurchaseInvoiceLine>) {
    setLines(prev => {
      const next = prev.map((l, idx) => idx !== i ? l : { ...l, ...patch });
      if ('product_id' in patch) {
        const p = products.find(x => x.id === patch.product_id);
        if (p) next[i] = { ...next[i], unit_price: p.purchase_price, tax_id: p.purchase_tax_id, description: p.name };
      }
      const l = next[i];
      next[i] = { ...l, amount: lineAmt(l), tax_amount: lineTax(l, taxes) };
      return next;
    });
  }

  function addProduct(p: Product) {
    const newLine: PurchaseInvoiceLine = { ...emptyLine(), product_id: p.id, description: p.name, unit_price: p.purchase_price, tax_id: p.purchase_tax_id };
    newLine.amount = lineAmt(newLine);
    newLine.tax_amount = lineTax(newLine, taxes);
    setLines(prev => {
      const last = prev[prev.length - 1];
      if (!last.product_id && !last.description) return [...prev.slice(0, -1), newLine];
      return [...prev, newLine];
    });
    setShowQuick(false);
    setQuickSearch('');
  }

  const gross    = lines.reduce((s,l) => s + lineAmt(l), 0);
  const taxTotal = lines.reduce((s,l) => s + lineTax(l, taxes), 0);
  const discAmt  = gross * Number(discPct || 0) / 100;
  const shipping = Number(shippingChgs || 0);
  const roundOff_ = Number(roundOff || 0);
  const net      = gross - discAmt + taxTotal + shipping + roundOff_;
  const balance  = net - Number(payment || 0);
  const fmt      = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function validate() {
    const e: Record<string, string> = {};
    if (!vendorId) e.vendor = 'Vendor is required.';
    if (!date) e.date = 'Date is required.';
    if (!dueDate) e.dueDate = 'Due date is required.';
    const discErr = validatePercent(Number(discPct || 0), 'Discount'); if (discErr) e.discPct = discErr;
    const shipErr = validatePositive(Number(shippingChgs || 0), 'Shipping charges'); if (shipErr) e.shippingChgs = shipErr;
    const payErr = validatePositive(Number(payment || 0), 'Payment'); if (payErr) e.payment = payErr;
    const validLines = lines.filter(l => l.product_id || l.description);
    if (!validLines.length) e.lines = 'At least one product line is required.';
    lines.forEach((l, i) => {
      if (!(l.product_id || l.description)) return;
      const qtyErr = validatePositive(l.quantity, 'Quantity'); if (qtyErr) e[`qty_${i}`] = qtyErr;
      const priceErr = validatePositive(l.unit_price, 'Price'); if (priceErr) e[`price_${i}`] = priceErr;
      const discPctErr = validatePercent(l.discount_pct, 'Discount %'); if (discPctErr) e[`disc_${i}`] = discPctErr;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(e: React.FormEvent, continueEdit = false) {
    e.preventDefault(); setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const validLines = lines.filter(l => l.product_id || l.description);
      const payload = {
        vendor_id: Number(vendorId), date,
        due_date: dueDate || null,
        reference: reference || null, notes: notes || null, subject: subject || null,
        discount: discAmt,
        shipping_charges: shipping,
        round_off: roundOff_,
        lines: validLines,
      };
      if (invoice) await updatePurchaseInvoice(invoice.id, payload);
      else await createPurchaseInvoice(payload);
      if (!continueEdit) onSaved();
      else getNextPurchaseInvoiceNumber().then(r => setNextNum(r.number)).catch(() => {});
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(quickSearch.toLowerCase()));

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Purchase Invoices - [{nextNum}]
          </h2>
          <span className="text-sm font-bold text-gray-500 tracking-widest">
            {invoice ? PI_STATUS_LABELS[invoice.status].toUpperCase() : 'DRAFT'}
          </span>
        </div>

        <form onSubmit={e => handleSave(e)}>
          <div className="px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

            {/* Row 1: Vendor | Number | Date | Due Date | Reference */}
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                <select className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.vendor ? 'border-red-500' : 'border-gray-300'}`}
                  value={vendorId} onChange={e => setVendorId(e.target.value)} required>
                  <option value="">Type to search vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                </select>
                {errors.vendor && <p className="text-xs text-red-500 mt-1">{errors.vendor}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-1">
                  <button type="button" className="h-9 w-9 flex-shrink-0 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 font-mono" value={nextNum} readOnly />
                  <button type="button" onClick={() => getNextPurchaseInvoiceNumber().then(r => setNextNum(r.number)).catch(() => {})}
                    className="h-9 w-9 flex-shrink-0 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
                  value={date} onChange={e => setDate(e.target.value)} required />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                <input type="date" className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.dueDate ? 'border-red-500' : 'border-gray-300'}`}
                  value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
            </div>

            {/* Row 2: Subject + QUICKLY ADD */}
            <div className="grid grid-cols-4 gap-4 items-end">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div />
              <div className="flex justify-end relative" ref={quickRef}>
                <button type="button" onClick={() => setShowQuick(v => !v)}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  QUICKLY ADD PRODUCTS / SCAN
                </button>
                {showQuick && (
                  <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                    <div className="p-2 border-b">
                      <input autoFocus className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="Search products…" value={quickSearch} onChange={e => setQuickSearch(e.target.value)} />
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">No products found</div>
                      ) : filteredProducts.slice(0, 50).map(p => (
                        <button key={p.id} type="button" onClick={() => addProduct(p)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700">
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-80">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28">Quantity</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-32">Price</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-32">Disc.</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-32">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-16">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1.5">
                        <select className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50"
                          value={l.product_id ?? ''} onChange={e => updateLine(i, { product_id: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">Type to search product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="any" className={`w-full border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`qty_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                          value={l.quantity} onChange={e => updateLine(i, { quantity: Number(e.target.value) })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="any" className={`w-full border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`price_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                          value={l.unit_price} onChange={e => updateLine(i, { unit_price: Number(e.target.value) })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="100" step="any" className={`flex-1 border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`disc_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                            value={l.discount_pct} onChange={e => updateLine(i, { discount_pct: Number(e.target.value) })} />
                          <span className="text-xs text-gray-500 flex-shrink-0">%</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right bg-gray-50 font-mono">
                          {lineAmt(l).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => updateLine(i, {})}
                            className="h-7 w-7 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center text-xs font-bold">✓</button>
                          <button type="button" onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_,j) => j !== i) : [emptyLine()])}
                            className="h-7 w-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-xs font-bold">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])}
                className="mt-2 text-sm text-green-600 hover:text-green-700 hover:underline font-medium">
                + Add Line
              </button>
              {errors.lines && <p className="text-xs text-red-500 mt-1">{errors.lines}</p>}
            </div>

            {/* Comments (left) + Summary (right) */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Comments + Attachments */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                  <textarea rows={5} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                    placeholder="Comments" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 flex items-center gap-3 hover:border-green-400 transition-colors bg-gray-50">
                    <span className="text-sm text-gray-500">Drop files here or</span>
                    <button type="button" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded">
                      BROWSE FILES
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Summary + Cash/Bank Account + Balance */}
              <div className="space-y-0 text-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-600">Gross</span>
                  <span className="font-mono text-gray-800">{fmt(gross)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-600">Discount</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="100" step="any"
                      className={`w-16 border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.discPct ? 'border-red-500' : 'border-gray-300'}`}
                      value={discPct} onChange={e => setDiscPct(e.target.value)} />
                    <span className="text-gray-500 text-xs">%</span>
                    <span className="font-mono text-gray-700 w-20 text-right">{fmt(discAmt)}</span>
                  </div>
                  {errors.discPct && <p className="text-xs text-red-500 mt-1">{errors.discPct}</p>}
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-mono text-gray-800">{fmt(taxTotal)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-600">Shipping Charges</span>
                  <div>
                    <input type="number" min="0" step="any"
                      className={`w-28 border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.shippingChgs ? 'border-red-500' : 'border-gray-300'}`}
                      value={shippingChgs} onChange={e => setShippingChgs(e.target.value)} />
                    {errors.shippingChgs && <p className="text-xs text-red-500 mt-1">{errors.shippingChgs}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-600">Round Off</span>
                  <input type="number" step="any"
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={roundOff} onChange={e => setRoundOff(e.target.value)} />
                </div>
                <div className="flex items-center justify-between py-2 border-t-2 border-gray-300 mb-3">
                  <span className="font-bold text-gray-900">Net (PKR)</span>
                  <span className="font-bold font-mono text-gray-900">{fmt(net)}</span>
                </div>

                {/* Cash / Bank Account inside right panel */}
                <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase">
                    <span>Cash / Bank Account</span>
                    <span>Reference</span>
                    <span className="text-right">Payment (PKR)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                      value={bankAccountId} onChange={e => { setBankAccountId(e.target.value); if (!e.target.value) { setPayReference(''); setPayment('0'); } }}>
                      <option value="">-Choose-</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
                      placeholder="Reference" disabled={!bankAccountId}
                      value={payReference} onChange={e => setPayReference(e.target.value)} />
                    <input type="number" min="0" step="any"
                      className={`border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100 ${errors.payment ? 'border-red-500' : 'border-gray-300'}`}
                      disabled={!bankAccountId}
                      value={payment} onChange={e => setPayment(e.target.value)} />
                  </div>
                  {errors.payment && <p className="text-xs text-red-500 mt-1 text-right">{errors.payment}</p>}
                  <div className="flex justify-between items-center pt-1 border-t border-gray-200 text-sm">
                    <span className="text-gray-600 font-medium">Balance (PKR)</span>
                    <span className={`font-bold font-mono ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(balance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              {saving ? 'Saving…' : 'SAVE AND CONTINUE EDIT'}
            </button>
            <button type="button" onClick={onClose}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
              <span className="text-base leading-none">×</span>
              CLOSE
            </button>
          </div>
        </form>
    </div>
  );
}

