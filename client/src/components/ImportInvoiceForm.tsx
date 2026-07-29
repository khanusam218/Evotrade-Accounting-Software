import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { ImportInvoice, ImportInvoiceLine, ImportInvoiceExpense } from '../types/importInvoice';
import { II_STATUS_LABELS } from '../types/importInvoice';
import { createImportInvoice, updateImportInvoice, getImportInvoice, getNextImportInvoiceNumber } from '../api/importInvoices';
import ComboBox from './ComboBox';
import { validatePercent, validatePositive } from '../utils/validators';

const p2n = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

interface Vendor   { id: number; print_name: string; }
interface Product  { id: number; name: string; purchase_price: number; purchase_tax_id?: number | null; }
interface CAccount { id: number; name: string; code?: string; }
interface Tax      { id: number; name: string; rate: number; }

interface Props { invoice: ImportInvoice | null; onClose: () => void; onSaved: () => void; }

const emptyLine = (): ImportInvoiceLine => ({ product_id: null, description: '', quantity: 1, unit_price: 0, discount_pct: 0, amount: 0, tax_id: null });
const emptyExp  = (): ImportInvoiceExpense => ({ expense_type: '', account_id: null, account_name: '', description: '', contact_id: null, contact_name: '', amount: 0, distribution_method: 'value' });

