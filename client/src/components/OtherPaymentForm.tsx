import { useEffect, useRef, useState } from 'react';
import type { Account } from '../types/account';
import type { BankAccount } from '../types/bankAccount';
import type { OtherPayment, OTFormData, PaymentMode } from '../types/otherTransaction';
import { getAccountsLookup } from '../api/accounts';
import { getBankAccountsLookup } from '../api/bankAccounts';
import {
  createOtherPayment, getNextOPNumber, updateOtherPayment,
} from '../api/otherPayments';
import { getOtherPayment } from '../api/otherPayments';
import { validateName } from '../utils/validators';

interface PaymentLine {
  mode: string;
  accountId: string;
  documentNo: string;
  amount: string;
}

interface Props {
  record: OtherPayment | null;
  onClose: () => void;
  onSaved: (addNew?: boolean) => void;
}

function emptyLine(): PaymentLine {
  return { mode: 'cash', accountId: '', documentNo: '', amount: '' };
}
function today() { return new Date().toISOString().slice(0, 10); }

function BankAccountSearch({
  bankAccounts, value, onChange, placeholder, hasError,
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
        className={`flex items-center border rounded px-3 py-2 cursor-text bg-white ${
          hasError ? 'border-red-500' : 'border-gray-300'
        } ${open ? 'ring-1 ring-blue-400 border-blue-400' : ''}`}
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        {open ? (
          <input autoFocus type="text"
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="Type to search account"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : (
          <span className={`flex-1 text-sm truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
            {selected ? `${selected.code} – ${selected.name}` : placeholder}
          </span>
        )}
        <svg className="w-4 h-4 text-gray-400 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">No accounts found</div>
          ) : (
            filtered.map((ba) => (
              <div key={ba.id}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex flex-col"
                onMouseDown={() => select(String(ba.id))}>
                <span className="font-medium text-gray-800">{ba.code} – {ba.name}</span>
                {ba.bank_name && <span className="text-xs text-gray-400">{ba.bank_name}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function OtherPaymentForm({ record, onClose, onSaved }: Props) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});

  const [contactName, setContactName]   = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [number, setNumber]             = useState('');
  const [date, setDate]                 = useState(today());
  const [reference, setReference]       = useState('');
  const [comments, setComments]         = useState('');
  const [lines, setLines]               = useState<PaymentLine[]>([emptyLine()]);

  const isEdit = !!record;
  const status = record?.status ?? 'draft';

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [bas, accs] = await Promise.all([getBankAccountsLookup(), getAccountsLookup()]);
        setBankAccounts(bas);
        setAccounts(accs);

        if (record) {
          const full = await getOtherPayment(record.id);
          setContactName(full.contact_name);
          setBankAccountId(String(full.bank_account_id));
          setNumber(full.number);
          setDate(full.date.slice(0, 10));
          setReference(full.reference ?? '');
          setComments(full.comments ?? '');

          const insts = full.instruments ?? [];
          const adjs  = full.adjustments ?? [];
          if (insts.length > 0) {
            setLines(insts.map((ins, i) => ({
              mode:       ins.payment_mode as string,
              accountId:  adjs[i] ? String(adjs[i].account_id) : '',
              documentNo: ins.instrument_no ?? '',
              amount:     String(ins.amount ?? ''),
            })));
          } else {
            setLines([emptyLine()]);
          }
        } else {
          const num = await getNextOPNumber();
          setNumber(num);
        }
      } finally { setLoading(false); }
    }
    init();
  }, []);

  async function refreshNumber() {
    try { setNumber(await getNextOPNumber()); } catch { /* ignore */ }
  }

  function setLine(i: number, patch: Partial<PaymentLine>) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine() { setLines((prev) => [...prev, emptyLine()]); }
  function removeLine(i: number) {
    setLines((prev) => prev.length === 1 ? [emptyLine()] : prev.filter((_, idx) => idx !== i));
  }

  function validate() {
    const e: Record<string, string> = {};
    const contactErr = validateName(contactName, 'Other Contact'); if (contactErr) e.contactName = contactErr;
    if (!bankAccountId)      e.bankAccountId = 'Required';
    if (!date)               e.date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(addNew = false) {
    if (!validate()) return;
    setSaving(true);
    try {
      const validLines = lines.filter((l) => l.mode && parseFloat(l.amount) > 0);
      const payload: OTFormData = {
        date,
        contact_name: contactName.trim(),
        reference,
        bank_account_id: bankAccountId,
        comments,
        instruments: validLines.map((l) => ({
          payment_mode:    l.mode as PaymentMode,
          bank_name:       '',
          instrument_no:   l.documentNo,
          instrument_date: '',
          amount:          parseFloat(l.amount) || 0,
        })),
        adjustments: validLines.filter((l) => l.accountId).map((l) => ({
          account_id:  Number(l.accountId),
          description: l.documentNo,
          amount:      parseFloat(l.amount) || 0,
        })),
      };

      if (isEdit && record) {
        await updateOtherPayment(record.id, payload);
      } else {
        await createOtherPayment(payload);
      }
      onSaved(addNew);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="w-full flex flex-col">
        <div className="bg-white rounded p-8">
          <svg className="h-8 w-8 animate-spin text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-white">

        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">
            Other Payments{number ? ` - [${number}]` : ''}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-500 tracking-widest uppercase">{status}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Row 1: Other Contact | Account | Number */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Other Contact <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Type to search otherContact"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  errors.contactName ? 'border-red-500' : 'border-gray-300'
                }`}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              {errors.contactName && <p className="text-xs text-red-500 mt-0.5">{errors.contactName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account <span className="text-red-500">*</span>
              </label>
              <BankAccountSearch
                bankAccounts={bankAccounts}
                value={bankAccountId}
                onChange={setBankAccountId}
                placeholder="Type to search account"
                hasError={!!errors.bankAccountId}
              />
              {errors.bankAccountId && <p className="text-xs text-red-500 mt-0.5">{errors.bankAccountId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <button className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-l border border-green-500 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <input
                  type="text"
                  className="flex-1 border-t border-b border-gray-300 px-3 py-2 text-sm focus:outline-none text-center"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <button
                  onClick={refreshNumber}
                  className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-r border border-green-500"
                  title="Refresh number"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Date | Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                placeholder="Reference"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Lines Table */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 w-48">Payment Mode</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Account</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 w-40">Document No.</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-700 w-32">Amount</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {/* Payment Mode */}
                    <td className="px-3 py-1.5">
                      <select
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
                        value={line.mode}
                        onChange={(e) => setLine(i, { mode: e.target.value })}
                      >
                        <option value="cash">Cash</option>
                        <option value="cheque">Cheque</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </td>
                    {/* Account (COA) */}
                    <td className="px-3 py-1.5">
                      <select
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
                        value={line.accountId}
                        onChange={(e) => setLine(i, { accountId: e.target.value })}
                      >
                        <option value="">— Select account —</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={String(acc.id)}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Document No. */}
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        placeholder="Document No."
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
                        value={line.documentNo}
                        onChange={(e) => setLine(i, { documentNo: e.target.value })}
                      />
                    </td>
                    {/* Amount */}
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none"
                        value={line.amount}
                        onChange={(e) => setLine(i, { amount: e.target.value })}
                        placeholder="0"
                      />
                    </td>
                    {/* Action */}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button className="text-green-600 hover:text-green-800 font-bold text-lg leading-none" title="Confirm">✓</button>
                        <button
                          onClick={() => removeLine(i)}
                          className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                          title="Remove"
                        >×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={addLine}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            + Add Line
          </button>

          {/* Account Adjustments checkbox */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="acctAdj" className="w-4 h-4 accent-blue-600" />
            <label htmlFor="acctAdj" className="text-sm font-medium text-gray-700">
              Account Adjustments (Optional)
            </label>
            <span className="text-sm text-blue-400 italic">(e.g. WHT, Rebate, etc)</span>
          </div>

          {/* Comments + Total Amount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <textarea
                placeholder="Comments"
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-start pt-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (PKR)</label>
              <input
                type="text"
                readOnly
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-right bg-gray-50 font-semibold"
                value={total.toFixed(2)}
              />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Attachments</p>
            <div className="border-2 border-dashed border-gray-300 rounded px-4 py-6 text-center">
              <p className="text-sm text-gray-400 mb-2">Drag & drop files here, or</p>
              <button className="text-sm font-medium text-blue-600 border border-blue-400 rounded px-3 py-1 hover:bg-blue-50">
                BROWSE FILES
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-l disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-2 py-2 rounded-r border-l border-blue-700 disabled:opacity-50"
            >
              ▼
            </button>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded"
          >
            × CLOSE
          </button>
        </div>
    </div>
  );
}
