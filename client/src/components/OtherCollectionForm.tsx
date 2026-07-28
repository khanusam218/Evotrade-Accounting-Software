import { useEffect, useRef, useState } from 'react';
import type { Account } from '../types/account';
import type { BankAccount } from '../types/bankAccount';
import type { OtherCollection, OTFormData, PaymentMode } from '../types/otherTransaction';
import { getAccountsLookup } from '../api/accounts';
import { getBankAccountsLookup } from '../api/bankAccounts';
import {
  createOtherCollection, getNextOCNumber, updateOtherCollection,
} from '../api/otherCollections';
import { getOtherCollection } from '../api/otherCollections';
import { validateName } from '../utils/validators';

interface CollectionLine {
  mode: string;
  accountId: string;
  reference: string;
  bankName: string;
  instrumentNo: string;
  instrumentDate: string;
  amount: string;
}

interface Props {
  record: OtherCollection | null;
  onClose: () => void;
  onSaved: (addNew?: boolean) => void;
}

function emptyLine(): CollectionLine {
  return { mode: 'cash', accountId: '', reference: '', bankName: '', instrumentNo: '', instrumentDate: '', amount: '' };
}
function today() { return new Date().toISOString().slice(0, 10); }

function BankAccountSearch({
  bankAccounts,
  value,
  onChange,
  placeholder,
  hasError,
}: {
  bankAccounts: BankAccount[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  hasError: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const selected          = bankAccounts.find((ba) => String(ba.id) === value);

  const filtered = bankAccounts.filter((ba) => {
    const q = query.toLowerCase();
    return (
      ba.name.toLowerCase().includes(q) ||
      ba.code.toLowerCase().includes(q) ||
      (ba.bank_name ?? '').toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function select(id: string) { onChange(id); setQuery(''); setOpen(false); }

  return (
    <div className="relative" ref={ref}>
      <div
        className={`flex items-center border rounded px-3 py-2 cursor-text ${
          hasError ? 'border-red-500' : 'border-gray-300'
        } ${open ? 'ring-1 ring-blue-400 border-blue-400' : ''}`}
        onClick={() => { setOpen(true); setQuery(''); }}>
        {open ? (
          <input autoFocus type="text"
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)} />
        ) : (
          <span className={`flex-1 text-sm ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
            {selected ? selected.name : placeholder}
          </span>
        )}
        <svg className="w-4 h-4 text-gray-400 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No accounts found</p>
          ) : (
            filtered.map((ba) => (
              <button key={ba.id} type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                onClick={() => select(String(ba.id))}>
                <span>{ba.name}</span>
                <span className="text-xs text-gray-400 ml-2">{ba.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'cash',          label: 'Cash' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function OtherCollectionForm({ record, onClose, onSaved }: Props) {
  const isEdit = record !== null;
  const status = isEdit ? record.status : 'draft';

  const [number, setNumber]         = useState(isEdit ? record.number : '');
  const [date, setDate]             = useState(isEdit ? record.date.slice(0, 10) : today());
  const [contactName, setContact]   = useState(isEdit ? record.contact_name : '');
  const [reference, setReference]   = useState(isEdit ? (record.reference ?? '') : '');
  const [bankAccountId, setBank]    = useState(isEdit ? String(record.bank_account_id) : '');
  const [comments, setComments]     = useState(isEdit ? (record.comments ?? '') : '');
  const [lines, setLines]           = useState<CollectionLine[]>([emptyLine()]);
  const [showAdjustments, setShowAdj] = useState(false);

  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving]             = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [numberLoading, setNumberLoading] = useState(!isEdit);

  useEffect(() => {
    getAccountsLookup().then(setAccounts).catch(() => {});
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getOtherCollection(record.id).then((full) => {
      const ins  = full.instruments  ?? [];
      const adjs = full.adjustments  ?? [];
      const count = Math.max(ins.length, adjs.length, 1);
      const loaded: CollectionLine[] = Array.from({ length: count }, (_, i) => ({
        mode:           ins[i]?.payment_mode  ?? 'cash',
        accountId:      adjs[i] ? String(adjs[i].account_id) : '',
        reference:      adjs[i]?.description  ?? '',
        bankName:       ins[i]?.bank_name     ?? '',
        instrumentNo:   ins[i]?.instrument_no ?? '',
        instrumentDate: ins[i]?.instrument_date ?? '',
        amount:         ins[i] ? String(ins[i].amount) : (adjs[i] ? String(adjs[i].amount) : ''),
      }));
      setLines(loaded.length ? loaded : [emptyLine()]);
    }).catch(() => {});
  }, [isEdit, record]);

  useEffect(() => {
    if (isEdit) return;
    getNextOCNumber()
      .then((n) => { setNumber(n); setNumberLoading(false); })
      .catch(() => setNumberLoading(false));
  }, [isEdit]);

  function updLine<K extends keyof CollectionLine>(i: number, k: K, v: CollectionLine[K]) {
    setLines((p) => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }

  function removeLine(i: number) {
    setLines((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : [emptyLine()]);
  }

  const totalAmount = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isCash = (mode: string) => mode === 'cash';

  function validate() {
    const e: Record<string, string> = {};
    if (!date)                e.date    = 'Date is required';
    const contactErr = validateName(contactName, 'Contact'); if (contactErr) e.contact = contactErr;
    if (!bankAccountId)       e.bank    = 'Account is required';
    const validLines = lines.filter((l) => l.accountId && parseFloat(l.amount || '0') > 0);
    if (!validLines.length)   e.lines   = 'At least one line with account and amount is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave(addNew = false) {
    if (!validate()) return;
    const validLines = lines.filter((l) => parseFloat(l.amount || '0') > 0);
    const payload: OTFormData = {
      date, contact_name: contactName.trim(),
      reference: reference.trim(), bank_account_id: bankAccountId,
      comments: comments.trim(),
      instruments: validLines.map((l) => ({
        payment_mode:    l.mode as PaymentMode,
        bank_name:       l.bankName,
        instrument_no:   l.instrumentNo,
        instrument_date: l.instrumentDate,
        amount:          parseFloat(l.amount) || 0,
      })),
      adjustments: validLines.filter((l) => l.accountId).map((l) => ({
        account_id:  Number(l.accountId),
        description: l.reference,
        amount:      parseFloat(l.amount) || 0,
      })),
    };
    setSaving(true);
    try {
      if (isEdit) await updateOtherCollection(record.id, payload);
      else        await createOtherCollection(payload);
      onSaved(addNew);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  const STATUS_LABEL: Record<string, string> = {
    draft: 'DRAFT', approved: 'APPROVED', cancelled: 'CANCELLED',
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            Other Collections - [{isEdit ? record.number : (numberLoading ? '…' : number)}]
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-500 tracking-wider">{STATUS_LABEL[status]}</span>
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">

          {/* Row 1: Other Contact | Account (bank) | Number */}
          <div className="grid grid-cols-3 gap-4">

            {/* Other Contact */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Other Contact <span className="text-red-500">*</span>
              </label>
              <input type="text"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  errors.contact ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Type to search contact"
                value={contactName}
                onChange={(e) => { setContact(e.target.value); setErrors((p) => ({ ...p, contact: '' })); }} />
              {errors.contact && <p className="mt-1 text-xs text-red-600">{errors.contact}</p>}
            </div>

            {/* Account (bank account) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account <span className="text-red-500">*</span>
              </label>
              <BankAccountSearch
                bankAccounts={bankAccounts}
                value={bankAccountId}
                onChange={(id) => { setBank(id); setErrors((p) => ({ ...p, bank: '' })); }}
                placeholder="Type to search account"
                hasError={!!errors.bank}
              />
              {errors.bank && <p className="mt-1 text-xs text-red-600">{errors.bank}</p>}
            </div>

            {/* Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1">
                <input type="text"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={numberLoading ? 'Loading…' : number}
                  readOnly={isEdit}
                  onChange={(e) => !isEdit && setNumber(e.target.value)} />
                {!isEdit && (
                  <button type="button"
                    onClick={() => { setNumberLoading(true); getNextOCNumber().then(setNumber).finally(() => setNumberLoading(false)); }}
                    className="px-2 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm">↺</button>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Date | Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input type="date"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
                value={date}
                onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }} />
              {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>

          {/* Collection Lines Table */}
          <div>
            {errors.lines && <p className="mb-2 text-xs text-red-600">{errors.lines}</p>}
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-36">Other Collection Mode</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-44">Account</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-28">Reference</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-28">Bank Name</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-28">Instrument No.</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-32">Instrument Date</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-700 w-28">Amount</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-700 w-16">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      {/* Mode */}
                      <td className="px-2 py-1.5">
                        <select
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={line.mode}
                          onChange={(e) => updLine(i, 'mode', e.target.value)}>
                          {MODE_OPTIONS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </td>
                      {/* Account (COA) */}
                      <td className="px-2 py-1.5">
                        <select
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={line.accountId}
                          onChange={(e) => updLine(i, 'accountId', e.target.value)}>
                          <option value="">— Select —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </td>
                      {/* Reference */}
                      <td className="px-2 py-1.5">
                        <input type="text"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="Reference"
                          value={line.reference}
                          onChange={(e) => updLine(i, 'reference', e.target.value)} />
                      </td>
                      {/* Bank Name */}
                      <td className="px-2 py-1.5">
                        <input type="text"
                          className={`w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                            isCash(line.mode) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                          }`}
                          placeholder="Bank Name"
                          disabled={isCash(line.mode)}
                          value={line.bankName}
                          onChange={(e) => updLine(i, 'bankName', e.target.value)} />
                      </td>
                      {/* Instrument No. */}
                      <td className="px-2 py-1.5">
                        <input type="text"
                          className={`w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                            isCash(line.mode) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                          }`}
                          placeholder="Instrument No."
                          disabled={isCash(line.mode)}
                          value={line.instrumentNo}
                          onChange={(e) => updLine(i, 'instrumentNo', e.target.value)} />
                      </td>
                      {/* Instrument Date */}
                      <td className="px-2 py-1.5">
                        <input type="date"
                          className={`w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                            isCash(line.mode) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                          }`}
                          disabled={isCash(line.mode)}
                          value={line.instrumentDate}
                          onChange={(e) => updLine(i, 'instrumentDate', e.target.value)} />
                      </td>
                      {/* Amount */}
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" min="0"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="0"
                          value={line.amount}
                          onChange={(e) => updLine(i, 'amount', e.target.value)} />
                      </td>
                      {/* Action */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button"
                            className="text-green-500 hover:text-green-700"
                            title="Confirm">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button type="button"
                            onClick={() => removeLine(i)}
                            className="text-red-400 hover:text-red-600"
                            title="Remove">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button"
              onClick={() => setLines((p) => [...p, emptyLine()])}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Line
            </button>
          </div>

          {/* Account Adjustments (Optional) */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-blue-500"
                checked={showAdjustments}
                onChange={(e) => setShowAdj(e.target.checked)} />
              <span className="text-sm font-medium text-gray-700">
                Account Adjustments (Optional)
              </span>
              <span className="text-xs text-blue-500">(e.g. WHT, Rebate, etc)</span>
            </label>
          </div>

          {/* Comments + Total Amount */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
              <textarea rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (PKR)</label>
              <input type="text" readOnly
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-right bg-gray-50 font-semibold text-gray-800"
                value={fmt(totalAmount)} />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Attachments</p>
            <div className="border-2 border-dashed border-gray-300 rounded p-8 flex flex-col items-center justify-center gap-3 text-sm text-gray-400 cursor-pointer hover:border-gray-400 transition-colors">
              <span>Drop files here or</span>
              <button type="button"
                className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded">
                BROWSE FILES
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-gray-200 bg-gray-50 px-6 py-3 rounded-b gap-3">
          <div className="flex">
            <button type="button" onClick={() => handleSave(true)} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-l border border-gray-300 disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'SAVING…' : 'SAVE AND NEW'}
            </button>
            <button type="button" disabled={saving}
              className="px-2 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-r border border-l-0 border-gray-300 disabled:opacity-50">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            CLOSE
          </button>
        </div>

    </div>
  );
}