const lineAmt = (l: ImportInvoiceLine) => Number(l.quantity||0) * Number(l.unit_price||0) * (1 - Number(l.discount_pct||0) / 100);
const lineTax = (l: ImportInvoiceLine, taxes: Tax[]) => { const t = taxes.find(x => x.id === l.tax_id); return t ? lineAmt(l) * t.rate / 100 : 0; };
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ImportInvoiceForm({ invoice, onClose, onSaved }: Props) {
  const [vendors,   setVendors]   = useState<Vendor[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [accounts,  setAccounts]  = useState<CAccount[]>([]);
  const [taxes,     setTaxes]     = useState<Tax[]>([]);
  const [nextNum,   setNextNum]   = useState('II-000001');

  const [vendorId,  setVendorId]  = useState('');
  const [date,      setDate]      = useState(new Date().toISOString().slice(0,10));
  const [dueDate,   setDueDate]   = useState('');
  const [reference, setReference] = useState('');
  const [subject,   setSubject]   = useState('');
  const [notes,     setNotes]     = useState('');
  const [lines,     setLines]     = useState<ImportInvoiceLine[]>([emptyLine()]);
  const [expenses,  setExpenses]  = useState<ImportInvoiceExpense[]>([emptyExp()]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  const [discPct,      setDiscPct]      = useState('0');
  const [shippingChgs, setShippingChgs] = useState('0');
  const [roundOff,     setRoundOff]     = useState('0');
  const [expMethod,    setExpMethod]    = useState('Method 1');
  const [attachments,  setAttachments]  = useState<File[]>([]);
  const [dragOver,     setDragOver]     = useState(false);

  const [showQuick,    setShowQuick]    = useState(false);
  const [quickSearch,  setQuickSearch]  = useState('');
  const [lineSearches, setLineSearches] = useState<string[]>(['']);
  const [expAccSearch, setExpAccSearch] = useState<string[]>(['']);
  const [expConSearch, setExpConSearch] = useState<string[]>(['']);
  const quickRef     = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/chart-of-accounts/lookup').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
      setAccounts(list);
    }).catch(() => {});
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : [])).catch(() => {});
    if (!invoice) getNextImportInvoiceNumber().then(r => setNextNum(r.number)).catch(() => {});
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    getImportInvoice(invoice.id).then(full => {
      setVendorId(String(full.vendor_id));
      setDate(full.date?.slice(0,10) ?? '');
      setDueDate(full.due_date?.slice(0,10) ?? '');
      setReference(full.reference ?? '');
      setSubject(full.subject ?? '');
      setNotes(full.notes ?? '');
      setLines(full.lines?.length ? full.lines.map(l => ({ ...l, quantity: Math.round(Number(l.quantity)), discount_pct: Number(l.discount_pct||0) })) : [emptyLine()]);
      const exps = full.expenses?.length ? full.expenses : [emptyExp()];
      setExpenses(exps);
      setExpAccSearch(exps.map(e => e.account_name ?? ''));
      setExpConSearch(exps.map(e => e.contact_name ?? ''));
      setNextNum(full.number);
      setDiscPct(String(Number(full.discount_pct || 0)));
      setShippingChgs(String(Number(full.shipping_charges || 0)));
      setRoundOff(String(Number(full.round_off || 0)));
    });
  }, [invoice]);

  useEffect(() => {
    if (!showQuick) return;
    function h(e: MouseEvent) { if (quickRef.current && !quickRef.current.contains(e.target as Node)) setShowQuick(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showQuick]);

  useEffect(() => {
    setLineSearches(lines.map(l => {
      if (l.product_id) { const p = products.find(x => x.id === l.product_id); return p ? p.name : (l.description ?? ''); }
      return l.description ?? '';
    }));
  }, [lines.length]); // eslint-disable-line react-hooks/exhaustive-deps


  function updateLine(i: number, patch: Partial<ImportInvoiceLine>) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l, ...patch };
      if ('product_id' in patch) {
        const p = products.find(x => x.id === patch.product_id);
        if (p) { next.unit_price = p.purchase_price; next.description = p.name; next.tax_id = p.purchase_tax_id ?? null; }
      }
      next.amount = lineAmt(next);
      return next;
    }));
  }

  function selectLineProduct(i: number, p: Product) {
    updateLine(i, { product_id: p.id });
    setLineSearches(prev => prev.map((s, idx) => idx === i ? p.name : s));
  }

  function addLineRow() {
    setLines(prev => [...prev, emptyLine()]);
    setLineSearches(prev => [...prev, '']);
  }

  function removeLineRow(i: number) {
    setLines(prev => prev.length > 1 ? prev.filter((_,j) => j !== i) : [emptyLine()]);
    setLineSearches(prev => prev.length > 1 ? prev.filter((_,j) => j !== i) : ['']);
  }

  function addProduct(p: Product) {
    const newLine: ImportInvoiceLine = { ...emptyLine(), product_id: p.id, description: p.name, unit_price: p.purchase_price };
    newLine.amount = lineAmt(newLine);
    setLines(prev => {
      const last = prev[prev.length - 1];
      if (!last.product_id && !last.description) return [...prev.slice(0, -1), newLine];
      return [...prev, newLine];
    });
    setLineSearches(prev => {
      const last = prev[prev.length - 1];
      if (!last) return [...prev.slice(0, -1), p.name];
      return [...prev, p.name];
    });
    setShowQuick(false); setQuickSearch('');
  }

  function updateExp(i: number, patch: Partial<ImportInvoiceExpense>) {
    setExpenses(prev => prev.map((e, idx) => idx !== i ? e : { ...e, ...patch }));
  }

  const totalBase  = lines.reduce((s, l) => s + lineAmt(l), 0);
  const totalExp   = expenses.reduce((s, e) => s + Number(e.amount||0), 0);
  const totalNew   = totalBase + totalExp;
  const validLineCount = lines.filter(l => l.product_id || l.description).length;

  const gross    = totalBase;
  const taxTotal = lines.reduce((s, l) => s + lineTax(l, taxes), 0);
  const discAmt  = gross * p2n(discPct) / 100;
  const shipping = p2n(shippingChgs);
  const roundOff_ = p2n(roundOff);
  const net      = gross - discAmt + taxTotal + shipping + roundOff_ + totalExp;
  const balance  = net;

  function linePct(l: ImportInvoiceLine) { return totalBase > 0 ? lineAmt(l) / totalBase * 100 : 0; }
  function lineExpAlloc(l: ImportInvoiceLine) { return totalExp * linePct(l) / 100; }
  function lineNetAfterExp(l: ImportInvoiceLine) { return lineAmt(l) + lineExpAlloc(l); }

  function resetForm() {
    setVendorId(''); setDate(new Date().toISOString().slice(0,10)); setDueDate('');
    setReference(''); setSubject(''); setNotes('');
    setLines([emptyLine()]); setLineSearches(['']);
    setExpenses([emptyExp()]); setExpAccSearch(['']); setExpConSearch(['']);
    setDiscPct('0'); setShippingChgs('0'); setRoundOff('0');
    setAttachments([]); setError(''); setErrors({});
    getNextImportInvoiceNumber().then(r => setNextNum(r.number)).catch(() => {});
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!vendorId) e.vendor = 'Vendor is required.';
    if (!date) e.date = 'Date is required.';
    if (!dueDate) e.dueDate = 'Due date is required.';
    const discErr = validatePercent(p2n(discPct), 'Discount'); if (discErr) e.discPct = discErr;
    const shipErr = validatePositive(p2n(shippingChgs), 'Shipping charges'); if (shipErr) e.shippingChgs = shipErr;
    const validLines = lines.filter(l => l.product_id || l.description);
    if (!validLines.length) e.lines = 'At least one product line is required.';
    lines.forEach((l, i) => {
      if (!(l.product_id || l.description)) return;
      const qtyErr = validatePositive(Number(l.quantity || 0), 'Quantity'); if (qtyErr) e[`qty_${i}`] = qtyErr;
      const priceErr = validatePositive(Number(l.unit_price || 0), 'Unit price'); if (priceErr) e[`price_${i}`] = priceErr;
      const discPctErr = validatePercent(Number(l.discount_pct || 0), 'Discount %'); if (discPctErr) e[`linedisc_${i}`] = discPctErr;
    });
    expenses.forEach((ex, i) => {
      const amt = Number(ex.amount || 0);
      const amtErr = validatePositive(amt, 'Expense amount'); if (amtErr) e[`expamt_${i}`] = amtErr;
      if (amt > 0 && !ex.account_id) e[`expacc_${i}`] = 'Account is required.';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function doSave(saveMode: 'new' | 'close') {
    setError('');
    if (!validate()) return;
    const validLines = lines.filter(l => l.product_id || l.description);
    setSaving(true);
    try {
      const payload = {
        vendor_id: Number(vendorId), date,
        due_date: dueDate || null, reference: reference || null,
        notes: notes || null, subject: subject || null,
        lines: validLines, expenses,
        discount_pct: p2n(discPct),
        shipping_charges: p2n(shippingChgs),
        round_off: p2n(roundOff),
      };
      if (invoice) await updateImportInvoice(invoice.id, payload);
      else await createImportInvoice(payload);
      if (saveMode === 'new') { resetForm(); }
      else { onSaved(); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await doSave('close');
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(quickSearch.toLowerCase()));

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Import Invoices - [{nextNum}]</h2>
          <span className="text-sm font-bold text-gray-500 tracking-widest">
            {invoice ? II_STATUS_LABELS[invoice.status].toUpperCase() : 'DRAFT'}
          </span>
        </div>

        <form onSubmit={handleSave}>
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
                  <button type="button" onClick={() => getNextImportInvoiceNumber().then(r => setNextNum(r.number)).catch(() => {})}
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
            <div className="border border-gray-200 rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[200px]">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-24">Quantity</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28">Price</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28">Disc.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-28">Tax</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-24">Tax Amt</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28">Amount</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-24">Percentage</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28">Expenses</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-36">Net Value After Expense</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const amt     = lineAmt(l);
                    const pct     = linePct(l);
                    const exp     = lineExpAlloc(l);
                    const lineNet = lineNetAfterExp(l);
                    const lineSearch = lineSearches[i] ?? '';
                    return (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <ComboBox
                            options={products.map(p => ({ id: p.id, label: p.name }))}
                            value={lineSearch}
                            onChange={v => {
                              setLineSearches(prev => prev.map((s, idx) => idx === i ? v : s));
                              if (v === '') updateLine(i, { product_id: null });
                            }}
                            onSelect={opt => {
                              const p = products.find(x => x.id === opt.id);
                              if (p) selectLineProduct(i, p);
                            }}
                            placeholder="Type to search product"
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" min="0" step="1" className={`w-full border rounded px-1 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`qty_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                            value={l.quantity} onChange={e => updateLine(i, { quantity: Math.round(Number(e.target.value)) })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="any" className={`w-full border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`price_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                            value={l.unit_price} onChange={e => updateLine(i, { unit_price: Number(e.target.value) })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" max="100" step="any" className={`flex-1 border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`linedisc_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                              value={l.discount_pct} onChange={e => updateLine(i, { discount_pct: Number(e.target.value) })} />
                            <span className="text-xs text-gray-500 flex-shrink-0">%</span>
                          </div>
                        </td>
                        <td className="px-1 py-1.5">
                          <select className="w-full border border-gray-200 rounded px-1 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50"
                            value={l.tax_id ?? ''} onChange={e => updateLine(i, { tax_id: e.target.value ? Number(e.target.value) : null })}>
                            <option value="">None</option>
                            {taxes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm text-gray-700 font-mono">{fmt(lineTax(l, taxes))}</td>
                        <td className="px-2 py-1.5">
                          <div className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right bg-gray-50 font-mono">
                            {fmt(amt)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right bg-gray-50 font-mono text-blue-600">
                            {fmt(pct)}%
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right bg-gray-50 font-mono text-orange-600">
                            {fmt(exp)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right bg-green-50 font-mono font-semibold text-green-700">
                            {fmt(lineNet)}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => updateLine(i, {})}
                              className="h-7 w-7 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center text-xs font-bold">✓</button>
                            <button type="button" onClick={() => removeLineRow(i)}
                              className="h-7 w-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-xs font-bold">✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addLineRow}
              className="mt-2 text-sm text-green-600 hover:text-green-700 hover:underline font-medium">
              + Add Line
            </button>
            {errors.lines && <p className="text-xs text-red-500 mt-1">{errors.lines}</p>}

            {/* Summary Row */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-6 text-xs font-semibold">
              <span className="text-gray-600">NO OF PRODUCTS: <span className="text-gray-900">{validLineCount}</span></span>
              <span className="text-gray-500">|</span>
              <span className="text-blue-600">TOTAL PERCENTAGE: <span>{validLineCount > 0 ? '100.00' : '0.00'}%</span></span>
              <span className="text-gray-500">|</span>
              <span className="text-orange-600">TOTAL VALUE: <span>{fmt(totalExp)} PKR</span></span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-700">TOTAL BASE VALUE: <span>{fmt(totalBase)} PKR</span></span>
              <span className="text-gray-500">|</span>
              <span className="text-green-700">TOTAL NEW VALUE: <span>{fmt(totalNew)} PKR</span></span>
            </div>

            {/* Account Expenses */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-800">Account Expenses</h3>
                  <span className="text-xs text-amber-600 italic">(Cannot be changed once invoice saved.)</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-green-600">Total Expense Cost: {fmt(totalExp)}PKR</span>
                  <button type="button" onClick={() => {
                    setExpenses(prev => [...prev, emptyExp()]);
                    setExpAccSearch(prev => [...prev, '']);
                    setExpConSearch(prev => [...prev, '']);
                  }} className="text-sm text-green-600 hover:text-green-700 hover:underline font-medium">+ Add Expense</button>
                </div>
              </div>
              <div className="flex items-center mb-2">
                <select className="border border-green-500 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 min-w-[160px]"
                  value={expMethod} onChange={e => setExpMethod(e.target.value)}>
                  <option value="Method 1">Method 1</option>
                  <option value="Method 2">Method 2</option>
                  <option value="Method 3">Method 3</option>
                </select>
              </div>
              <div className="border border-gray-200 rounded-lg">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 w-56">Account</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700">Description</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 w-48">Contact</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700 w-32">Amount</th>
                      <th className="px-3 py-2.5 w-20 text-center text-xs font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((ex, i) => {
                      const accSearch = expAccSearch[i] ?? '';
                      const conSearch = expConSearch[i] ?? '';
                      return (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          {/* Account combobox */}
                          <td className="px-2 py-1.5">
                            <ComboBox
                              options={accounts.map(a => ({ id: a.id, label: a.code ? `${a.name} (${a.code})` : a.name }))}
                              value={accSearch}
                              onChange={v => {
                                setExpAccSearch(prev => prev.map((s, idx) => idx === i ? v : s));
                                if (v === '') updateExp(i, { account_id: null, account_name: '', expense_type: '' });
                              }}
                              onSelect={opt => {
                                updateExp(i, { account_id: opt.id, account_name: opt.label, expense_type: opt.label });
                                setExpAccSearch(prev => prev.map((s, idx) => idx === i ? opt.label : s));
                              }}
                              placeholder="Type to search account"
                              inputClassName={errors[`expacc_${i}`] ? 'border-red-500' : (!ex.account_id ? 'border-red-400' : 'border-gray-200')}
                            />
                            {errors[`expacc_${i}`] && <p className="text-xs text-red-500 mt-1">{errors[`expacc_${i}`]}</p>}
                          </td>
                          {/* Description */}
                          <td className="px-2 py-1.5">
                            <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              placeholder="Description" value={ex.description ?? ''} onChange={e => updateExp(i, { description: e.target.value })} />
                          </td>
                          {/* Contact combobox */}
                          <td className="px-2 py-1.5">
                            <ComboBox
                              options={vendors.map(v => ({ id: v.id, label: v.print_name }))}
                              value={conSearch}
                              onChange={v => {
                                setExpConSearch(prev => prev.map((s, idx) => idx === i ? v : s));
                                if (v === '') updateExp(i, { contact_id: null, contact_name: '' });
                              }}
                              onSelect={opt => {
                                updateExp(i, { contact_id: opt.id, contact_name: opt.label });
                                setExpConSearch(prev => prev.map((s, idx) => idx === i ? opt.label : s));
                              }}
                              placeholder="Select contact"
                            />
                          </td>
                          {/* Amount */}
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="any"
                              className={`w-full border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`expamt_${i}`] ? 'border-red-500' : 'border-green-400'}`}
                              value={ex.amount}
                              onChange={e => updateExp(i, { amount: Number(e.target.value) })} />
                            {errors[`expamt_${i}`] && <p className="text-xs text-red-500 mt-1">{errors[`expamt_${i}`]}</p>}
                          </td>
                          {/* Action */}
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button"
                                className="h-7 w-7 rounded bg-white border border-gray-300 hover:border-green-500 text-green-600 flex items-center justify-center text-sm font-bold">✓</button>
                              <button type="button" onClick={() => {
                                setExpenses(prev => prev.length > 1 ? prev.filter((_,j) => j !== i) : [emptyExp()]);
                                setExpAccSearch(prev => prev.length > 1 ? prev.filter((_,j) => j !== i) : ['']);
                                setExpConSearch(prev => prev.length > 1 ? prev.filter((_,j) => j !== i) : ['']);
                              }} className="h-7 w-7 rounded bg-white border border-gray-300 hover:border-red-400 text-red-500 flex items-center justify-center text-sm font-bold">✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comments + Attachments (left) | Summary (right) */}
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
                          <button type="button" onClick={() => setAttachments(prev => prev.filter((_,j) => j !== i))}
                            className="ml-2 text-red-400 hover:text-red-600 font-bold flex-shrink-0">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* RIGHT: Summary */}
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
                        onBlur={e => setDiscPct(String(Math.min(100, Math.max(0, p2n(e.target.value)))))}
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
                        className={`w-28 border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.shippingChgs ? 'border-red-500' : 'border-gray-300'}`}
                        value={shippingChgs}
                        onChange={e => { const v = e.target.value; if (!/^\d*\.?\d*$/.test(v) && v !== '') return; setShippingChgs(v); }}
                        onBlur={e => setShippingChgs(String(Math.max(0, p2n(e.target.value))))}
                      />
                      {errors.shippingChgs && <p className="text-xs text-red-500 mt-1">{errors.shippingChgs}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Round Off</span>
                    <input type="text" inputMode="decimal"
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                      value={roundOff}
                      onChange={e => { const v = e.target.value; if (!/^-?\d*\.?\d*$/.test(v) && v !== '') return; setRoundOff(v); }}
                      onBlur={e => setRoundOff(String(p2n(e.target.value)))}
                    />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Total Expenses</span>
                    <span className="font-mono text-gray-800">{fmt(totalExp)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t-2 border-gray-300">
                    <span className="font-bold text-gray-900">Net (PKR)</span>
                    <span className="font-bold font-mono text-gray-900 text-base">{fmt(net)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-t border-gray-200 mt-1">
                    <span className="text-gray-600 font-medium">Balance (PKR)</span>
                    <span className="font-mono font-semibold text-gray-900">{fmt(balance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex rounded overflow-hidden shadow-sm">
              <button type="button" disabled={saving} onClick={() => doSave('new')}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-5 py-2 disabled:opacity-60">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                {saving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              <button type="button" disabled={saving} onClick={() => doSave('close')}
                className="bg-green-700 hover:bg-green-800 text-white px-2 py-2 border-l border-green-600 disabled:opacity-60">
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

