import { useEffect, useState } from 'react';
import type { Account } from '../types/account';
import type { BankAccount } from '../types/bankAccount';
import type {
  AdjustmentLine, OTFormData, OtherCollection, OtherPayment,
  PaymentInstrument, PaymentMode,
} from '../types/otherTransaction';
import { PAYMENT_MODE_LABELS } from '../types/otherTransaction';
import { getAccountsLookup } from '../api/accounts';
import { getBankAccountsLookup } from '../api/bankAccounts';
import { createOtherCollection, updateOtherCollection } from '../api/otherCollections';
import { createOtherPayment, updateOtherPayment } from '../api/otherPayments';
import { validateName } from '../utils/validators';

interface Props {
  mode: 'collection' | 'payment';
  record: OtherCollection | OtherPayment | null;
  onClose: () => void;
  onSaved: () => void;
}

function emptyInstrument(): PaymentInstrument {
  return { payment_mode: '', bank_name: '', instrument_no: '', instrument_date: '', amount: '' };
}
function emptyAdjustment(): AdjustmentLine {
  return { account_id: '', description: '', amount: '' };
}
function today() { return new Date().toISOString().slice(0, 10); }

export default function OtherTransactionForm({ mode, record, onClose, onSaved }: Props) {
  const isEdit    = record !== null;
  const isCollection = mode === 'collection';
  const title    = isCollection ? 'Other Collection' : 'Other Payment';
  const bankLabel = isCollection ? 'Deposit To' : 'Pay From';

  const [date, setDate]             = useState(isEdit ? record.date.slice(0, 10) : today());
  const [contactName, setContact]   = useState(isEdit ? record.contact_name : '');
  const [reference, setReference]   = useState(isEdit ? (record.reference ?? '') : '');
  const [bankAccountId, setBank]    = useState(isEdit ? String(record.bank_account_id) : '');
  const [comments, setComments]     = useState(isEdit ? (record.comments ?? '') : '');
  const [instruments, setInstruments] = useState<PaymentInstrument[]>(
    isEdit && record.instruments?.length ? record.instruments : [emptyInstrument()]
  );
  const [adjustments, setAdjustments] = useState<AdjustmentLine[]>(
    isEdit && record.adjustments?.length ? record.adjustments : [emptyAdjustment()]
  );

  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving]             = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});

  useEffect(() => {
    getAccountsLookup().then(setAccounts).catch(() => {});
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
  }, []);

  function updIns<K extends keyof PaymentInstrument>(i: number, k: K, v: PaymentInstrument[K]) {
    setInstruments((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  }
  function updAdj<K extends keyof AdjustmentLine>(i: number, k: K, v: AdjustmentLine[K]) {
    setAdjustments((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  }

  const adjTotal = adjustments.reduce((s, a) => s + (parseFloat(String(a.amount)) || 0), 0);
  const insTotal = instruments.reduce((s, i) => s + (parseFloat(String(i.amount)) || 0), 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!date)              e.date    = 'Date is required';
    const contactErr = validateName(contactName, 'Contact name'); if (contactErr) e.contact = contactErr;
    if (!bankAccountId)     e.bank    = `${bankLabel} is required`;
    const validAdjs = adjustments.filter((a) => a.account_id && (parseFloat(String(a.amount)) || 0) > 0);
    if (!validAdjs.length)  e.adjs    = 'At least one account adjustment with amount is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: OTFormData = {
      date, contact_name: contactName.trim(),
      reference: reference.trim(), bank_account_id: bankAccountId,
      comments: comments.trim(),
      instruments: instruments
        .filter((i) => i.payment_mode && (parseFloat(String(i.amount)) || 0) > 0)
        .map((i) => ({ ...i, amount: parseFloat(String(i.amount)) || 0 })),
      adjustments: adjustments
        .filter((a) => a.account_id && (parseFloat(String(a.amount)) || 0) > 0)
        .map((a) => ({ ...a, account_id: Number(a.account_id), amount: parseFloat(String(a.amount)) || 0 })),
    };

    setSaving(true);
    try {
      if (isCollection) {
        if (isEdit) await updateOtherCollection(record!.id, payload);
        else        await createOtherCollection(payload);
      } else {
        if (isEdit) await updateOtherPayment(record!.id, payload);
        else        await createOtherPayment(payload);
      }
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? `Edit ${title} — ${record.number}` : `New ${title}`}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form id="ot-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Header fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Date <span className="text-red-500">*</span></label>
              <input type="date" className={`input ${errors.date ? 'border-red-400' : ''}`} value={date}
                onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }} />
              {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
            </div>
            <div>
              <label className="label">Other Contact <span className="text-red-500">*</span></label>
              <input type="text" className={`input ${errors.contact ? 'border-red-400' : ''}`}
                placeholder="Contact name" value={contactName}
                onChange={(e) => { setContact(e.target.value); setErrors((p) => ({ ...p, contact: '' })); }} />
              {errors.contact && <p className="mt-1 text-xs text-red-600">{errors.contact}</p>}
            </div>
            <div>
              <label className="label">Reference</label>
              <input type="text" className="input" placeholder="Optional" value={reference}
                onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{bankLabel} <span className="text-red-500">*</span></label>
              <select className={`input ${errors.bank ? 'border-red-400' : ''}`} value={bankAccountId}
                onChange={(e) => { setBank(e.target.value); setErrors((p) => ({ ...p, bank: '' })); }}>
                <option value="">— Select bank account —</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>{ba.code} — {ba.name}</option>
                ))}
              </select>
              {errors.bank && <p className="mt-1 text-xs text-red-600">{errors.bank}</p>}
            </div>
            <div>
              <label className="label">Comments</label>
              <input type="text" className="input" placeholder="Optional notes" value={comments}
                onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>

          {/* Instruments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                Payment Instruments {isCollection ? 'Received' : 'Made'}
              </p>
              <button type="button" onClick={() => setInstruments((p) => [...p, emptyInstrument()])}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Instrument
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th w-36">Mode</th>
                    <th className="table-th">Bank Name</th>
                    <th className="table-th w-32">Instrument No.</th>
                    <th className="table-th w-32">Instr. Date</th>
                    <th className="table-th text-right w-28">Amount</th>
                    <th className="table-th w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {instruments.map((ins, i) => (
                    <tr key={i}>
                      <td className="table-td">
                        <select className="input py-1 text-sm" value={ins.payment_mode}
                          onChange={(e) => updIns(i, 'payment_mode', e.target.value as PaymentMode | '')}>
                          <option value="">— Mode —</option>
                          {(Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((m) => (
                            <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="table-td"><input type="text" className="input py-1 text-sm" placeholder="Optional"
                        value={ins.bank_name} onChange={(e) => updIns(i, 'bank_name', e.target.value)} /></td>
                      <td className="table-td"><input type="text" className="input py-1 text-sm font-mono" placeholder="Cheque #"
                        value={ins.instrument_no} onChange={(e) => updIns(i, 'instrument_no', e.target.value)} /></td>
                      <td className="table-td"><input type="date" className="input py-1 text-sm"
                        value={ins.instrument_date} onChange={(e) => updIns(i, 'instrument_date', e.target.value)} /></td>
                      <td className="table-td"><input type="number" step="0.01" min="0" className="input py-1 text-sm text-right"
                        placeholder="0.00" value={ins.amount}
                        onChange={(e) => updIns(i, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} /></td>
                      <td className="table-td text-center">
                        {instruments.length > 1 && (
                          <button type="button" onClick={() => setInstruments((p) => p.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-500">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={4} className="table-td text-right text-sm font-semibold text-gray-600">Instruments Total</td>
                    <td className="table-td text-right font-mono text-sm font-semibold">
                      {insTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Account Adjustments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                Account Adjustments ({isCollection ? 'Credit accounts' : 'Debit accounts'})
              </p>
              <button type="button" onClick={() => setAdjustments((p) => [...p, emptyAdjustment()])}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Line
              </button>
            </div>
            {errors.adjs && <p className="mb-2 text-xs text-red-600">{errors.adjs}</p>}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">Account</th>
                    <th className="table-th">Description</th>
                    <th className="table-th text-right w-32">Amount</th>
                    <th className="table-th w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {adjustments.map((adj, i) => (
                    <tr key={i}>
                      <td className="table-td">
                        <select className="input py-1 text-sm"
                          value={adj.account_id}
                          onChange={(e) => updAdj(i, 'account_id', e.target.value === '' ? '' : Number(e.target.value))}>
                          <option value="">— Select account —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="table-td"><input type="text" className="input py-1 text-sm" placeholder="Optional"
                        value={adj.description} onChange={(e) => updAdj(i, 'description', e.target.value)} /></td>
                      <td className="table-td"><input type="number" step="0.01" min="0" className="input py-1 text-sm text-right"
                        placeholder="0.00" value={adj.amount}
                        onChange={(e) => updAdj(i, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} /></td>
                      <td className="table-td text-center">
                        {adjustments.length > 1 && (
                          <button type="button" onClick={() => setAdjustments((p) => p.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-500">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={2} className="table-td text-right text-sm font-semibold text-gray-600">Total Amount</td>
                    <td className="table-td text-right font-mono text-sm font-semibold">
                      {adjTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="ot-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save as Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
