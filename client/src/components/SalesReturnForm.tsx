import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { SalesReturn, SalesReturnLine } from '../types/salesReturn';
import { SR_STATUS_LABELS } from '../types/salesReturn';
import { createSalesReturn, updateSalesReturn, getSalesReturn } from '../api/salesReturns';
import { validatePercent, validatePositive } from '../utils/validators';

interface Customer    { id: number; print_name: string; }
interface Product     { id: number; name: string; sale_price: number; sale_tax_id: number | null; }
interface Tax         { id: number; name: string; rate: number; }
interface BankAccount { id: number; name: string; }

interface Props {
  ret: SalesReturn | null;
  onClose: () => void;
  onSaved: () => void;
}

function emptyLine(): SalesReturnLine {
  return { product_id: null, description: '', quantity: 0, unit_price: 0, discount_pct: 0, amount: 0, tax_id: null, tax_amount: 0, disposition: 'restock' };
}

function lineAmount(l: SalesReturnLine) {
  return l.quantity * l.unit_price * (1 - l.discount_pct / 100);
}

function lineTaxAmt(l: SalesReturnLine, taxes: Tax[]) {
  const t = taxes.find(x => x.id === l.tax_id);
  return t ? lineAmount(l) * t.rate / 100 : 0;
}

export default function SalesReturnForm({ ret, onClose, onSaved }: Props) {
  const [customers,       setCustomers]       = useState<Customer[]>([]);
  const [products,        setProducts]        = useState<Product[]>([]);
  const [taxes,           setTaxes]           = useState<Tax[]>([]);
  const [bankAccounts,    setBankAccounts]    = useState<BankAccount[]>([]);
  const [customerId,      setCustomerId]      = useState('');
  const [date,            setDate]            = useState(new Date().toISOString().slice(0, 10));
  const [reference,       setReference]       = useState('');
  const [subject,         setSubject]         = useState('');
  const [discountPct,     setDiscountPct]     = useState('0');
  const [shippingCharges, setShippingCharges] = useState('0');
  const [roundOff,        setRoundOff]        = useState('0');
  const [bankAccountId,   setBankAccountId]   = useState('');
  const [payReference,    setPayReference]    = useState('');
  const [refunded,        setRefunded]        = useState('0');
  const [comments,           setComments]           = useState('');
  const [makeAutoSettlements,setMakeAutoSettlements] = useState(true);
  const [lines,              setLines]              = useState<SalesReturnLine[]>([emptyLine()]);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState('');
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [lineErrors,      setLineErrors]      = useState<Record<number, Partial<Record<'quantity' | 'unit_price' | 'discount_pct', string>>>>({});

  // Quickly Add Products / Scan modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanQuery,     setScanQuery]     = useState('');
  const [scanError,     setScanError]     = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);

  const status = ret?.status || 'draft';

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : []));
    apiFetch('/api/bank-accounts?limit=200').then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  useEffect(() => {
    if (!ret) return;
    getSalesReturn(ret.id).then(full => {
      setCustomerId(String(full.customer_id));
      setDate(full.date?.slice(0, 10) ?? '');
      setReference(full.reference ?? '');
      setSubject(full.notes ?? '');
      const grossAmt = Number(full.gross_amount ?? 0);
      setDiscountPct(grossAmt > 0 ? String((Number(full.discount ?? 0) / grossAmt) * 100) : '0');
      setLines(full.lines?.length ? full.lines.map(l => ({ ...l, quantity: Math.round(Number(l.quantity)) })) : [emptyLine()]);
    });
  }, [ret]);

  function updateLine(i: number, patch: Partial<SalesReturnLine>) {
    setLines(prev => {
      const next = prev.map((l, idx) => idx !== i ? l : { ...l, ...patch });
      if ('product_id' in patch) {
        const p = products.find(x => x.id === patch.product_id);
        if (p) next[i] = { ...next[i], unit_price: p.sale_price, tax_id: p.sale_tax_id, description: p.name };
      }
      const l = next[i];
      next[i] = { ...l, amount: lineAmount(l), tax_amount: lineTaxAmt(l, taxes) };
      return next;
    });
  }

  function openScanModal() {
    setScanQuery(''); setScanError(''); setShowScanModal(true);
    setTimeout(() => scanInputRef.current?.focus(), 80);
  }

  function handleScanEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = scanQuery.trim().toLowerCase();
    if (!q) return;
    const match = products.find(p => p.name.toLowerCase().includes(q));
    if (!match) { setScanError(`No product found for "${scanQuery}"`); return; }
    setLines(prev => {
      const existing = prev.findIndex(l => l.product_id === match.id);
      let next: SalesReturnLine[];
      let idx: number;
      if (existing !== -1) {
        idx = existing;
        next = prev.map((l, i) => i === existing ? { ...l, quantity: (l.quantity || 0) + 1 } : l);
      } else {
        const blank = prev.findIndex(l => !l.product_id);
        if (blank !== -1) {
          idx = blank;
          next = prev.map((l, i) => i === blank ? { ...l, product_id: match.id, quantity: 1, unit_price: match.sale_price, tax_id: match.sale_tax_id, description: match.name } : l);
        } else {
          idx = prev.length;
          next = [...prev, { ...emptyLine(), product_id: match.id, quantity: 1, unit_price: match.sale_price, tax_id: match.sale_tax_id, description: match.name }];
        }
      }
      const l = next[idx];
      next[idx] = { ...l, amount: lineAmount(l), tax_amount: lineTaxAmt(l, taxes) };
      return next;
    });
    setScanQuery(''); setScanError('');
    scanInputRef.current?.focus();
  }

  const gross    = lines.reduce((s, l) => s + lineAmount(l), 0);
  const taxTotal = lines.reduce((s, l) => s + lineTaxAmt(l, taxes), 0);
  const discPct  = Number(discountPct || 0);
  const discAmt  = gross * discPct / 100;
  const shipping = Number(shippingCharges || 0);
  const roundOff_ = Number(roundOff || 0);
  const net      = gross - discAmt + taxTotal + shipping + roundOff_;
  const balance  = net - Number(refunded || 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!customerId) e.customerId = 'Customer is required.';
    if (!date) e.date = 'Date is required.';

    const discErr = validatePercent(discPct, 'Discount'); if (discErr) e.discountPct = discErr;
    const shipErr = validatePositive(shipping, 'Shipping charges'); if (shipErr) e.shippingCharges = shipErr;
    const refundErr = validatePositive(Number(refunded || 0), 'Refund amount');
    if (refundErr) e.refunded = refundErr;
    else if (Number(refunded || 0) > net) e.refunded = 'Refund amount cannot exceed the net amount.';

    const validLines = lines.filter(l => l.product_id || l.quantity > 0);
    if (validLines.length === 0) e.lines = 'At least one line item is required.';

    const le: typeof lineErrors = {};
    lines.forEach((l, i) => {
      const li: Partial<Record<'quantity' | 'unit_price' | 'discount_pct', string>> = {};
      const qErr = validatePositive(l.quantity, 'Quantity'); if (qErr) li.quantity = qErr;
      const pErr = validatePositive(l.unit_price, 'Unit price'); if (pErr) li.unit_price = pErr;
      const dErr = validatePercent(l.discount_pct, 'Discount'); if (dErr) li.discount_pct = dErr;
      if (Object.keys(li).length) le[i] = li;
    });
    setLineErrors(le);
    setErrors(e);
    return Object.keys(e).length === 0 && Object.keys(le).length === 0;
  }

  async function handleSave() {
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        customer_id: Number(customerId),
        invoice_id: null,
        date,
        reference: reference || null,
        notes: subject || null,
        discount: discAmt,
        lines: lines
          .filter(l => l.product_id || l.quantity > 0)
          .map(l => ({ ...l, description: l.description || '', tax_amount: lineTaxAmt(l, taxes) })),
      };
      if (ret) await updateSalesReturn(ret.id, payload);
      else     await createSalesReturn(payload);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">
            Sale Returns {ret?.number ? `- [${ret.number}]` : '- New'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold tracking-widest text-gray-400 uppercase">
              {(SR_STATUS_LABELS[status] || 'DRAFT').toUpperCase()}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {/* Row 1: Customer | Number | Date | Reference */}
          <div className="flex gap-4 items-end">
            <div className="flex-[2]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full border-2 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 ${errors.customerId ? 'border-red-500' : 'border-red-400'}`}
                value={customerId} onChange={e => setCustomerId(e.target.value)}
              >
                <option value="">Type to search customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
              </select>
              {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
            </div>
            <div className="flex-[1.5]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <button type="button" className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-l border border-green-700 hover:bg-green-700">+▼</button>
                <input type="text" readOnly value={ret?.number || 'SR-000001'}
                  className="flex-1 border-t border-b border-gray-300 px-2 py-1.5 text-sm bg-white text-gray-700 text-center focus:outline-none min-w-0" />
                <button type="button" className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-r border border-green-700 hover:bg-green-700">↺</button>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input type="date" className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
                value={date} onChange={e => setDate(e.target.value)} />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reference</label>
              <input type="text" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference" />
            </div>
          </div>

          {/* Row 2: Subject | QUICKLY ADD PRODUCTS / SCAN */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
              <input type="text" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
            </div>
            <div className="shrink-0">
              <button type="button" onClick={openScanModal} className="flex items-center gap-2 bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded hover:bg-green-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                QUICKLY ADD PRODUCTS / SCAN
              </button>
            </div>
          </div>

          {/* Quickly Add Products / Scan Modal */}
          {showScanModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">Quickly Add Products / Scan</h3>
                  <button onClick={() => setShowScanModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm text-gray-600 mb-3">Enter SKU, barcode, product code or name to search.</p>
                  <input
                    ref={scanInputRef}
                    type="text"
                    className="w-full border-2 border-green-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                    value={scanQuery}
                    onChange={e => { setScanQuery(e.target.value); setScanError(''); }}
                    onKeyDown={handleScanEnter}
                    autoFocus
                  />
                  {scanError ? (
                    <p className="mt-2 text-sm text-red-500">{scanError}</p>
                  ) : (
                    <div className="mt-3 space-y-1">
                      <p className="text-sm text-blue-500">Please scan barcode.</p>
                      <p className="text-sm text-blue-500">Please type product SKU, product code or product name and press enter.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lines Table */}
          <div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Product</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-28">Quantity</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-28">Price</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-36">Disc.</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-28">Amount</th>
                  <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden">
                        <select
                          className="flex-1 bg-transparent text-xs text-gray-700 px-2 py-1 focus:outline-none"
                          value={l.product_id ?? ''}
                          onChange={e => updateLine(i, { product_id: e.target.value ? Number(e.target.value) : null })}
                        >
                          <option value="">Type to search product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <span className="text-gray-400 pr-2 text-xs">▼</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" min="0" step="1" value={l.quantity}
                        onChange={e => updateLine(i, { quantity: Math.round(Number(e.target.value)) })}
                        className={`w-full text-right text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${lineErrors[i]?.quantity ? 'border-red-500' : 'border-gray-300'}`} />
                      {lineErrors[i]?.quantity && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].quantity}</p>}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" min="0" step="any" value={l.unit_price}
                        onChange={e => updateLine(i, { unit_price: Number(e.target.value) })}
                        className={`w-full text-right text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${lineErrors[i]?.unit_price ? 'border-red-500' : 'border-gray-300'}`} />
                      {lineErrors[i]?.unit_price && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].unit_price}</p>}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="100" step="any" value={l.discount_pct}
                          onChange={e => updateLine(i, { discount_pct: Number(e.target.value) })}
                          className={`flex-1 text-right text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${lineErrors[i]?.discount_pct ? 'border-red-500' : 'border-gray-300'}`} />
                        <button type="button" className="border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 whitespace-nowrap">% ▼</button>
                      </div>
                      {lineErrors[i]?.discount_pct && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].discount_pct}</p>}
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input readOnly value={lineAmount(l).toFixed(2)}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 bg-gray-50 focus:outline-none" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" className="text-gray-500 hover:text-green-700 font-bold text-base leading-none">✓</button>
                        <button type="button"
                          onClick={() => lines.length > 1 && setLines(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-500 hover:text-red-600 font-bold text-base leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="mt-2 text-xs text-blue-600 hover:underline">+ Add Line</button>
            {errors.lines && <p className="text-xs text-red-500 mt-1">{errors.lines}</p>}
          </div>

          {/* Comments + Summary */}
          <div className="flex gap-8 pt-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Comments</label>
              <textarea rows={5}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                value={comments} onChange={e => setComments(e.target.value)} placeholder="Comments" />
            </div>
            <div className="w-72 space-y-2 text-sm pt-5">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Gross</span>
                <span className="font-mono text-gray-800">{gross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-600 shrink-0">Discount</span>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" step="any" value={discountPct}
                    onChange={e => setDiscountPct(e.target.value)}
                    className={`w-14 text-right text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.discountPct ? 'border-red-500' : 'border-gray-300'}`} />
                  <span className="text-xs text-gray-500 border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50">%</span>
                  <input readOnly value={discAmt.toFixed(2)}
                    className="w-20 text-right text-xs border border-gray-300 rounded px-1 py-0.5 bg-gray-50 focus:outline-none" />
                </div>
              </div>
              {errors.discountPct && <p className="text-xs text-red-500 text-right -mt-1">{errors.discountPct}</p>}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tax</span>
                <span className="font-mono text-gray-800">{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-600 shrink-0">Shipping Charges</span>
                <input type="number" min="0" step="any" value={shippingCharges}
                  onChange={e => setShippingCharges(e.target.value)}
                  className={`w-24 text-right text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.shippingCharges ? 'border-red-500' : 'border-gray-300'}`} />
              </div>
              {errors.shippingCharges && <p className="text-xs text-red-500 text-right -mt-1">{errors.shippingCharges}</p>}
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-600 shrink-0">Round Off</span>
                <input type="number" step="any" value={roundOff}
                  onChange={e => setRoundOff(e.target.value)}
                  className="w-24 text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-gray-700 font-medium">Net (PKR)</span>
                <span className="font-mono font-medium text-gray-900">{net.toFixed(2)}</span>
              </div>

              {/* Cash / Bank Account section */}
              <div className="border-t pt-3 mt-1 space-y-2">
                <div className="grid grid-cols-3 gap-1 text-xs font-semibold text-gray-500 uppercase">
                  <span>Cash / Bank Account</span>
                  <span>Reference</span>
                  <span className="text-right">Refund (PKR)</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <select className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
                    <option value="">-Choose-</option>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Reference" value={payReference} disabled={!bankAccountId}
                    onChange={e => setPayReference(e.target.value)} />
                  <input type="number" min="0" step="any"
                    className={`border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.refunded ? 'border-red-500' : 'border-gray-300'}`}
                    value={refunded} disabled={!bankAccountId}
                    onChange={e => setRefunded(e.target.value)} />
                </div>
                {errors.refunded && <p className="text-xs text-red-500 text-right">{errors.refunded}</p>}
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-gray-700 text-xs font-medium">Balance (PKR)</span>
                  <span className={`font-mono text-xs font-medium ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{balance.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Make auto settlements */}
          <div className="border border-gray-200 rounded">
            <label className="flex items-center gap-2 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={makeAutoSettlements}
                onChange={e => setMakeAutoSettlements(e.target.checked)}
                className="w-4 h-4 accent-green-600"
              />
              <span className="text-sm text-gray-700">Make auto settlements</span>
            </label>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <th className="border border-gray-200 px-3 py-2 w-8">
                    <input type="checkbox" className="w-3.5 h-3.5" />
                  </th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 w-28">Date</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 w-28">Due Date</th>
                  <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-700 w-32">Total Amount</th>
                  <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-700 w-32">Adjusted Amount</th>
                  <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-700 w-32">Balance Amount</th>
                  <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-700 w-24">Allocate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={8} className="border border-gray-200 px-3 py-4 text-orange-500">
                    No record found
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pb-4 pt-2">
            <div className="flex">
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-l hover:bg-green-800 disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'SAVING…' : 'SAVE AND NEW'}
              </button>
              <button type="button"
                className="bg-green-700 text-white text-xs font-semibold px-2 py-2 rounded-r border-l border-green-800 hover:bg-green-800">
                ▼
              </button>
            </div>
            <button type="button" onClick={onClose}
              className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-semibold px-4 py-2 rounded hover:bg-orange-600">
              × CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

