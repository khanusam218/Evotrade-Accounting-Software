import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { PurchaseReturn, PurchaseReturnLine } from '../types/purchaseReturn';
import { PR_STATUS_LABELS } from '../types/purchaseReturn';
import { createPurchaseReturn, updatePurchaseReturn, getPurchaseReturn, getNextPurchaseReturnNumber } from '../api/purchaseReturns';
import { validatePercent, validatePositive } from '../utils/validators';

interface Vendor  { id: number; print_name: string; }
interface Product { id: number; name: string; purchase_price: number; purchase_tax_id: number | null; }
interface Tax     { id: number; name: string; rate: number; }
interface Invoice { id: number; number: string; date: string; due_date: string | null; net_amount: number; balance_amount: number; }
interface Props   { ret: PurchaseReturn | null; onClose: () => void; onSaved: () => void; }

interface LineRaw { qty: string; price: string; disc: string; }

const emptyLine = (): PurchaseReturnLine => ({ product_id: null, description: '', quantity: 1, unit_price: 0, discount_pct: 0, amount: 0, tax_id: null, tax_amount: 0, disposition: 'return' });
const emptyRaw  = (): LineRaw => ({ qty: '1', price: '0', disc: '0' });
const lineAmt   = (l: PurchaseReturnLine) => l.quantity * l.unit_price * (1 - l.discount_pct / 100);
const lineTax   = (l: PurchaseReturnLine, taxes: Tax[]) => { const t = taxes.find(x => x.id === l.tax_id); return t ? lineAmt(l) * t.rate / 100 : 0; };
const p2n       = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

