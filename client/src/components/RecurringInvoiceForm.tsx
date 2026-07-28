import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { RecurringInvoice, RecurringInvoiceLine, RIFrequency, RIStatus } from '../types/recurringInvoice';
import { createRecurringInvoice, updateRecurringInvoice, getRecurringInvoice } from '../api/recurringInvoices';
import { validatePercent, validatePositive } from '../utils/validators';

interface Customer { id: number; print_name: string; }
interface Product  { id: number; name: string; sale_price: number; sale_tax_id: number | null; }
interface Tax      { id: number; name: string; rate: number; }

interface Props {
  ri: RecurringInvoice | null;
  onClose: () => void;
  onSaved: () => void;
}

const FREQUENCIES: { value: RIFrequency; label: string }[] = [
  { value: 'daily',     label: 'Daily' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly',    label: 'Yearly' },
];

function emptyLine(): RecurringInvoiceLine {
  return { product_id: null, description: '', quantity: 1, unit_price: 0, discount_pct: 0, amount: 0, tax_id: null, tax_amount: 0 };
}

function lineAmount(l: RecurringInvoiceLine) {
  return l.quantity * l.unit_price * (1 - l.discount_pct / 100);
}

export default function RecurringInvoiceForm({ ri, onClose, onSaved }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [taxes,     setTaxes]     = useState<Tax[]>([]);

  // Customer searchable dropdown
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustDrop, setShowCustDrop]     = useState(false);
  const custRef = useRef<HTMLDivElement>(null);
  const [customerId, setCustomerId]         = useState('');

  // Schedule fields
  const [frequency,      setFrequency]      = useState<RIFrequency | ''>('');
  const [startDate,      setStartDate]      = useState('');
  const [endDate,        setEndDate]        = useState('');
  const [invoiceStatus,  setInvoiceStatus]  = useState<RIStatus | ''>('');

  // Invoice fields
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10));
  const [dueDate,   setDueDate]   = useState('');
  const [reference, setReference] = useState('');
  const [notes,     setNotes]     = useState('');
  const [discount,  setDiscount]  = useState('0');

  const [lines,          setLines]          = useState<RecurringInvoiceLine[]>([emptyLine()]);
  const [shippingChgs,   setShippingChgs]   = useState('0');
  const [roundOff,       setRoundOff]       = useState('0');
  const [attachments,    setAttachments]    = useState<File[]>([]);
  const [dragOver,       setDragOver]       = useState(false);
  const fileRef              = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<number, Partial<Record<'quantity' | 'unit_price' | 'discount_pct', string>>>>({});

  // Outside-click closes customer dropdown
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (custRef.current && !custRef.current.contains(e.target as Node)) {
        setShowCustDrop(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/taxes').then(r => r.json()).then(d => setTaxes(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (!ri) return;
    getRecurringInvoice(ri.id).then(full => {
      setCustomerId(String(full.customer_id));
      setCustomerSearch(full.customer_name ?? '');
      setFrequency(full.frequency);
      setStartDate(full.start_date?.slice(0, 10) ?? '');
      setEndDate(full.end_date?.slice(0, 10) ?? '');
      setInvoiceStatus(full.status);
      setDate(full.start_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
      if (full.start_date && full.due_days) {
        const d = new Date(full.start_date);
        d.setDate(d.getDate() + full.due_days);
        setDueDate(d.toISOString().slice(0, 10));
      }
      setReference(full.reference ?? '');
      setNotes(full.notes ?? '');
      setDiscount(String(full.discount_pct ?? 0));
      setShippingChgs(String(full.shipping_charges ?? 0));
      setRoundOff(String(full.round_off ?? 0));
      setLines(full.lines?.length ? full.lines : [emptyLine()]);
    });
  }, [ri]);

  function updateLine(i: number, patch: Partial<RecurringInvoiceLine>) {
    setLines(prev => {
      const next = prev.map((l, idx) => idx !== i ? l : { ...l, ...patch });
      if ('product_id' in patch) {
        const p = products.find(x => x.id === patch.product_id);
        if (p) next[i] = { ...next[i], unit_price: p.sale_price };
      }
      const l = next[i];
      next[i] = { ...l, amount: lineAmount(l) };
      return next;
    });
  }

  const filteredCustomers = customers.filter(c =>
    c.print_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const gross      = lines.reduce((s, l) => s + lineAmount(l), 0);
  const disc       = Number(discount || 0);
  const discAmt    = gross * disc / 100;
  const taxTotal   = lines.reduce((s, l) => {
    const t = taxes.find(x => x.id === l.tax_id);
    return s + (t ? lineAmount(l) * t.rate / 100 : 0);
  }, 0);
  const shipping   = Number(shippingChgs || 0);
  const roundOff_  = Number(roundOff || 0);
  const netTotal   = gross - discAmt + taxTotal + shipping + roundOff_;

  function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!customerId)     e.customerId = 'Customer is required.';
    if (!frequency)      e.frequency = 'Frequency is required.';
    if (!startDate)      e.startDate = 'Start Date is required.';
    if (!invoiceStatus)  e.invoiceStatus = 'Invoice Status is required.';
    if (!date)           e.date = 'Date is required.';
    if (!dueDate)        e.dueDate = 'Due Date is required.';
    if (startDate && endDate && endDate < startDate) e.endDate = 'End Date cannot be before Start Date.';
    if (date && dueDate && dueDate < date) e.dueDate = e.dueDate || 'Due Date cannot be before the invoice Date.';

    const discErr = validatePercent(disc, 'Discount'); if (discErr) e.discount = discErr;
    const shipErr = validatePositive(shipping, 'Shipping charges'); if (shipErr) e.shippingChgs = shipErr;

    const validLines = lines.filter(l => l.product_id);
    if (validLines.length === 0) e.lines = 'At least one product line is required.';

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
      const dueDays = dueDate && date
        ? Math.max(0, Math.round((new Date(dueDate).getTime() - new Date(date).getTime()) / 86400000))
        : 0;
      const payload = {
        customer_id:  Number(customerId),
        reference:    reference || null,
        notes:        notes || null,
        frequency:    frequency as RIFrequency,
        interval_num: 1,
        start_date:   startDate,
        end_date:     endDate || null,
        due_days:     dueDays,
        discount_pct: disc,
        shipping_charges: shipping,
        round_off:    roundOff_,
        lines: lines.filter(l => l.product_id).map(l => ({ ...l, amount: lineAmount(l) })),
      };
      if (ri) await updateRecurringInvoice(ri.id, payload);
      else    await createRecurringInvoice(payload);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const riNumber = ri?.number ?? 'NEW';

  const CalIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Recurring Invoices - <span className="text-gray-600">{riNumber}</span>
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold tracking-widest text-gray-400 uppercase">DRAFT</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {/* Schedule section */}
          <div>
            <p className="font-bold text-gray-800 mb-3">Schedule</p>
            <div className="grid grid-cols-4 gap-4">

              {/* Frequency */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Frequency <span className="text-red-500">*</span></label>
                <select
                  className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${errors.frequency ? 'border-red-500' : 'border-gray-300'}`}
                  value={frequency}
                  onChange={e => setFrequency(e.target.value as RIFrequency | '')}
                >
                  <option value="">-Choose-</option>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                {errors.frequency && <p className="text-xs text-red-500 mt-1">{errors.frequency}</p>}
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date <span className="text-red-500">*</span></label>
                <div className={`flex items-center border rounded overflow-hidden ${errors.startDate ? 'border-red-500' : 'border-gray-300'}`}>
                  <input
                    type="date"
                    className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                  {startDate && (
                    <button type="button" onClick={() => setStartDate('')} className="px-1 text-gray-400 hover:text-gray-600 text-sm">×</button>
                  )}
                  <span className="px-2 text-gray-400"><CalIcon /></span>
                </div>
                {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <div className={`flex items-center border rounded overflow-hidden ${errors.endDate ? 'border-red-500' : 'border-gray-300'}`}>
                  <input
                    type="date"
                    className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                  <span className="px-2 text-gray-400"><CalIcon /></span>
                </div>
                {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>}
              </div>

              {/* Invoice Status */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice Status <span className="text-red-500">*</span></label>
                <select
                  className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 ${errors.invoiceStatus ? 'border-red-500' : 'border-gray-300'}`}
                  value={invoiceStatus}
                  onChange={e => setInvoiceStatus(e.target.value as RIStatus | '')}
                >
                  <option value="">-Choose-</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
                {errors.invoiceStatus && <p className="text-xs text-red-500 mt-1">{errors.invoiceStatus}</p>}
              </div>
            </div>
          </div>

          {/* Invoice Row: 5 fields */}
          <div className="grid grid-cols-5 gap-4">

            {/* Customer */}
            <div ref={custRef} className="relative">
              <label className="block text-xs text-gray-500 mb-1">Customer <span className="text-red-500">*</span></label>
              <input
                type="text"
                className={`w-full border-2 rounded px-2 py-1.5 text-sm focus:outline-none ${errors.customerId ? 'border-red-500' : 'border-red-400'}`}
                placeholder="Search customer..."
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustDrop(true); setCustomerId(''); }}
                onFocus={() => setShowCustDrop(true)}
              />
              {showCustDrop && filteredCustomers.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                      onMouseDown={() => {
                        setCustomerId(String(c.id));
                        setCustomerSearch(c.print_name);
                        setShowCustDrop(false);
                      }}
                    >
                      {c.print_name}
                    </div>
                  ))}
                </div>
              )}
              {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
            </div>

            {/* Number */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Number <span className="text-red-500">*</span></label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button type="button" className="bg-green-500 text-white px-2 py-1.5 text-xs font-bold hover:bg-green-600 flex items-center gap-0.5">
                  +<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
                <input
                  type="text"
                  readOnly
                  className="flex-1 px-2 py-1.5 text-sm bg-gray-50 min-w-0"
                  value={riNumber}
                />
                <button type="button" className="bg-green-500 text-white px-2 py-1.5 hover:bg-green-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date <span className="text-red-500">*</span></label>
              <div className={`flex items-center border rounded overflow-hidden ${errors.date ? 'border-red-500' : 'border-gray-300'}`}>
                <input
                  type="date"
                  className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                {date && (
                  <button type="button" onClick={() => setDate('')} className="px-1 text-gray-400 hover:text-gray-600 text-sm">×</button>
                )}
                <span className="px-2 text-gray-400"><CalIcon /></span>
              </div>
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Due Date <span className="text-red-500">*</span></label>
              <div className={`flex items-center border rounded overflow-hidden ${errors.dueDate ? 'border-red-500' : 'border-gray-300'}`}>
                <input
                  type="date"
                  className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
                {dueDate && (
                  <button type="button" onClick={() => setDueDate('')} className="px-1 text-gray-400 hover:text-gray-600 text-sm">×</button>
                )}
                <span className="px-2 text-gray-400"><CalIcon /></span>
              </div>
              {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reference</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Product lines table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 font-medium text-gray-600 border-b">Product</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 border-b w-24">Quantity</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 border-b w-28">Price</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 border-b w-36">Disc.</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 border-b w-28">Amount</th>
                  <th className="px-3 py-2 border-b w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <select
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                        value={l.product_id ?? ''}
                        onChange={e => updateLine(i, { product_id: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">-Choose-</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number" min="0" step="any"
                        className={`w-full border rounded px-2 py-1 text-sm text-right focus:outline-none ${lineErrors[i]?.quantity ? 'border-red-500' : 'border-gray-200'}`}
                        value={l.quantity}
                        onChange={e => updateLine(i, { quantity: Number(e.target.value) })}
                      />
                      {lineErrors[i]?.quantity && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].quantity}</p>}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number" min="0" step="any"
                        className={`w-full border rounded px-2 py-1 text-sm text-right focus:outline-none ${lineErrors[i]?.unit_price ? 'border-red-500' : 'border-gray-200'}`}
                        value={l.unit_price}
                        onChange={e => updateLine(i, { unit_price: Number(e.target.value) })}
                      />
                      {lineErrors[i]?.unit_price && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].unit_price}</p>}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="100" step="any"
                          className={`flex-1 border rounded px-2 py-1 text-sm text-right focus:outline-none min-w-0 ${lineErrors[i]?.discount_pct ? 'border-red-500' : 'border-gray-200'}`}
                          value={l.discount_pct}
                          onChange={e => updateLine(i, { discount_pct: Number(e.target.value) })}
                        />
                        <button type="button" className="flex items-center gap-0.5 bg-gray-100 border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-600 hover:bg-gray-200 whitespace-nowrap">
                          %<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                      </div>
                      {lineErrors[i]?.discount_pct && <p className="text-xs text-red-500 mt-0.5">{lineErrors[i].discount_pct}</p>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-sm text-gray-700">{lineAmount(l).toFixed(2)}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLines(prev => [...prev, emptyLine()])}
                          className="text-green-500 hover:text-green-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.lines && <p className="text-xs text-red-500 mt-1">{errors.lines}</p>}
          </div>

          {/* Comments + Summary */}
          <div className="flex gap-6">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Comments</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none resize-none"
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <div className="w-64 shrink-0 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Gross</span>
                <span className="font-medium">{gross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 gap-2">
                <span className="text-gray-500 whitespace-nowrap">Discount</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number" min="0" max="100" step="any"
                    className={`w-16 border rounded px-2 py-0.5 text-sm text-right focus:outline-none ${errors.discount ? 'border-red-500' : 'border-gray-200'}`}
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                  />
                  <span className="text-xs text-gray-400">%</span>
                  <input
                    type="number" readOnly
                    className="w-20 border border-gray-200 rounded px-2 py-0.5 text-sm text-right bg-gray-50 focus:outline-none"
                    value={discAmt.toFixed(2)}
                  />
                </div>
              </div>
              {errors.discount && <p className="text-xs text-red-500 text-right -mt-1 mb-1">{errors.discount}</p>}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Tax</span>
                <span className="font-medium">{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 gap-2">
                <span className="text-gray-500 whitespace-nowrap">Shipping Charges</span>
                <input
                  type="number" min="0" step="any"
                  className={`w-24 border rounded px-2 py-0.5 text-sm text-right focus:outline-none ${errors.shippingChgs ? 'border-red-500' : 'border-gray-200'}`}
                  value={shippingChgs}
                  onChange={e => setShippingChgs(e.target.value)}
                />
              </div>
              {errors.shippingChgs && <p className="text-xs text-red-500 text-right -mt-1 mb-1">{errors.shippingChgs}</p>}
              <div className="flex justify-between items-center py-2 border-b border-gray-100 gap-2">
                <span className="text-gray-500 whitespace-nowrap">Round Off</span>
                <input
                  type="number" step="any"
                  className="w-24 border border-gray-200 rounded px-2 py-0.5 text-sm text-right focus:outline-none"
                  value={roundOff}
                  onChange={e => setRoundOff(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700 font-semibold">Net (PKR)</span>
                <span className="font-bold text-gray-900">{netTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Attachments</p>
            <div
              className={`border-2 border-dashed rounded-lg px-6 py-4 flex items-center gap-3 transition-colors ${dragOver ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
            >
              <span className="text-sm text-gray-500">Drop files here or</span>
              <button type="button"
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded"
                onClick={() => fileRef.current?.click()}>
                BROWSE FILES
              </button>
              <input ref={fileRef} type="file" multiple className="hidden"
                onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]); }} />
            </div>
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate text-gray-800">{f.name}</span>
                      <span className="flex-shrink-0 text-xs text-gray-400">({formatBytes(f.size)})</span>
                    </div>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      className="ml-3 flex-shrink-0 text-red-400 hover:text-red-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center gap-2">
          <div className="flex">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-gray-200 text-gray-600 px-5 py-2 text-sm font-medium hover:bg-gray-300 rounded-l"
            >
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button
              type="button"
              className="bg-gray-200 text-gray-600 px-2 py-2 hover:bg-gray-300 rounded-r border-l border-gray-300"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 bg-orange-400 text-white px-5 py-2 text-sm font-medium rounded hover:bg-orange-500"
          >
            <span className="text-lg leading-none">&times;</span> CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

