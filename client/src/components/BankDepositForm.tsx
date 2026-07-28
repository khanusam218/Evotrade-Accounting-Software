import { useEffect, useRef, useState } from 'react';
import type { Account } from '../types/account';
import type { BankAccount } from '../types/bankAccount';
import type { BankDeposit, BankDepositLine, BDFormData } from '../types/bankDeposit';
import { getBankAccountsLookup } from '../api/bankAccounts';
import { getAccountsLookup } from '../api/accounts';
import { createBankDeposit, getBankDeposit, getNextBDNumber, updateBankDeposit } from '../api/bankDeposits';

interface Props {
  deposit: BankDeposit | null;
  onClose: () => void;
  onSaved: () => void;
}

const PAYMENT_MODES = [
  { value: 'cash',            label: 'Cash' },
  { value: 'cheque',          label: 'Cheque' },
  { value: 'online_transfer', label: 'Online Transfer' },
  { value: 'demand_draft',    label: 'Demand Draft' },
  { value: 'pay_order',       label: 'Pay Order' },
];

function today() { return new Date().toISOString().slice(0, 10); }

function emptyLine(): BankDepositLine {
  return {
    line_date: today(), received_from: '', payment_mode: '',
    bank_name: '', branch_code: '', branch_name: '',
    instrument_no: '', description: '', amount: '',
  };
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT', deposited: 'DEPOSITED', cleared: 'CLEARED', cancelled: 'CANCELLED',
};