export default function PurchaseReturnForm({ ret, onClose, onSaved }: Props) {
  const [vendors,   setVendors]   = useState<Vendor[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [taxes,     setTaxes]     = useState<Tax[]>([]);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [nextNum,   setNextNum]   = useState('PR-000001');

  const [vendorId,         setVendorId]         = useState('');
  const [invoiceId,        setInvoiceId]        = useState('');
  const [date,             setDate]             = useState(new Date().toISOString().slice(0,10));
  const [reference,        setReference]        = useState('');
  const [subject,          setSubject]          = useState('');
  const [notes,            setNotes]            = useState('');
  const [discPct,          setDiscPct]          = useState('0');
  const [shippingCharges,  setShippingCharges]  = useState('0');
  const [roundOff,         setRoundOff]         = useState('0');
  const [lines,            setLines]            = useState<PurchaseReturnLine[]>([emptyLine()]);
  const [lineRaws,         setLineRaws]         = useState<LineRaw[]>([emptyRaw()]);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');
  const [errors,           setErrors]           = useState<Record<string, string>>({});
  const [autoSettle,       setAutoSettle]       = useState(true);
  const [allocations,      setAllocations]      = useState<Record<number, string>>({});
  const [attachments,      setAttachments]      = useState<File[]>([]);
  const [dragOver,         setDragOver]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showQuick,   setShowQuick]   = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const quickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : []));
    if (!ret) getNextPurchaseReturnNumber().then(r => setNextNum(r.number)).catch(() => {});
  }, [ret]);

  useEffect(() => {
    if (!vendorId) { setInvoices([]); return; }
    apiFetch(`/api/purchase-invoices?status=approved&vendor_id=${vendorId}`).then(r => r.json()).then(d => setInvoices(Array.isArray(d) ? d : []));
  }, [vendorId]);

  useEffect(() => {
    if (!ret) return;
    getPurchaseReturn(ret.id).then(full => {
      setVendorId(String(full.vendor_id));
      setInvoiceId(full.invoice_id ? String(full.invoice_id) : '');
      setDate(full.date?.slice(0,10) ?? '');
      setReference(full.reference ?? '');
      setSubject(full.subject ?? '');
      setNotes(full.notes ?? '');
      const grossAmt = Number(full.gross_amount ?? 0);
      setDiscPct(grossAmt > 0 ? String((Number(full.discount ?? 0) / grossAmt) * 100) : '0');
      setShippingCharges(String(full.shipping_charges ?? 0));
      const ls = full.lines?.length ? full.lines : [emptyLine()];
      setLines(ls);
      setLineRaws(ls.map(l => ({ qty: String(l.quantity), price: String(l.unit_price), disc: String(l.discount_pct) })));
      setNextNum(full.number);
    });
  }, [ret]);

  useEffect(() => {
    if (!showQuick) return;
    function h(e: MouseEvent) { if (quickRef.current && !quickRef.current.contains(e.target as Node)) setShowQuick(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showQuick]);

  function updateLine(i: number, patch: Partial<PurchaseReturnLine>, rawPatch?: Partial<LineRaw>) {
    setLines(prev => {
      const next = prev.map((l, idx) => idx !== i ? l : { ...l, ...patch });
      if ('product_id' in patch) {
        const p = products.find(x => x.id === patch.product_id);
        if (p) {
          next[i] = { ...next[i], unit_price: p.purchase_price, tax_id: p.purchase_tax_id, description: p.name };
          // sync raw strings when product auto-fills price
          setLineRaws(prev2 => prev2.map((r, idx) => idx !== i ? r : { ...r, price: String(p.purchase_price) }));
        }
      }
      const l = next[i];
      next[i] = { ...l, amount: lineAmt(l), tax_amount: lineTax(l, taxes) };
      return next;
    });
    if (rawPatch) {
      setLineRaws(prev => prev.map((r, idx) => idx !== i ? r : { ...r, ...rawPatch }));
    }
  }

  function addLine() {
    setLines(prev => [...prev, emptyLine()]);
    setLineRaws(prev => [...prev, emptyRaw()]);
  }

  function removeLine(i: number) {
    setLines(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : [emptyLine()]);
    setLineRaws(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : [emptyRaw()]);
  }

  function addProduct(p: Product) {
    const newLine: PurchaseReturnLine = { ...emptyLine(), product_id: p.id, description: p.name, unit_price: p.purchase_price, tax_id: p.purchase_tax_id };
    newLine.amount = lineAmt(newLine);
    newLine.tax_amount = lineTax(newLine, taxes);
    const newRaw: LineRaw = { qty: '1', price: String(p.purchase_price), disc: '0' };
    setLines(prev => {
      const last = prev[prev.length - 1];
      if (!last.product_id && !last.description) return [...prev.slice(0, -1), newLine];
      return [...prev, newLine];
    });
    setLineRaws(prev => {
      const last = lines[lines.length - 1];
      if (!last.product_id && !last.description) return [...prev.slice(0, -1), newRaw];
      return [...prev, newRaw];
    });
    setShowQuick(false); setQuickSearch('');
  }

  const gross    = lines.reduce((s,l) => s + lineAmt(l), 0);
  const taxTotal = lines.reduce((s,l) => s + lineTax(l, taxes), 0);
  const discAmt  = gross * p2n(discPct) / 100;
  const shipping = p2n(shippingCharges);
  const roundOff_ = p2n(roundOff);
  const net      = gross - discAmt + taxTotal + shipping + roundOff_;
  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
  const fmt      = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function validate() {
    const e: Record<string, string> = {};
    if (!vendorId) e.vendor = 'Vendor is required.';
    if (!date) e.date = 'Date is required.';
    const discErr = validatePercent(p2n(discPct), 'Discount'); if (discErr) e.discPct = discErr;
    const shipErr = validatePositive(p2n(shippingCharges), 'Shipping charges'); if (shipErr) e.shippingCharges = shipErr;
    const validLines = lines.filter(l => l.product_id || l.description);
    if (!validLines.length) e.lines = 'At least one product line is required.';
    lines.forEach((l, i) => {
      if (!(l.product_id || l.description)) return;
      const qtyErr = validatePositive(l.quantity, 'Quantity'); if (qtyErr) e[`qty_${i}`] = qtyErr;
      const priceErr = validatePositive(l.unit_price, 'Unit price'); if (priceErr) e[`price_${i}`] = priceErr;
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
        vendor_id: Number(vendorId),
        invoice_id: invoiceId ? Number(invoiceId) : null,
        date, reference: reference || null, notes: notes || null, subject: subject || null,
        discount: discAmt, shipping_charges: shipping,
        lines: validLines,
      };
      if (ret) await updatePurchaseReturn(ret.id, payload);
      else await createPurchaseReturn(payload);
      if (!continueEdit) onSaved();
      else getNextPurchaseReturnNumber().then(r => setNextNum(r.number)).catch(() => {});
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(quickSearch.toLowerCase()));

  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500';

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Purchase Returns - [{nextNum}]</h2>
          <span className="text-sm font-bold text-gray-500 tracking-widest">
            {ret ? PR_STATUS_LABELS[ret.status].toUpperCase() : 'DRAFT'}
          </span>
        </div>

        <form onSubmit={e => handleSave(e)}>
          <div className="px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

            {/* Row 1: Vendor | Number | Date | Reference */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                <select className={`${inp} ${errors.vendor ? 'border-red-500' : ''}`} value={vendorId} onChange={e => setVendorId(e.target.value)} required>
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
                  <button type="button" onClick={() => getNextPurchaseReturnNumber().then(r => setNextNum(r.number)).catch(() => {})}
                    className="h-9 w-9 flex-shrink-0 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" className={`${inp} ${errors.date ? 'border-red-500' : ''}`} value={date} onChange={e => setDate(e.target.value)} required />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input className={inp} placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
            </div>

            {/* Row 2: Subject + Linked Invoice + QUICKLY ADD */}
            <div className="grid grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input className={inp} placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Invoice</label>
                <select className={inp} value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
                  <option value="">None</option>
                  {invoices.map(i => <option key={i.id} value={i.id}>{i.number}</option>)}
                </select>
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
                      ) : filteredProducts.slice(0,50).map(p => (
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
                  {lines.map((l, i) => {
                    const raw = lineRaws[i] ?? emptyRaw();
                    return (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <select className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50"
                            value={l.product_id ?? ''} onChange={e => updateLine(i, { product_id: e.target.value ? Number(e.target.value) : null })}>
                            <option value="">Type to search product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`w-full border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`qty_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                            value={raw.qty}
                            onChange={e => {
                              const v = e.target.value;
                              if (!/^-?\d*\.?\d*$/.test(v) && v !== '') return;
                              updateLine(i, { quantity: p2n(v) }, { qty: v });
                            }}
                            onBlur={e => {
                              const n = p2n(e.target.value);
                              updateLine(i, { quantity: n }, { qty: String(n) });
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`w-full border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`price_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                            value={raw.price}
                            onChange={e => {
                              const v = e.target.value;
                              if (!/^-?\d*\.?\d*$/.test(v) && v !== '') return;
                              updateLine(i, { unit_price: p2n(v) }, { price: v });
                            }}
                            onBlur={e => {
                              const n = p2n(e.target.value);
                              updateLine(i, { unit_price: n }, { price: String(n) });
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`flex-1 border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`disc_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                              value={raw.disc}
                              onChange={e => {
                                const v = e.target.value;
                                if (!/^\d*\.?\d*$/.test(v) && v !== '') return;
                                updateLine(i, { discount_pct: p2n(v) }, { disc: v });
                              }}
                              onBlur={e => {
                                const n = Math.min(100, Math.max(0, p2n(e.target.value)));
                                updateLine(i, { discount_pct: n }, { disc: String(n) });
                              }}
                            />
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
                            <button type="button" onClick={() => removeLine(i)}
                              className="h-7 w-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-xs font-bold">✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" onClick={addLine}
                className="mt-2 text-sm text-green-600 hover:text-green-700 hover:underline font-medium">
                + Add Line
              </button>
              {errors.lines && <p className="text-xs text-red-500 mt-1">{errors.lines}</p>}
            </div>

            {/* Comments + Attachments (left) | Totals (right) */}
            <div className="grid grid-cols-2 gap-6">
              {/* LEFT: Comments + Attachments */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                  <textarea rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                    placeholder="Comments" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h3>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ''; }} />
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
                    className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 transition-colors ${dragOver ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'}`}>
                    <span className="text-sm text-gray-400 flex-1">Drop files here or</span>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="bg-green-700 hover:bg-green-800 text-white text-xs font-semibold px-4 py-2 rounded whitespace-nowrap">
                      BROWSE FILES
                    </button>
                  </div>
                  {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachments.map((f, i) => (
                        <li key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                          <span className="truncate max-w-[200px]">{f.name}</span>
                          <span className="text-gray-400 ml-2 flex-shrink-0">{formatBytes(f.size)}</span>
                          <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                            className="ml-2 text-red-400 hover:text-red-600 font-bold flex-shrink-0">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* RIGHT: Summary totals */}
              <div className="flex justify-end">
                <div className="w-80 space-y-2 text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Gross</span>
                    <span className="font-mono text-gray-800">{fmt(gross)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Discount</span>
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="decimal"
                        className={`w-16 border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.discPct ? 'border-red-500' : 'border-gray-300'}`}
                        value={discPct}
                        onChange={e => { const v = e.target.value; if (!/^\d*\.?\d*$/.test(v) && v !== '') return; setDiscPct(v); }}
                        onBlur={e => { const n = Math.min(100, Math.max(0, p2n(e.target.value))); setDiscPct(String(n)); }}
                      />
                      <span className="text-gray-500 text-xs">%</span>
                      <span className="font-mono text-gray-700 w-20 text-right">{fmt(discAmt)}</span>
                    </div>
                    {errors.discPct && <p className="text-xs text-red-500 mt-1">{errors.discPct}</p>}
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Tax</span>
                    <span className="font-mono text-gray-800">{fmt(taxTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Shipping Charges</span>
                    <div>
                      <input type="text" inputMode="decimal"
                        className={`w-28 border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.shippingCharges ? 'border-red-500' : 'border-gray-300'}`}
                        value={shippingCharges}
                        onChange={e => { const v = e.target.value; if (!/^\d*\.?\d*$/.test(v) && v !== '') return; setShippingCharges(v); }}
                        onBlur={e => { const n = Math.max(0, p2n(e.target.value)); setShippingCharges(String(n)); }}
                      />
                      {errors.shippingCharges && <p className="text-xs text-red-500 mt-1">{errors.shippingCharges}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Round Off</span>
                    <input type="text" inputMode="decimal"
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                      value={roundOff}
                      onChange={e => { const v = e.target.value; if (!/^-?\d*\.?\d*$/.test(v) && v !== '') return; setRoundOff(v); }}
                      onBlur={e => { setRoundOff(String(p2n(e.target.value))); }}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2 border-t-2 border-gray-300">
                    <span className="font-bold text-gray-900">Net (PKR)</span>
                    <span className="font-bold font-mono text-gray-900 text-base">{fmt(net)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Make Auto Settlements */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" checked={autoSettle} onChange={e => setAutoSettle(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="text-sm font-semibold text-gray-700">Make auto settlements</span>
              </label>
              {autoSettle && (
                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-10">
                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Description</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Date</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Due Date</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Total Amount</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Adjusted Amount</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Balance Amount</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Allocate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-6 text-center text-sm text-amber-500 font-medium">No record found</td>
                        </tr>
                      ) : invoices.map(inv => {
                        const adjusted = inv.net_amount - inv.balance_amount;
                        return (
                          <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                            </td>
                            <td className="px-3 py-2 text-gray-800 font-medium">{inv.number}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{inv.date?.slice(0, 10) ?? '-'}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{inv.due_date?.slice(0, 10) ?? '-'}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(inv.net_amount)}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(adjusted)}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(inv.balance_amount)}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="text"
                                inputMode="decimal"
                                className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                                value={allocations[inv.id] ?? ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  if (!/^\d*\.?\d*$/.test(v) && v !== '') return;
                                  setAllocations(prev => ({ ...prev, [inv.id]: v }));
                                }}
                                placeholder="0.00"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex rounded overflow-hidden shadow-sm">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-5 py-2 disabled:opacity-60">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                {saving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              <button type="button"
                className="bg-green-700 hover:bg-green-800 text-white px-2 py-2 border-l border-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
            <button type="button" onClick={onClose}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
              <span className="text-base leading-none font-bold">×</span>
              CLOSE
            </button>
          </div>
        </form>
    </div>
  );
}


