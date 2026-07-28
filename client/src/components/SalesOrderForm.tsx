import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import { createSalesOrder, getNextOrderNumber, getSalesOrder, updateSalesOrder } from '../api/salesOrders';
import QuickAddModal from './QuickAddModal';
import { getSalesQuotation } from '../api/salesQuotations';
import type { SalesOrder, SalesOrderLine } from '../types/salesOrder';
import type { SalesQuotation } from '../types/salesQuotation';
import { SO_STATUS_COLORS, SO_STATUS_LABELS } from '../types/salesOrder';
import { validatePercent, validatePositive } from '../utils/validators';

interface Props {
  order: SalesOrder | null;
  fromQuotation?: SalesQuotation;
  onClose: () => void;
  onSaved: () => void;
}

interface Customer  { id: number; print_name: string; }
interface Product   { id: number; name: string; sale_price: number; sale_tax_id: number | null; description?: string | null; }
interface Tax       { id: number; name: string; rate: number; }
interface Quotation { id: number; number: string; }

const emptyLine = (): SalesOrderLine => ({
  product_id: null, description: '', quantity: 1, unit_price: 0, discount_pct: 0,
  amount: 0, invoiced_qty: 0, tax_id: null, tax_amount: 0,
});

interface LineRaw { qty: string; price: string; disc: string; }
const emptyRaw = (): LineRaw => ({ qty: '1', price: '0', disc: '0' });
const p2n = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

function lineAmount(l: SalesOrderLine) {
  return Number(l.quantity) * Number(l.unit_price) * (1 - Number(l.discount_pct) / 100);
}

function lineTaxAmt(l: SalesOrderLine, taxes: Tax[]) {
  if (!l.tax_id) return 0;
  const t = taxes.find(x => x.id === l.tax_id);
  return t ? lineAmount(l) * t.rate / 100 : 0;
}

interface AttachFile { name: string; size: number; }