export default function BankDepositForm({ deposit, onClose, onSaved }: Props) {
  const isEdit = deposit !== null;
  const status = isEdit ? deposit.status : 'draft';

  const [bankAccountId, setBankAccountId] = useState(isEdit ? String(deposit.bank_account_id) : '');
  const [number, setNumber]               = useState(isEdit ? deposit.number : '');
  const [date, setDate]                   = useState(isEdit ? deposit.date.slice(0, 10) : today());
  const [depositNo, setDepositNo]         = useState(isEdit ? (deposit.deposit_no ?? '') : '');
  const [comments, setComments]           = useState(isEdit ? (deposit.comments ?? '') : '');
  const [lines, setLines]                 = useState<BankDepositLine[]>([emptyLine()]);
  const [selectedSet, setSelectedSet]     = useState<Set<number>>(new Set());

  // Account (inline add-line form)
  const [addAccountId, setAddAccountId]       = useState('');
  const [addDescription, setAddDescription]   = useState('');
  const [addAmount, setAddAmount]             = useState('');

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [coaList, setCoaList]           = useState<Account[]>([]);

  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [loading, setLoading]             = useState(isEdit);
  const [numberLoading, setNumberLoading] = useState(!isEdit);
  const [attachments, setAttachments]     = useState<File[]>([]);
  const [dragOver, setDragOver]           = useState(false);
  const [showSaveMenu, setShowSaveMenu]   = useState(false);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const saveMenuRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
    getAccountsLookup().then(setCoaList).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) return;
    getNextBDNumber()
      .then((n) => { setNumber(n); setNumberLoading(false); })
      .catch(() => setNumberLoading(false));
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    getBankDeposit(deposit.id).then((full) => {
      setLines(full.lines?.length ? full.lines : [emptyLine()]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isEdit, deposit]);

  function updLine<K extends keyof BankDepositLine>(i: number, k: K, v: BankDepositLine[K]) {
    setLines((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  }

  function deleteLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
    setSelectedSet((s) => { const n = new Set(s); n.delete(i); return n; });
  }

  function toggleSelect(i: number) {
    setSelectedSet((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function toggleAll() {
    setSelectedSet(selectedSet.size === lines.length ? new Set() : new Set(lines.map((_, i) => i)));
  }

  function handleAddLine() {
    const amt = parseFloat(addAmount);
    if (!amt || amt <= 0) return;
    const acct = coaList.find((a) => String(a.id) === addAccountId);
    const selectedBank = bankAccounts.find((ba) => String(ba.id) === bankAccountId);
    setLines((p) => [...p, {
      ...emptyLine(),
      received_from: acct ? `${acct.code} — ${acct.name}` : '',
      account_id: acct ? acct.id : null,
      description: addDescription,
      amount: amt,
      bank_name: selectedBank?.bank_name ?? '',
      branch_name: selectedBank?.branch_name ?? '',
    }]);
    setAddAccountId('');
    setAddDescription('');
    setAddAmount('');
  }

  const totalSelected = [...selectedSet].reduce((s, i) => s + (parseFloat(String(lines[i]?.amount)) || 0), 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!date)          e.date = 'Date is required';
    if (!bankAccountId) e.bank = 'Bank account is required';
    const valid = lines.filter((l) => (parseFloat(String(l.amount)) || 0) > 0);
    if (!valid.length)  e.lines = 'At least one line with amount is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: BDFormData = {
        date, bank_account_id: bankAccountId,
        deposit_no: depositNo, comments,
        lines: lines
          .filter((l) => (parseFloat(String(l.amount)) || 0) > 0)
          .map((l) => ({ ...l, amount: parseFloat(String(l.amount)) })),
      };
      if (isEdit) await updateBankDeposit(deposit.id, payload);
      else        await createBankDeposit(payload);
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  const cellInp = 'w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300';

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title bar — white bg, no × (matches Splendid) */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            Bank Deposits - [{isEdit ? deposit.number : (numberLoading ? '…' : number)}]
          </h2>
          <span className="text-sm font-bold text-gray-500 tracking-wider">{STATUS_LABEL[status]}</span>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Row 1: Bank Account | Number | Date | Deposit Number */}
          <div className="grid grid-cols-4 gap-4">

            {/* Bank Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Account: <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  errors.bank ? 'border-red-500' : 'border-gray-300'
                }`}
                value={bankAccountId}
                onChange={(e) => { setBankAccountId(e.target.value); setErrors((p) => ({ ...p, bank: '' })); }}>
                <option value="">-Choose-</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>{ba.name}</option>
                ))}
              </select>
              {errors.bank && <p className="mt-1 text-xs text-red-600">{errors.bank}</p>}
              {(() => {
                const selected = bankAccounts.find((ba) => String(ba.id) === bankAccountId);
                if (!selected) return null;
                const parts = [selected.bank_name, selected.branch_name, selected.account_number].filter(Boolean);
                return parts.length ? (
                  <p className="mt-1 text-xs text-gray-500">{parts.join(' · ')}</p>
                ) : null;
              })()}
            </div>

            {/* Number — green ▼ + input + green refresh */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button type="button"
                  className="h-9 px-2.5 bg-green-500 text-white rounded text-sm font-bold hover:bg-green-600 flex-shrink-0">
                  ▼
                </button>
                <input type="text" readOnly={isEdit}
                  className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-gray-700 min-w-0 focus:outline-none"
                  value={numberLoading ? 'Loading…' : number}
                  onChange={(e) => !isEdit && setNumber(e.target.value)} />
                {!isEdit && (
                  <button type="button"
                    onClick={() => { setNumberLoading(true); getNextBDNumber().then(setNumber).finally(() => setNumberLoading(false)); }}
                    className="h-9 w-9 flex items-center justify-center bg-green-500 text-white rounded hover:bg-green-600 flex-shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Date — with × clear + calendar icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <input type="date"
                  className={`flex-1 border rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 min-w-0 ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }} />
                <button type="button" onClick={() => setDate('')}
                  className="h-9 w-7 flex items-center justify-center text-gray-500 hover:text-red-500 text-lg leading-none flex-shrink-0">
                  ×
                </button>
                <button type="button"
                  className="h-9 w-9 flex items-center justify-center border border-gray-300 rounded text-gray-500 hover:bg-gray-50 flex-shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
            </div>

            {/* Deposit Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Number</label>
              <input type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Deposit Number"
                value={depositNo}
                onChange={(e) => setDepositNo(e.target.value)} />
            </div>
          </div>

          {/* Received From table */}
          {errors.lines && <p className="text-xs text-red-600">{errors.lines}</p>}
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full text-xs">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2.5 w-8">
                    <input type="checkbox"
                      className="w-4 h-4"
                      checked={lines.length > 0 && selectedSet.size === lines.length}
                      onChange={toggleAll} />
                  </th>
                  {['Date','Received From','Payment Mode','Bank Name','Branch Code','Branch Name','Instrument No.','Description','Amount'].map((h) => (
                    <th key={h} className="px-2 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-2 py-2.5 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
                ) : lines.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-4 text-orange-500">No record found</td></tr>
                ) : (
                  lines.map((ln, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" className="w-4 h-4"
                          checked={selectedSet.has(i)} onChange={() => toggleSelect(i)} />
                      </td>
                      <td className="px-1 py-1 min-w-[110px]">
                        <input type="date" className={cellInp} value={ln.line_date ?? ''}
                          onChange={(e) => updLine(i, 'line_date', e.target.value)} />
                      </td>
                      <td className="px-1 py-1 min-w-[120px]">
                        <input type="text" className={cellInp} placeholder="Received From" value={ln.received_from ?? ''}
                          onChange={(e) => updLine(i, 'received_from', e.target.value)} />
                      </td>
                      <td className="px-1 py-1 min-w-[120px]">
                        <select className={cellInp} value={ln.payment_mode ?? ''}
                          onChange={(e) => updLine(i, 'payment_mode', e.target.value)}>
                          <option value="">—</option>
                          {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1 min-w-[110px]">
                        <input type="text" className={cellInp} placeholder="Bank Name" value={ln.bank_name ?? ''}
                          onChange={(e) => updLine(i, 'bank_name', e.target.value)} />
                      </td>
                      <td className="px-1 py-1 min-w-[90px]">
                        <input type="text" className={cellInp} placeholder="Branch Code" value={ln.branch_code ?? ''}
                          onChange={(e) => updLine(i, 'branch_code', e.target.value)} />
                      </td>
                      <td className="px-1 py-1 min-w-[110px]">
                        <input type="text" className={cellInp} placeholder="Branch Name" value={ln.branch_name ?? ''}
                          onChange={(e) => updLine(i, 'branch_name', e.target.value)} />
                      </td>
                      <td className="px-1 py-1 min-w-[100px]">
                        <input type="text" className={cellInp} placeholder="Instrument No." value={ln.instrument_no ?? ''}
                          onChange={(e) => updLine(i, 'instrument_no', e.target.value)} />
                      </td>
                      <td className="px-1 py-1 min-w-[140px]">
                        <input type="text" className={cellInp} placeholder="Description" value={ln.description ?? ''}
                          onChange={(e) => updLine(i, 'description', e.target.value)} />
                      </td>
                      <td className="px-1 py-1 min-w-[90px]">
                        <input type="number" step="0.01" min="0" className={`${cellInp} text-right`}
                          placeholder="0.00" value={ln.amount}
                          onChange={(e) => updLine(i, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button type="button" onClick={() => deleteLine(i)}
                          className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Account inline add-line form */}
          <div className="flex gap-3 items-end border-t border-gray-100 pt-3">
            <div className="flex-[2] min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
              <select
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                value={addAccountId}
                onChange={(e) => setAddAccountId(e.target.value)}>
                <option value="">-Choose-</option>
                {coaList.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-[3] min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input type="text"
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
              <input type="number" step="0.01" min="0"
                className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-300"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)} />
            </div>
            <div className="flex gap-1 pb-0.5">
              <button type="button" onClick={handleAddLine}
                className="w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded hover:bg-green-600 text-base">
                ✓
              </button>
              <button type="button" onClick={() => { setAddAccountId(''); setAddDescription(''); setAddAmount(''); }}
                className="w-8 h-8 flex items-center justify-center border border-gray-300 text-gray-500 rounded hover:bg-gray-50 text-base">
                ×
              </button>
            </div>
          </div>

          {/* Comments + Total Selected */}
          <div className="flex gap-6 items-start">
            <div className="flex-1">
              <textarea rows={4}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="Comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)} />
            </div>
            <div className="text-right pt-2 min-w-[160px]">
              <p className="text-sm text-gray-600 leading-tight">
                Total Selected<br />(PKR)
              </p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {totalSelected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Attachments — dashed + BROWSE FILES (matches Splendid) */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Attachments</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
              className={`flex items-center justify-center gap-4 border-2 border-dashed rounded-lg px-6 py-6 transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}`}>
              {attachments.length > 0 ? (
                <span className="text-sm text-gray-600">{attachments.map(f => f.name).join(', ')}</span>
              ) : (
                <>
                  <span className="text-sm text-gray-400">Drop files here or</span>
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded">
                    BROWSE FILES
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => setAttachments(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                </>
              )}
            </div>
          </div>

        </div>

        {/* Footer — gray SAVE AND NEW split + yellow × CLOSE (matches Splendid) */}
        <div className="flex items-center justify-end border-t border-gray-200 bg-white px-6 py-4 rounded-b gap-3">
          <div className="relative flex items-stretch rounded overflow-hidden border border-gray-300" ref={saveMenuRef}>
            <button type="button" onClick={handleSave} disabled={saving || loading}
              className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <div className="w-px bg-gray-300" />
            <button type="button" disabled={saving}
              onClick={() => setShowSaveMenu(s => !s)}
              className="flex items-center px-2 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSaveMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-max">
                <button type="button" onClick={() => { handleSave(); setShowSaveMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Save and Close
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded disabled:opacity-60">
            <span className="text-base leading-none">×</span>
            CLOSE
          </button>
        </div>

    </div>
  );
}
