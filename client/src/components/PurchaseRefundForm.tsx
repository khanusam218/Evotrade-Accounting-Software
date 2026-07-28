import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { PurchaseRefund, PurchaseRefundInstrument, PRefundMode } from '../types/purchaseRefund';
import { PREFUND_STATUS_LABELS } from '../types/purchaseRefund';
import { createPurchaseRefund, updatePurchaseRefund, getPurchaseRefund, getNextPurchaseRefundNumber } from '../api/purchaseRefunds';
import { validatePositive } from '../utils/validators';

interface Vendor  { id: number; print_name: string; }
interface PReturn { id: number; number: string; date: string; net_amount: number; unadjusted_amount: number; status: string; }
interface COA     { id: number; name: string; }
interface Props   { refund: PurchaseRefund | null; onClose: () => void; onSaved: () => void; }

const MODES: { value: PRefundMode; label: string }[] = [
  { value: 'cash',   label: 'Cash' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card',   label: 'Card' },
  { value: 'other',  label: 'Other' },
];

const emptyInst = (): PurchaseRefundInstrument => ({
  mode: 'cash', bank_ref: null, bank_name: null, instrument_no: null,
  date: new Date().toISOString().slice(0, 10), account_id: null, amount: 0,
});

export default function PurchaseRefundForm({ refund, onClose, onSaved }: Props) {
  const [vendors,     setVendors]     = useState<Vendor[]>([]);
  const [returns,     setReturns]     = useState<PReturn[]>([]);
  const [accounts,    setAccounts]    = useState<COA[]>([]);
  const [nextNum,     setNextNum]     = useState('VR-000001');
  const [vendorId,    setVendorId]    = useState('');
  const [returnId,    setReturnId]    = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [reference,   setReference]   = useState('');
  const [notes,       setNotes]       = useState('');
  const [instruments, setInstruments] = useState<PurchaseRefundInstrument[]>([emptyInst()]);
  const [acctAdj,     setAcctAdj]     = useState(false);
  const [autoSettle,  setAutoSettle]  = useState(true);
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/chart-of-accounts').then(r => r.json()).then((d: COA[]) => setAccounts(Array.isArray(d) ? d : []));
    if (!refund) getNextPurchaseRefundNumber().then(r => setNextNum(r.number)).catch(() => {});
  }, [refund]);

  useEffect(() => {
    if (!vendorId) { setReturns([]); return; }
    apiFetch(`/api/purchase-returns?vendor_id=${vendorId}`).then(r => r.json()).then(d => {
      const all = Array.isArray(d) ? d : [];
      setReturns(all.filter((r: PReturn) => ['approved', 'partially_adjusted'].includes(r.status)));
    });
  }, [vendorId]);

  useEffect(() => {
    if (!refund) return;
    getPurchaseRefund(refund.id).then(full => {
      setVendorId(String(full.vendor_id));
      setReturnId(full.return_id ? String(full.return_id) : '');
      setDate(full.date?.slice(0, 10) ?? '');
      setReference(full.reference ?? '');
      setNotes(full.notes ?? '');
      setInstruments(full.instruments?.length ? full.instruments : [emptyInst()]);
      setNextNum(full.number);
    });
  }, [refund]);

  function updInst(i: number, patch: Partial<PurchaseRefundInstrument>) {
    setInstruments(prev => prev.map((inst, idx) => idx !== i ? inst : { ...inst, ...patch }));
  }

  const total = instruments.reduce((s, inst) => s + Number(inst.amount || 0), 0);
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function validate() {
    const e: Record<string, string> = {};
    if (!vendorId) e.vendor = 'Vendor is required.';
    if (!date) e.date = 'Date is required.';
    const validInst = instruments.filter(inst => Number(inst.amount) > 0);
    if (!validInst.length) e.instruments = 'At least one instrument with amount is required.';
    instruments.forEach((inst, i) => {
      const amtErr = validatePositive(Number(inst.amount || 0), 'Amount'); if (amtErr) e[`amount_${i}`] = amtErr;
      if (Number(inst.amount || 0) > 0 && !inst.account_id) e[`account_${i}`] = 'Account is required.';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(e: React.FormEvent, continueEdit = false) {
    e.preventDefault(); setError('');
    if (!validate()) return;
    const validInst = instruments.filter(inst => Number(inst.amount) > 0);
    setSaving(true);
    try {
      const payload = {
        vendor_id: Number(vendorId), return_id: returnId ? Number(returnId) : null,
        date, reference: reference || null, notes: notes || null, instruments: validInst,
      };
      if (refund) await updatePurchaseRefund(refund.id, payload);
      else await createPurchaseRefund(payload);
      if (!continueEdit) onSaved();
      else getNextPurchaseRefundNumber().then(r => setNextNum(r.number)).catch(() => {});
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Vendor Refunds - [{nextNum}]</h2>
          <span className="text-sm font-bold text-gray-500 tracking-widest">
            {refund ? PREFUND_STATUS_LABELS[refund.status].toUpperCase() : 'DRAFT'}
          </span>
        </div>

        <form onSubmit={e => handleSave(e)}>
          <div className="px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

            {/* Row 1: Vendor | Number | Date | Reference */}
            <div className="grid grid-cols-4 gap-4">
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
                  <button type="button" onClick={() => getNextPurchaseRefundNumber().then(r => setNextNum(r.number)).catch(() => {})}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
            </div>

            {/* Row 2: Linked Purchase Return */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Purchase Return</label>
                <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={returnId} onChange={e => setReturnId(e.target.value)}>
                  <option value="">None</option>
                  {returns.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}
                </select>
              </div>
            </div>

            {/* Instruments Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-40">Payment Mode</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-44">Account</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">Reference</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">Bank Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-32">Instrument No.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 w-36">Instrument Date</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-36">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {instruments.map((inst, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1.5">
                        <select className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50"
                          value={inst.mode} onChange={e => updInst(i, { mode: e.target.value as PRefundMode })}>
                          {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50 ${errors[`account_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                          value={inst.account_id ?? ''} onChange={e => updInst(i, { account_id: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">Select account</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        {errors[`account_${i}`] && <p className="text-xs text-red-500 mt-1">{errors[`account_${i}`]}</p>}
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="Reference" value={inst.bank_ref ?? ''}
                          onChange={e => updInst(i, { bank_ref: e.target.value || null })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="Bank Name" value={inst.bank_name ?? ''}
                          onChange={e => updInst(i, { bank_name: e.target.value || null })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          placeholder="Instrument No." value={inst.instrument_no ?? ''}
                          onChange={e => updInst(i, { instrument_no: e.target.value || null })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          value={inst.date} onChange={e => updInst(i, { date: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="any"
                          className={`w-full border rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 ${errors[`amount_${i}`] ? 'border-red-500' : 'border-gray-200'}`}
                          value={inst.amount} onChange={e => updInst(i, { amount: Number(e.target.value) })} />
                        {errors[`amount_${i}`] && <p className="text-xs text-red-500 mt-1">{errors[`amount_${i}`]}</p>}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => updInst(i, {})}
                            className="h-7 w-7 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center text-xs font-bold">✓</button>
                          <button type="button" onClick={() => setInstruments(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : [emptyInst()])}
                            className="h-7 w-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-xs font-bold">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => setInstruments(prev => [...prev, emptyInst()])}
                className="mt-2 text-sm text-green-600 hover:text-green-700 hover:underline font-medium">
                + Add Line
              </button>
              {errors.instruments && <p className="text-xs text-red-500 mt-1">{errors.instruments}</p>}
            </div>

            {/* Account Adjustments */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={acctAdj} onChange={e => setAcctAdj(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="text-sm font-medium text-gray-700">Account Adjustments (Optional)</span>
                <span className="text-sm text-teal-500">(e.g. WHT, Rebate, etc)</span>
              </label>
            </div>

            {/* Comments + Total Amount */}
            <div className="grid grid-cols-2 gap-6 items-start">
              <div>
                <textarea rows={4}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  placeholder="Comments" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="flex items-center justify-end gap-4 pt-2">
                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Total Amount (PKR)</span>
                <input className="w-44 border border-gray-300 rounded px-3 py-2 text-sm text-right bg-gray-50 font-mono font-bold"
                  value={fmt(total)} readOnly />
              </div>
            </div>

            {/* Attachments */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                <p className="text-sm text-gray-400 mb-3">Drop files here or</p>
                <button type="button" className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded">
                  BROWSE FILES
                </button>
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
                      {returns.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-6 text-center text-sm text-amber-500 font-medium">No record found</td>
                        </tr>
                      ) : returns.map(ret => {
                        const adjusted = Number(ret.net_amount || 0) - Number(ret.unadjusted_amount || 0);
                        return (
                          <tr key={ret.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                            </td>
                            <td className="px-3 py-2 text-gray-800 font-medium">{ret.number}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{ret.date?.slice(0, 10) ?? '-'}</td>
                            <td className="px-3 py-2 text-center text-gray-500">–</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(Number(ret.net_amount || 0))}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(adjusted)}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(Number(ret.unadjusted_amount || 0))}</td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" min="0" step="any"
                                className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                                value={allocations[ret.id] ?? ''}
                                onChange={e => setAllocations(prev => ({ ...prev, [ret.id]: e.target.value }))}
                                placeholder="0.00" />
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


