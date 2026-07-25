import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { Account } from '../types/account';
import type { BankAccount } from '../types/bankAccount';
import type { Expense, ExpenseLine } from '../types/expense';
import { getAccountsLookup } from '../api/accounts';
import { getBankAccountsLookup } from '../api/bankAccounts';
import type { Vendor } from '../types/vendor';
import { getVendors } from '../api/vendors';
import { createExpense, updateExpense } from '../api/expenses';

interface Props {
  expense: Expense | null;
  onClose: () => void;
  onSaved: (exp: Expense, continueEdit: boolean) => void;
}

function emptyLine(): ExpenseLine {
  return { account_id: '', description: '', amount: '' };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const fmt = (n: number) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpenseForm({ expense, onClose, onSaved }: Props) {
  const isEdit = expense !== null;

  const [date,          setDate]          = useState(isEdit ? expense.date.slice(0, 10) : today());
  const [reference,     setReference]     = useState(isEdit ? (expense.reference ?? '') : '');
  const [vendorId,      setVendorId]      = useState(isEdit ? String(expense.vendor_id ?? '') : '');
  const [bankAccountId, setBankAccountId] = useState(isEdit ? String(expense.bank_account_id) : '');
  const [comments,      setComments]      = useState(isEdit ? (expense.comments ?? '') : '');
  const [lines,         setLines]         = useState<ExpenseLine[]>(
    isEdit && expense.lines?.length ? expense.lines : [emptyLine()]
  );
  const [nextNumber, setNextNumber] = useState('');
  const [accounts,      setAccounts]      = useState<Account[]>([]);
  const [bankAccounts,  setBankAccounts]  = useState<BankAccount[]>([]);
  const [vendors,       setVendors]       = useState<Vendor[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [payFromErr,    setPayFromErr]    = useState(false);

  useEffect(() => {
    getAccountsLookup().then(setAccounts).catch(() => {});
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
    getVendors({}).then((res) => setVendors(res.data)).catch(() => {});
    if (!isEdit) {
      apiFetch('/api/expenses/next-number')
        .then(r => r.json())
        .then((d: { number: string }) => setNextNumber(d.number))
        .catch(() => {});
    }
  }, [isEdit]);

  const expenseAccounts = accounts.filter((a) =>
    ['expense', 'asset', 'contra_revenue'].includes(a.account_type)
  );

  function updateLine<K extends keyof ExpenseLine>(idx: number, key: K, val: ExpenseLine[K]) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  }
  function addLine()             { setLines((prev) => [...prev, emptyLine()]); }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)); }

  const grossTotal = lines.reduce((s, l) => s + (parseFloat(String(l.amount)) || 0), 0);

  async function handleSave(continueEdit = false) {
    if (!bankAccountId) { setPayFromErr(true); setError('Pay From is required'); return; }
    if (!date)          { setError('Date is required'); return; }
    const validLines = lines.filter((l) => l.account_id && (parseFloat(String(l.amount)) || 0) > 0);
    if (!validLines.length) { setError('At least one expense line with account and amount is required'); return; }

    setSaving(true); setError('');
    try {
      const payload = {
        date,
        reference: reference.trim(),
        vendor_id: vendorId,
        bank_account_id: bankAccountId,
        comments: comments.trim(),
        lines: validLines.map((l) => ({
          ...l,
          account_id: Number(l.account_id),
          amount: parseFloat(String(l.amount)) || 0,
        })),
      };
      const saved = isEdit
        ? await updateExpense(expense.id, payload)
        : await createExpense(payload);
      onSaved(saved, continueEdit);
      if (!continueEdit) onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  function refreshNextNumber() {
    if (isEdit) return;
    apiFetch('/api/expenses/next-number')
      .then(r => r.json())
      .then((d: { number: string }) => setNextNumber(d.number))
      .catch(() => {});
  }

  const displayNumber = isEdit ? expense.number : (nextNumber || '—');
  const statusLabel   = isEdit ? expense.status.toUpperCase() : 'DRAFT';

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Expenses - [{isEdit ? expense.number : ''}]
          </h2>
          <span className="text-sm font-bold text-gray-500 tracking-widest">{statusLabel}</span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Row 1: Pay From | Number | Date | Contact */}
          <div className="grid grid-cols-4 gap-4">
            {/* Pay From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pay From <span className="text-red-500">*</span>
              </label>
              <select
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${payFromErr ? 'border-red-500' : 'border-gray-300'}`}
                value={bankAccountId}
                onChange={(e) => { setBankAccountId(e.target.value); setPayFromErr(false); setError(''); }}>
                <option value="">Type to search account</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>{ba.name}</option>
                ))}
              </select>
            </div>

            {/* Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button type="button"
                  className="h-9 px-2.5 bg-green-500 text-white rounded text-sm font-bold hover:bg-green-600 flex-shrink-0">
                  ▼
                </button>
                <input type="text" disabled value={displayNumber}
                  className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm bg-gray-50 text-gray-700 min-w-0" />
                <button type="button" onClick={refreshNextNumber}
                  className="h-9 w-9 flex items-center justify-center bg-green-500 text-white rounded hover:bg-green-600 flex-shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 min-w-0" />
                <button type="button" onClick={() => setDate('')}
                  className="h-9 w-7 flex items-center justify-center text-gray-500 hover:text-red-500 text-lg leading-none flex-shrink-0">
                  ×
                </button>
                <button type="button" className="h-9 w-9 flex items-center justify-center border border-gray-300 rounded text-gray-500 hover:bg-gray-50 flex-shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}>
                <option value="">Type to search contact</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.print_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference */}
          <div className="w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
            <input type="text" placeholder="Reference" value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Expense Account</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700 w-36">Amount</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-700 w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <select
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={line.account_id}
                        onChange={(e) => updateLine(idx, 'account_id', e.target.value === '' ? '' : Number(e.target.value))}>
                        <option value="">Type to search account</option>
                        {expenseAccounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" placeholder="Description"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={line.description}
                        onChange={(e) => updateLine(idx, 'description', e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" placeholder="0"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={line.amount}
                        onChange={(e) => updateLine(idx, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={addLine}
                          className="text-green-600 hover:text-green-800 font-bold text-lg leading-none" title="Add line">
                          ✓
                        </button>
                        <button type="button"
                          onClick={() => lines.length > 1 ? removeLine(idx) : setLines([emptyLine()])}
                          className="text-red-400 hover:text-red-600 font-bold text-lg leading-none" title="Remove line">
                          ✗
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comments + Totals */}
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <textarea rows={4} placeholder="Comments" value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none" />
            </div>
            <div className="text-sm pt-1">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Gross</span>
                <span className="font-mono text-gray-800">{fmt(grossTotal)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Tax</span>
                <span className="font-mono text-gray-800">{fmt(0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-semibold text-gray-700">Net (PKR)</span>
                <span className="font-mono font-bold text-gray-900">{fmt(grossTotal)}</span>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Attachments</p>
            <div className="rounded border-2 border-dashed border-gray-300 px-6 py-8 flex items-center justify-center gap-4 text-sm text-gray-500">
              Drop files here or
              <button type="button"
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-1.5 rounded text-sm">
                BROWSE FILES
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button type="button" onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded disabled:opacity-60">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {saving ? 'Saving…' : 'SAVE AND CONTINUE EDIT'}
          </button>
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
            <span className="text-base leading-none">×</span>
            CLOSE
          </button>
        </div>
    </div>
  );
}