export default function SalesOrderForm({ order, fromQuotation, onClose, onSaved }: Props) {
  const isEdit = order !== null;
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [nextNum, setNextNum] = useState('');

  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [taxes,      setTaxes]      = useState<Tax[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  const [customerId,    setCustomerId]    = useState('');
  const [date,          setDate]          = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate,  setDeliveryDate]  = useState('');
  const [quotationId,   setQuotationId]   = useState('');
  const [reference,     setReference]     = useState('');
  const [subject,       setSubject]       = useState('');
  const [notes,         setNotes]         = useState('');
  const [comments,      setComments]      = useState('');
  const [discountPct,   setDiscountPct]   = useState(0);
  const [shippingChgs,  setShippingChgs]  = useState(0);
  const [lines,         setLines]         = useState<SalesOrderLine[]>([emptyLine()]);
  const [lineRaws,      setLineRaws]      = useState<LineRaw[]>([emptyRaw()]);
  const [attachments,   setAttachments]   = useState<AttachFile[]>([]);
  const [dragOver,      setDragOver]      = useState(false);
  const [showQuickAdd,  setShowQuickAdd]  = useState(false);
  const [errors, setErrors] = useState<{ customerId?: string; date?: string; deliveryDate?: string; lines?: string; discountPct?: string; shippingChgs?: string }>({});
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : []));
    apiFetch('/api/sales-quotations?status=approved').then(r => r.json()).then(setQuotations);
    if (!order) getNextOrderNumber().then(r => setNextNum(r.number)).catch(() => {});
  }, [order]);

  useEffect(() => {
    if (!order) return;
    setCustomerId(String(order.customer_id));
    setDate(order.date.slice(0, 10));
    setDeliveryDate(order.delivery_date?.slice(0, 10) ?? '');
    setQuotationId(order.quotation_id ? String(order.quotation_id) : '');
    setReference(order.reference ?? '');
    setSubject(order.subject ?? '');
    setNotes(order.notes ?? '');
    setComments(order.comments ?? '');
    setDiscountPct(Number(order.discount_pct ?? 0));
    setShippingChgs(Number(order.shipping_charges ?? 0));
    getSalesOrder(order.id).then(o => {
      const ls = o.lines?.length ? o.lines : [emptyLine()];
      setLines(ls);
      setLineRaws(ls.map(l => ({ qty: String(l.quantity ?? 1), price: String(l.unit_price ?? 0), disc: String(l.discount_pct ?? 0) })));
    });
  }, [order]);

  useEffect(() => {
    if (!fromQuotation || order) return;
    setCustomerId(String(fromQuotation.customer_id));
    setQuotationId(String(fromQuotation.id));
    getSalesQuotation(fromQuotation.id).then(q => {
      setDiscountPct(Number(q.discount_pct ?? 0));
      setShippingChgs(Number(q.shipping_charges ?? 0));
      if (q.lines?.length) {
        const ls = q.lines.map(l => ({ ...l, invoiced_qty: 0 } as SalesOrderLine));
        setLines(ls);
        setLineRaws(ls.map(l => ({ qty: String(l.quantity ?? 1), price: String(l.unit_price ?? 0), disc: String(l.discount_pct ?? 0) })));
      }
    });
  }, [fromQuotation, order]);

  const gross       = lines.reduce((s, l) => s + lineAmount(l), 0);
  const taxTotal    = lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
  const discAmount  = gross * discountPct / 100;
  const netTotal    = gross - discAmount + taxTotal + shippingChgs;

  function updateLine(i: number, field: keyof SalesOrderLine, value: string | number | null, rawPatch?: Partial<LineRaw>) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      if (field === 'product_id' && value) {
        const p = products.find(p => p.id === Number(value));
        if (p) {
          updated.description = p.description?.trim() || p.name;
          updated.unit_price  = Number(p.sale_price ?? 0);
          updated.tax_id      = p.sale_tax_id ?? null;
          setLineRaws(r => r.map((rr, ri) => ri === i ? { ...rr, price: String(p.sale_price ?? 0) } : rr));
        }
      }
      updated.amount     = lineAmount(updated);
      updated.tax_amount = lineTaxAmt(updated, taxes);
      return updated;
    }));
    if (rawPatch) setLineRaws(r => r.map((rr, ri) => ri === i ? { ...rr, ...rawPatch } : rr));
  }

  const numRx = /^\d*\.?\d*$/;

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles: AttachFile[] = Array.from(fileList).map(f => ({ name: f.name, size: f.size }));
    setAttachments(prev => [...prev, ...newFiles]);
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!customerId) errs.customerId = 'Customer is required.';
    if (!date) errs.date = 'Date is required.';
    if (!deliveryDate) errs.deliveryDate = 'Delivery date is required.';
    else if (date && deliveryDate < date) errs.deliveryDate = 'Delivery date cannot be before the order date.';
    const discErr = validatePercent(discountPct, 'Discount'); if (discErr) errs.discountPct = discErr;
    const shipErr = validatePositive(shippingChgs, 'Shipping charges'); if (shipErr) errs.shippingChgs = shipErr;

    const activeLines = lines.filter(l => l.description.trim());
    if (activeLines.length === 0) errs.lines = 'At least one line is required.';

    const lErrs: Record<number, string> = {};
    lines.forEach((l, i) => {
      if (!l.description.trim()) return;
      if (!(Number(l.quantity) > 0)) lErrs[i] = 'Quantity must be greater than 0.';
      else if (Number(l.unit_price) < 0) lErrs[i] = 'Unit price cannot be negative.';
      else {
        const discE = validatePercent(Number(l.discount_pct), 'Discount'); if (discE) lErrs[i] = discE;
      }
    });
    setLineErrors(lErrs);
    if (Object.keys(lErrs).length > 0 && !errs.lines) errs.lines = 'Fix the highlighted line item errors below.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        customer_id: Number(customerId), date, delivery_date: deliveryDate,
        quotation_id: quotationId ? Number(quotationId) : null,
        reference: reference || null, subject: subject || null,
        notes: notes || null, comments: comments || null,
        discount_pct: discountPct, shipping_charges: shippingChgs,
        lines: lines.filter(l => l.description.trim()),
      };
      if (isEdit) await updateSalesOrder(order!.id, payload);
      else        await createSalesOrder(payload);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const displayNumber = isEdit ? order!.number : (nextNum || '…');
  const displayStatus = isEdit ? order!.status : 'draft';

  return (
    <>
    {showQuickAdd && (
      <QuickAddModal
        products={products}
        taxes={taxes}
        onAdd={line => {
          setLines(prev => {
            const last = prev[prev.length - 1];
            const isBlank = !last.description.trim() && last.unit_price === 0;
            const base = isBlank ? prev.slice(0, -1) : prev;
            return [...base, { ...line, invoiced_qty: 0 } as SalesOrderLine];
          });
          setLineRaws(prev => {
            const last = prev[prev.length - 1];
            const isBlank = last?.qty === '1' && last?.price === '0';
            const base = isBlank ? prev.slice(0, -1) : prev;
            return [...base, { qty: String(line.quantity ?? 1), price: String(line.unit_price ?? 0), disc: String(line.discount_pct ?? 0) }];
          });
        }}
        onClose={() => setShowQuickAdd(false)}
      />
    )}
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-900">
              Sale Orders - [{displayNumber}]
            </h2>
            <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${SO_STATUS_COLORS[displayStatus]}`}>
              {SO_STATUS_LABELS[displayStatus]}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

            {/* Row 1: Customer | Number | Date | Delivery Date | Reference */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <label className="label">Customer <span className="text-red-500">*</span></label>
                <select className={`input w-full ${errors.customerId ? 'border-red-500' : ''}`} value={customerId} onChange={e => { setCustomerId(e.target.value); setErrors(p => ({ ...p, customerId: undefined })); }} required>
                  <option value="">Select customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
                {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
              </div>
              <div>
                <label className="label">Number <span className="text-red-500">*</span></label>
                <input className="input w-full bg-gray-50" value={displayNumber} readOnly />
              </div>
              <div>
                <label className="label">Date <span className="text-red-500">*</span></label>
                <input type="date" className={`input w-full ${errors.date ? 'border-red-500' : ''}`} value={date} onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: undefined })); }} required />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="label">Delivery Date <span className="text-red-500">*</span></label>
                <input type="date" className={`input w-full ${errors.deliveryDate ? 'border-red-500' : ''}`} value={deliveryDate} onChange={e => { setDeliveryDate(e.target.value); setErrors(p => ({ ...p, deliveryDate: undefined })); }} required />
                {errors.deliveryDate && <p className="text-xs text-red-500 mt-1">{errors.deliveryDate}</p>}
              </div>
            </div>
            {errors.lines && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{errors.lines}</div>}

            {/* Row 2: From Quotation | Reference | Subject */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">From Quotation</label>
                <select className="input w-full" value={quotationId} onChange={e => setQuotationId(e.target.value)}>
                  <option value="">None</option>
                  {quotations.map(q => <option key={q.id} value={q.id}>{q.number}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Reference</label>
                <input className="input w-full" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
              <div>
                <label className="label">Subject</label>
                <input className="input w-full" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject…" />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(true)}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                >
                  QUICKLY ADD PRODUCTS / SCAN
                </button>
              </div>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="table-th w-36">Product</th>
                      <th className="table-th">Description</th>
                      <th className="table-th text-right w-16">Qty</th>
                      <th className="table-th text-right w-24">Price</th>
                      <th className="table-th text-right w-16">Disc%</th>
                      <th className="table-th w-28">Tax</th>
                      <th className="table-th text-right w-20">Tax Amt</th>
                      <th className="table-th text-right w-24">Amount</th>
                      <th className="table-th w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((l, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="table-td">
                          <select className="input w-full text-xs" value={l.product_id ?? ''} onChange={e => updateLine(i, 'product_id', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">None</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="table-td">
                          <input className="input w-full text-xs" value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                        </td>
                        <td className="table-td">
                          <input
                            type="text" inputMode="decimal"
                            className={`input w-full text-right text-xs ${lineErrors[i] ? 'border-red-500' : ''}`}
                            value={lineRaws[i]?.qty ?? String(l.quantity ?? 1)}
                            onChange={e => {
                              if (!numRx.test(e.target.value)) return;
                              updateLine(i, 'quantity', p2n(e.target.value) || 1, { qty: e.target.value });
                            }}
                            onBlur={e => {
                              const n = p2n(e.target.value) || 1;
                              updateLine(i, 'quantity', n, { qty: String(n) });
                            }}
                          />
                        </td>
                        <td className="table-td">
                          <input
                            type="text" inputMode="decimal"
                            className={`input w-full text-right text-xs ${lineErrors[i] ? 'border-red-500' : ''}`}
                            value={lineRaws[i]?.price ?? String(l.unit_price ?? 0)}
                            onChange={e => {
                              if (!numRx.test(e.target.value)) return;
                              updateLine(i, 'unit_price', p2n(e.target.value), { price: e.target.value });
                            }}
                            onBlur={e => {
                              const n = p2n(e.target.value);
                              updateLine(i, 'unit_price', n, { price: String(n) });
                            }}
                          />
                        </td>
                        <td className="table-td">
                          <input
                            type="text" inputMode="decimal"
                            className={`input w-full text-right text-xs ${lineErrors[i] ? 'border-red-500' : ''}`}
                            value={lineRaws[i]?.disc ?? String(l.discount_pct)}
                            onChange={e => {
                              if (!numRx.test(e.target.value)) return;
                              updateLine(i, 'discount_pct', p2n(e.target.value), { disc: e.target.value });
                            }}
                            onBlur={e => {
                              const n = Math.min(100, Math.max(0, p2n(e.target.value)));
                              updateLine(i, 'discount_pct', n, { disc: String(n) });
                            }}
                          />
                        </td>
                        <td className="table-td">
                          <select className="input w-full text-xs" value={l.tax_id ?? ''} onChange={e => updateLine(i, 'tax_id', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">None</option>
                            {taxes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td className="table-td text-right font-mono text-xs text-gray-500">{fmt(Number(l.tax_amount || 0))}</td>
                        <td className="table-td text-right font-mono text-xs font-medium">{fmt(lineAmount(l))}</td>
                        <td className="table-td">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              title="Duplicate line"
                              onClick={() => {
                                setLines(p => { const c = [...p]; c.splice(i + 1, 0, { ...p[i] }); return c; });
                                setLineRaws(r => { const c = [...r]; c.splice(i + 1, 0, { ...r[i] }); return c; });
                              }}
                              className="text-blue-400 hover:text-blue-600 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button type="button" title="Remove line" onClick={() => {
                              if (lines.length === 1) {
                                setLines([emptyLine()]);
                                setLineRaws([emptyRaw()]);
                              } else {
                                setLines(p => p.filter((_, idx) => idx !== i));
                                setLineRaws(r => r.filter((_, idx) => idx !== i));
                              }
                            }} className="text-red-400 hover:text-red-600 text-lg leading-none font-bold">&times;</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => { setLines(p => [...p, emptyLine()]); setLineRaws(r => [...r, emptyRaw()]); }} className="mt-2 text-xs text-blue-600 hover:underline">+ Add Line</button>
            </div>

            {/* Bottom: Comments + Attachments (left) | Summary (right) */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-4">
                <div>
                  <label className="label">Comments</label>
                  <textarea
                    className="input w-full resize-none"
                    rows={4}
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    placeholder="Comments…"
                  />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input w-full resize-none"
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes…"
                  />
                </div>

                {/* Attachments */}
                <div>
                  <label className="label">Attachments</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                    onClick={() => fileRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}`}
                  >
                    <svg className="mb-2 h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
                    </svg>
                    <span className="text-gray-500">Drop files here or </span>
                    <span className="font-semibold text-blue-600 underline">BROWSE FILES</span>
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
                  </div>
                  {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachments.map((f, i) => (
                        <li key={i} className="flex items-center justify-between rounded bg-gray-100 px-3 py-1 text-xs">
                          <span className="truncate text-gray-700">{f.name}</span>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            <span className="text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
                            <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">&times;</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right: Summary */}
              <div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-gray-700 mb-3">Order Summary</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Amount</span>
                    <span className="font-mono font-medium">{fmt(gross)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 flex-shrink-0">Discount</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className={`input w-16 text-right text-xs py-1 px-2 ${errors.discountPct ? 'border-red-500' : ''}`}
                        value={discountPct}
                        min="0" max="100" step="0.01"
                        onChange={e => { setDiscountPct(parseFloat(e.target.value) || 0); setErrors(p => ({ ...p, discountPct: undefined })); }}
                      />
                      <span className="text-gray-500 text-xs">%</span>
                    </div>
                    <span className="font-mono text-red-600 flex-shrink-0">-{fmt(discAmount)}</span>
                  </div>
                  {errors.discountPct && <p className="text-xs text-red-500 text-right">{errors.discountPct}</p>}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-mono">{fmt(taxTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 flex-shrink-0">Shipping Charges</span>
                    <input
                      type="number"
                      className={`input w-24 text-right text-xs py-1 px-2 ${errors.shippingChgs ? 'border-red-500' : ''}`}
                      value={shippingChgs}
                      min="0" step="0.01"
                      onChange={e => { setShippingChgs(parseFloat(e.target.value) || 0); setErrors(p => ({ ...p, shippingChgs: undefined })); }}
                    />
                  </div>
                  {errors.shippingChgs && <p className="text-xs text-red-500 text-right">{errors.shippingChgs}</p>}
                  <div className="border-t border-gray-300 pt-2 flex justify-between text-base font-bold">
                    <span className="text-indigo-700">Net (PKR)</span>
                    <span className="font-mono text-indigo-700">{fmt(netTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

