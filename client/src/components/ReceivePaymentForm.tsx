import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import {
  createReceivePayment, getReceivePayment, updateReceivePayment,
  getNextPaymentNumber,
} from '../api/receivePayments';
import type { ReceivePayment, RPInstrument, RPAdjustment, RPAllocation } from '../types/receivePayment';
import { RP_STATUS_LABELS } from '../types/receivePayment';

interface Props {
  payment: ReceivePayment | null;
  onClose: () => void;
  onSaved: () => void;
}

interface Customer { id: number; print_name: string; }
interface COA      { id: number; code: string; name: string; }
interface OpenInvoice {
  id: number; number: string; date: string; due_date: string;
  net_amount: number; paid_amount: number; balance_amount: number;
}

const PAYMENT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'Card', 'Online'];

const emptyInst = (): RPInstrument => ({
  payment_mode: 'Cash', account_id: undefined, reference: '', bank_name: '', instrument_no: '', instrument_date: '', amount: 0,
});
const emptyAdj = (): RPAdjustment => ({ account_id: 0, account_name: '', description: '', amount: 0 });

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  approved:  'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function ReceivePaymentForm({ payment, onClose, onSaved }: Props) {
  const isEdit = payment !== null;
  const [saving, setSaving]         = useState(false);
  const [savingContinue, setSavingContinue] = useState(false);
  const [error,  setError]          = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [coaList,      setCoaList]      = useState<COA[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);

  const [number,          setNumber]          = useState('');
  const [customerId,      setCustomerId]       = useState('');
  const [date,            setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [reference,       setReference]        = useState('');
  const [comments,        setComments]         = useState('');
  const [showAdjustments, setShowAdjustments]  = useState(false);
  const [makeSettlements, setMakeSettlements]  = useState(true);

  const [instruments,  setInstruments]  = useState<RPInstrument[]>([emptyInst()]);
  const [adjustments,  setAdjustments]  = useState<RPAdjustment[]>([emptyAdj()]);
  const [allocations,  setAllocations]  = useState<RPAllocation[]>([]);
  const [attachments,  setAttachments]  = useState<File[]>([]);

  const status = (isEdit ? payment!.status : 'draft') as string;

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d =>
      setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
    apiFetch('/api/chart-of-accounts?leaf=true').then(r => r.json()).then(setCoaList);
    if (!isEdit) getNextPaymentNumber().then(d => setNumber(d.number)).catch(() => setNumber('RM-000001'));
  }, []);

  useEffect(() => {
    if (!customerId) { setOpenInvoices([]); return; }
    apiFetch(`/api/receive-payments/open-invoices/${customerId}`).then(r => r.json()).then(setOpenInvoices);
  }, [customerId]);

  useEffect(() => {
    if (!payment) return;
    setNumber(payment.number);
    setCustomerId(String(payment.customer_id));
    setDate(payment.date.slice(0, 10));
    setReference(payment.reference ?? '');
    setComments(payment.notes ?? '');
    getReceivePayment(payment.id).then(p => {
      setInstruments(p.instruments?.length ? p.instruments : [emptyInst()]);
      if (p.adjustments?.length) { setAdjustments(p.adjustments); setShowAdjustments(true); }
      setAllocations(p.allocations ?? []);
    });
  }, [payment]);

  const totalAmount = instruments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalAlloc  = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalAdj    = adjustments.reduce((s, a) => s + Number(a.amount || 0), 0);
  const unadjusted  = totalAmount - totalAlloc - totalAdj;

  function updateInst(i: number, field: keyof RPInstrument, value: string | number) {
    setInstruments(prev => prev.map((inst, idx) => idx === i ? { ...inst, [field]: value } : inst));
  }
  function updateAdj(i: number, field: keyof RPAdjustment, value: string | number) {
    setAdjustments(prev => prev.map((adj, idx) => {
      if (idx !== i) return adj;
      const updated = { ...adj, [field]: value };
      if (field === 'account_id') {
        const coa = coaList.find(c => c.id === Number(value));
        if (coa) updated.account_name = coa.name;
      }
      return updated;
    }));
  }
  function toggleInvoice(inv: OpenInvoice) {
    setAllocations(prev => {
      const exists = prev.find(a => a.invoice_id === inv.id);
      if (exists) return prev.filter(a => a.invoice_id !== inv.id);
      return [...prev, { invoice_id: inv.id, invoice_number: inv.number, balance_amount: inv.balance_amount, amount: Number(inv.balance_amount) }];
    });
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  }

  function buildPayload() {
    return {
      customer_id: Number(customerId), date, reference: reference || null, notes: comments || null,
      auto_settle: false,
      instruments: instruments.filter(i => Number(i.amount) > 0),
      adjustments: showAdjustments ? adjustments.filter(a => Number(a.amount) > 0 && a.account_id) : [],
      allocations: makeSettlements ? allocations.filter(a => Number(a.amount) > 0) : [],
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId) { setError('Customer is required'); return; }
    if (instruments.every(i => !i.amount)) { setError('At least one instrument with an amount is required'); return; }
    setSaving(true);
    try {
      if (isEdit) await updateReceivePayment(payment!.id, buildPayload());
      else        await createReceivePayment(buildPayload());
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleSaveAndContinue() {
    setError(null);
    if (!customerId) { setError('Customer is required'); return; }
    if (instruments.every(i => !i.amount)) { setError('At least one instrument with an amount is required'); return; }
    setSavingContinue(true);
    try {
      if (isEdit) await updateReceivePayment(payment!.id, buildPayload());
      else {
        const created = await createReceivePayment(buildPayload()) as ReceivePayment;
        setNumber(created.number);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSavingContinue(false); }
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Receive Payment {number ? `- [${number}]` : ''}
          </h2>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
              {RP_STATUS_LABELS[status as keyof typeof RP_STATUS_LABELS] || 'DRAFT'}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            {/* Row 1: Customer | Number | Date | Reference */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={customerId} onChange={e => setCustomerId(e.target.value)} required
                >
                  <option value="">Type to search customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-1">
                  <input
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={number} readOnly
                  />
                  <button type="button" title="Refresh number"
                    onClick={() => getNextPaymentNumber().then(d => setNumber(d.number))}
                    className="bg-green-500 hover:bg-green-600 text-white rounded px-2 py-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={date} onChange={e => setDate(e.target.value)} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)}
                />
              </div>
            </div>

            {/* Payment Instruments table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-32">Payment Mode</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-40">Account</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Reference</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Bank Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Instrument No.</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-36">Instrument Date</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28">Amount</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {instruments.map((inst, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-2 py-1">
                        <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={inst.payment_mode} onChange={e => updateInst(i, 'payment_mode', e.target.value)}>
                          {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={inst.account_id ?? ''} onChange={e => updateInst(i, 'account_id', Number(e.target.value) || 0)}>
                          <option value="">Cash In Hand</option>
                          {coaList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Reference" value={inst.reference ?? ''} onChange={e => updateInst(i, 'reference', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Bank Name" value={inst.bank_name} onChange={e => updateInst(i, 'bank_name', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Instrument No." value={inst.instrument_no} onChange={e => updateInst(i, 'instrument_no', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={inst.instrument_date} onChange={e => updateInst(i, 'instrument_date', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right" value={inst.amount || ''} min="0" step="0.01" placeholder="0" onChange={e => updateInst(i, 'amount', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" title="Add new row" className="text-green-500 hover:text-green-700" onClick={() => setInstruments(p => [...p, emptyInst()])}>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button type="button" title="Remove row" className="text-red-400 hover:text-red-600" onClick={() => setInstruments(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p)}>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Account Adjustments checkbox */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={showAdjustments} onChange={e => setShowAdjustments(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600" />
                <span className="font-medium">Account Adjustments (Optional)</span>
                <span className="text-blue-500 text-xs">(e.g. WHT, Rebate, etc)</span>
              </label>
              {showAdjustments && (
                <div className="mt-3 border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Account</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28">Amount</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {adjustments.map((adj, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1">
                            <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={adj.account_id || ''} onChange={e => updateAdj(i, 'account_id', Number(e.target.value))}>
                              <option value="">Select account…</option>
                              {coaList.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={adj.description} onChange={e => updateAdj(i, 'description', e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right" value={adj.amount || ''} min="0" step="0.01" onChange={e => updateAdj(i, 'amount', parseFloat(e.target.value) || 0)} />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button type="button" onClick={() => setAdjustments(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                    <button type="button" onClick={() => setAdjustments(p => [...p, emptyAdj()])} className="text-sm text-green-600 hover:text-green-800 font-medium">+ Add Row</button>
                  </div>
                </div>
              )}
            </div>

            {/* Make auto settlements */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none mb-3">
                <input
                  type="checkbox"
                  checked={makeSettlements}
                  onChange={e => setMakeSettlements(e.target.checked)}
                  className="h-4 w-4 rounded border-green-500 text-green-600 accent-green-500"
                />
                <span className="font-medium">Make auto settlements</span>
              </label>

              {makeSettlements && (
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-white border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 w-10">
                          <input type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            onChange={e => {
                              if (e.target.checked) setAllocations(openInvoices.map(inv => ({ invoice_id: inv.id, invoice_number: inv.number, balance_amount: inv.balance_amount, amount: Number(inv.balance_amount) })));
                              else setAllocations([]);
                            }}
                            checked={openInvoices.length > 0 && allocations.length === openInvoices.length}
                          />
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Due Date</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Amount</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Adjusted Amount</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Balance Amount</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28">Allocate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {openInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 text-amber-500 text-sm">No record found</td>
                        </tr>
                      ) : openInvoices.map(inv => {
                        const alloc = allocations.find(a => a.invoice_id === inv.id);
                        return (
                          <tr key={inv.id} className={alloc ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={!!alloc} onChange={() => toggleInvoice(inv)} className="h-4 w-4 rounded border-gray-300" />
                            </td>
                            <td className="px-3 py-2 text-blue-600 font-mono text-xs">{inv.number}</td>
                            <td className="px-3 py-2 text-gray-600">{inv.date ? inv.date.slice(0, 10) : '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{inv.due_date ? inv.due_date.slice(0, 10) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmt(inv.net_amount)}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmt(inv.paid_amount ?? 0)}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmt(inv.balance_amount)}</td>
                            <td className="px-3 py-2">
                              {alloc ? (
                                <input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-right text-sm" value={alloc.amount} min="0.01" step="0.01" max={inv.balance_amount}
                                  onChange={e => setAllocations(prev => prev.map(a => a.invoice_id === inv.id ? { ...a, amount: parseFloat(e.target.value) || 0 } : a))} />
                              ) : (
                                <span className="block text-right text-gray-400 text-sm pr-2">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Comments + Total Amount */}
            <div className="grid grid-cols-2 gap-6 items-start">
              <div>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  rows={4} placeholder="Comments"
                  value={comments} onChange={e => setComments(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-4 pt-2">
                <span className="text-sm font-semibold text-gray-700">Total Amount (PKR)</span>
                <input
                  readOnly
                  className="w-36 border border-gray-300 rounded px-3 py-2 text-sm text-right bg-gray-50 font-mono font-semibold"
                  value={fmt(totalAmount)}
                />
              </div>
            </div>

            {/* Attachments */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h3>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <p className="mb-2">Drop files here or</p>
                <button type="button"
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded"
                  onClick={() => fileInputRef.current?.click()}
                >
                  BROWSE FILES
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={e => setAttachments(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                {attachments.length > 0 && (
                  <ul className="mt-3 space-y-1 text-left">
                    {attachments.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {f.name}
                        <button type="button" onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 ml-1">×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500 space-x-4">
              <span>Total: <span className="font-semibold font-mono text-gray-800">{fmt(totalAmount)}</span></span>
              <span>Allocated: <span className="font-semibold font-mono text-gray-800">{fmt(totalAlloc + totalAdj)}</span></span>
              <span>Unadjusted: <span className={`font-semibold font-mono ${unadjusted === 0 ? 'text-green-600' : 'text-orange-600'}`}>{fmt(unadjusted)}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndContinue}
                disabled={savingContinue}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {savingContinue ? 'SAVING…' : 'SAVE AND CONTINUE EDIT'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 text-white rounded font-medium"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                CLOSE
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50">
                {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
    </div>
  );
}


