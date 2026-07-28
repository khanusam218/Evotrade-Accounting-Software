import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { SalesRefund, SalesRefundInstrument, RefundMode } from '../types/salesRefund';
import { createSalesRefund, updateSalesRefund, getSalesRefund } from '../api/salesRefunds';
import { validatePositive } from '../utils/validators';

interface Customer { id: number; print_name: string; }
interface COA { id: number; name: string; }

interface Props {
  refund: SalesRefund | null;
  onClose: () => void;
  onSaved: () => void;
}

const MODES: { value: RefundMode; label: string }[] = [
  { value: 'cash',   label: 'Cash' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card',   label: 'Card' },
  { value: 'other',  label: 'Other' },
];

function emptyInstrument(): SalesRefundInstrument {
  return { mode: 'cash', bank_ref: null, date: new Date().toISOString().slice(0, 10), account_id: null, amount: 0 };
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'DRAFT', approved: 'APPROVED', cancelled: 'CANCELLED',
};

export default function SalesRefundForm({ refund, onClose, onSaved }: Props) {
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [accounts,   setAccounts]   = useState<COA[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustDrop, setShowCustDrop]     = useState(false);
  const custRef = useRef<HTMLDivElement>(null);

  const [customerId,  setCustomerId]  = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [reference,   setReference]   = useState('');
  const [comments,    setComments]    = useState('');
  const [accountAdj,  setAccountAdj]  = useState(false);
  const [instruments, setInstruments] = useState<SalesRefundInstrument[]>([emptyInstrument()]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [instErrors,  setInstErrors]  = useState<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const status = refund?.status || 'draft';
  const number = refund?.number || 'CR-000001';

  const filteredCustomers = customers.filter(c =>
    c.print_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d =>
      setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
    apiFetch('/api/chart-of-accounts').then(r => r.json()).then((data: COA[]) =>
      setAccounts(Array.isArray(data) ? data : [])
    );
  }, []);

  useEffect(() => {
    if (!refund) return;
    getSalesRefund(refund.id).then(full => {
      setCustomerId(String(full.customer_id));
      setCustomerSearch(full.customer_name || '');
      setDate(full.date?.slice(0, 10) ?? '');
      setReference(full.reference ?? '');
      setComments(full.notes ?? '');
      setInstruments(full.instruments?.length ? full.instruments : [emptyInstrument()]);
    });
  }, [refund]);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustDrop(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function selectCustomer(c: Customer) {
    setCustomerId(String(c.id));
    setCustomerSearch(c.print_name);
    setShowCustDrop(false);
  }

  function updateInst(i: number, patch: Partial<SalesRefundInstrument>) {
    setInstruments(prev => prev.map((inst, idx) => idx !== i ? inst : { ...inst, ...patch }));
  }

  const total = instruments.reduce((s, inst) => s + Number(inst.amount || 0), 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!customerId) e.customerId = 'Customer is required.';
    if (!date) e.date = 'Date is required.';
    if (total <= 0) e.instruments = 'At least one instrument with an amount greater than zero is required.';

    const ie: Record<number, string> = {};
    instruments.forEach((inst, i) => {
      const amtErr = validatePositive(Number(inst.amount || 0), 'Amount');
      if (amtErr) ie[i] = amtErr;
    });
    setInstErrors(ie);
    setErrors(e);
    return Object.keys(e).length === 0 && Object.keys(ie).length === 0;
  }

  async function handleSave() {
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        customer_id: Number(customerId),
        return_id: null,
        date,
        reference: reference || null,
        notes: comments || null,
        instruments: instruments.filter(inst => Number(inst.amount) > 0),
      };
      if (refund) await updateSalesRefund(refund.id, payload);
      else await createSalesRefund(payload);
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
            Customer Refunds - [{number}]
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold tracking-widest text-gray-400 uppercase">
              {STATUS_LABELS[status] || status}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {/* Row 1: Customer | Number | Date | Reference */}
          <div className="flex gap-4 items-end">

            {/* Customer — searchable dropdown with red border */}
            <div className="flex-[2]" ref={custRef}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div
                  className={`flex items-center justify-between border-2 rounded px-2.5 py-1.5 cursor-pointer bg-white ${errors.customerId ? 'border-red-500' : 'border-red-400'}`}
                  onClick={() => setShowCustDrop(v => !v)}>
                  <input
                    type="text"
                    className="flex-1 text-sm focus:outline-none bg-transparent"
                    placeholder="Type to search customer…"
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustDrop(true); setCustomerId(''); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={showCustDrop ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
                  </svg>
                </div>
                {showCustDrop && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.length === 0
                      ? <div className="px-3 py-2 text-sm text-gray-400">No customers found</div>
                      : filteredCustomers.map(c => (
                        <div key={c.id}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${String(c.id) === customerId ? 'bg-blue-50 font-medium' : ''}`}
                          onClick={() => selectCustomer(c)}>
                          {c.print_name}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
            </div>

            {/* Number — green +▼ | text | ↺ */}
            <div className="flex-[1.5]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <button type="button" className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-l border border-green-700 hover:bg-green-700 leading-none">+▼</button>
                <input type="text" readOnly value={number}
                  className="flex-1 border-t border-b border-gray-300 px-2 py-1.5 text-sm bg-white text-gray-700 focus:outline-none text-center min-w-0" />
                <button type="button" className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-r border border-green-700 hover:bg-green-700 leading-none">↺</button>
              </div>
            </div>

            {/* Date — with × clear and 📅 icon */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className={`flex items-center border rounded overflow-hidden ${errors.date ? 'border-red-500' : 'border-gray-300'}`}>
                <input type="date"
                  className="flex-1 px-2 py-1.5 text-sm focus:outline-none border-none"
                  value={date} onChange={e => setDate(e.target.value)} />
                <button type="button" onClick={() => setDate('')}
                  className="px-1.5 text-gray-400 hover:text-gray-600 text-sm">×</button>
                <span className="px-1.5 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                  </svg>
                </span>
              </div>
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            {/* Reference */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reference</label>
              <input type="text" placeholder="Reference"
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={reference} onChange={e => setReference(e.target.value)} />
            </div>
          </div>

          {/* Payment table */}
          <div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Payment Mode</th>
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Account</th>
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Document No.</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-28">Amount</th>
                  <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((inst, i) => (
                  <tr key={i}>
                    {/* Mode */}
                    <td className="border border-gray-300 px-2 py-1.5">
                      <select
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        value={inst.mode}
                        onChange={e => updateInst(i, { mode: e.target.value as RefundMode })}>
                        {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </td>
                    {/* Account */}
                    <td className="border border-gray-300 px-2 py-1.5">
                      <select
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        value={inst.account_id ?? ''}
                        onChange={e => updateInst(i, { account_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Cash In Hand</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>
                    {/* Document No. */}
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="text" placeholder="Document No."
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={inst.bank_ref ?? ''}
                        onChange={e => updateInst(i, { bank_ref: e.target.value || null })} />
                    </td>
                    {/* Amount */}
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" min="0" step="any"
                        className={`w-full text-right text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${instErrors[i] ? 'border-red-500' : 'border-gray-300'}`}
                        value={inst.amount}
                        onChange={e => updateInst(i, { amount: Number(e.target.value) })} />
                      {instErrors[i] && <p className="text-xs text-red-500 mt-0.5">{instErrors[i]}</p>}
                    </td>
                    {/* Action */}
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <button type="button"
                          onClick={() => setInstruments(prev => [...prev, emptyInstrument()])}
                          className="text-gray-500 hover:text-green-700 font-bold text-base leading-none">✓</button>
                        <button type="button"
                          onClick={() => instruments.length > 1 && setInstruments(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-500 hover:text-red-600 font-bold text-base leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.instruments && <p className="text-xs text-red-500 mt-1">{errors.instruments}</p>}
          </div>

          {/* Account Adjustments checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-green-600"
                checked={accountAdj}
                onChange={e => setAccountAdj(e.target.checked)} />
              <span className="text-sm text-gray-700 font-medium">Account Adjustments (Optional)</span>
              <span className="text-xs text-teal-500">(e.g. WHT, Rebate, etc)</span>
            </label>
          </div>

          {/* Comments + Total Amount */}
          <div className="flex gap-6 items-start">
            <div className="flex-1">
              <textarea
                rows={4}
                placeholder="Comments"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                value={comments}
                onChange={e => setComments(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-1 shrink-0">
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Total Amount (PKR)</span>
              <input type="text" readOnly value={total.toFixed(2)}
                className="w-32 border border-gray-300 rounded px-3 py-1.5 text-sm text-right bg-white focus:outline-none" />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <h3 className="text-base font-bold text-gray-800 mb-3">Attachments</h3>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg py-8 flex items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}>
              <span className="text-sm text-gray-500">Drop files here or</span>
              <button type="button"
                className="bg-blue-500 text-white text-sm font-semibold px-5 py-1.5 rounded hover:bg-blue-600"
                onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                BROWSE FILES
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" />
            </div>
          </div>

          {/* Make auto settlements */}
          <div className="border-t border-gray-200 pt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
              <input type="checkbox" defaultChecked
                className="w-4 h-4 rounded border-gray-300 accent-green-600" />
              <span className="text-sm font-medium text-gray-700">Make auto settlements</span>
            </label>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-3 py-2.5 w-10">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-green-600" />
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Description</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Due Date</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Total Amount</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Adjusted Amount</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Balance Amount</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Allocate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50">
                    <td colSpan={8} className="px-3 py-4 text-orange-500 text-sm">No record found</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Splendid footer — SAVE AND NEW ▲ | × CLOSE */}
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2 shrink-0">
          <div className="flex">
            <button type="button" disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-2 bg-gray-200 text-gray-500 text-sm font-semibold px-4 py-2 rounded-l hover:bg-gray-300 disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {saving ? 'SAVING…' : 'SAVE AND NEW'}
            </button>
            <button type="button"
              className="bg-gray-300 text-gray-500 text-sm font-semibold px-2 py-2 rounded-r border-l border-gray-400 hover:bg-gray-400">
              ▲
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 bg-orange-400 text-white text-sm font-semibold px-5 py-2 rounded hover:bg-orange-500">
            × CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

