import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import type { Account } from '../types/account';
import type { CreditNote, CNFormData } from '../types/creditNote';
import type { SalesInvoice } from '../types/salesInvoice';
import { getAccountsLookup } from '../api/accounts';
import { createCreditNote, getCreditNote, getNextCNNumber, updateCreditNote } from '../api/creditNotes';

interface Props {
  creditNote: CreditNote | null;
  onClose: () => void;
  onSaved: (addNew?: boolean) => void;
}

function today() { return new Date().toISOString().slice(0, 10); }

function AccountSearch({
  accounts,
  value,
  onChange,
  placeholder,
  hasError,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  hasError: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const selected          = accounts.find((a) => String(a.id) === value);

  const filtered = accounts.filter((a) => {
    const q = query.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
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
            filtered.map((a) => (
              <button key={a.id} type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                onClick={() => select(String(a.id))}>
                <span>{a.name}</span>
                <span className="text-xs text-gray-400 ml-2">{a.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CreditNoteForm({ creditNote, onClose, onSaved }: Props) {
  const isEdit = creditNote !== null;
  const status = isEdit ? creditNote.status : 'draft';

  const [number, setNumber]         = useState(isEdit ? creditNote.number : '');
  const [date, setDate]             = useState(isEdit ? creditNote.date.slice(0, 10) : today());
  const [contactName, setContact]   = useState(isEdit ? creditNote.contact_name : '');
  const [reference, setReference]   = useState(isEdit ? (creditNote.reference ?? '') : '');
  const [accountId, setAccountId]   = useState(isEdit ? String(creditNote.account_id) : '');
  const [amount, setAmount]         = useState(isEdit ? String(creditNote.amount) : '');
  const [comments, setComments]     = useState(isEdit ? (creditNote.comments ?? '') : '');
  const [autoSettle, setAutoSettle] = useState(isEdit ? creditNote.auto_settle : true);

  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [openInvoices, setOpenInvoices] = useState<SalesInvoice[]>([]);
  const [allocAmounts, setAllocAmounts] = useState<Record<number, string>>({});

  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [numberLoading, setNumberLoading] = useState(!isEdit);

  useEffect(() => {
    getAccountsLookup().then(setAccounts).catch(() => {});
    apiFetch('/api/sales-invoices')
      .then((r) => r.json())
      .then((data: SalesInvoice[]) => {
        setOpenInvoices(data.filter((i) => ['approved', 'partially_paid'].includes(i.status)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getCreditNote(creditNote.id).then((full) => {
      if (full.allocations?.length) {
        const amounts: Record<number, string> = {};
        for (const al of full.allocations) {
          if (al.sales_invoice_id) amounts[al.sales_invoice_id] = String(al.amount);
        }
        setAllocAmounts(amounts);
      }
    }).catch(() => {});
  }, [isEdit, creditNote]);

  useEffect(() => {
    if (isEdit) return;
    getNextCNNumber()
      .then((n) => { setNumber(n); setNumberLoading(false); })
      .catch(() => setNumberLoading(false));
  }, [isEdit]);

  const totalAmt      = parseFloat(amount) || 0;
  const totalAllocated = Object.values(allocAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const allAllocated  = openInvoices.length > 0 && openInvoices.every((inv) => parseFloat(allocAmounts[inv.id] || '0') > 0);

  function toggleAll() {
    if (allAllocated) {
      setAllocAmounts({});
    } else {
      const amounts: Record<number, string> = {};
      openInvoices.forEach((inv) => { amounts[inv.id] = String(inv.balance_amount); });
      setAllocAmounts(amounts);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!date)               e.date    = 'Date is required';
    if (!contactName.trim()) e.contact = 'Contact is required';
    if (!accountId)          e.account = 'Account is required';
    if (!amount || totalAmt <= 0) e.amount = 'Amount must be greater than zero';
    if (totalAllocated > totalAmt && totalAmt > 0) e.alloc = 'Allocations exceed credit note amount';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave(addNew = false) {
    if (!validate()) return;
    const allocations = openInvoices
      .filter((inv) => parseFloat(allocAmounts[inv.id] || '0') > 0)
      .map((inv) => ({
        sales_invoice_id: inv.id,
        invoice_ref:      inv.number,
        description:      inv.subject || '',
        amount:           parseFloat(allocAmounts[inv.id] || '0'),
      }));
    const payload: CNFormData = {
      date, contact_name: contactName.trim(), reference: reference.trim(),
      account_id: accountId, amount, comments: comments.trim(),
      auto_settle: autoSettle, allocations,
    };
    setSaving(true);
    try {
      if (isEdit) await updateCreditNote(creditNote.id, payload);
      else        await createCreditNote(payload);
      onSaved(addNew);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  const STATUS_LABEL: Record<string, string> = {
    draft: 'DRAFT', approved: 'APPROVED', cancelled: 'CANCELLED',
  };

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            Credit Notes - [{isEdit ? creditNote.number : (numberLoading ? '…' : number)}]
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-500 tracking-wider">{STATUS_LABEL[status]}</span>
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">

          {/* Row 1: Contact | Number | Date | Reference */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact <span className="text-red-500">*</span>
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
                    onClick={() => { setNumberLoading(true); getNextCNNumber().then(setNumber).finally(() => setNumberLoading(false)); }}
                    className="px-2 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm">↺</button>
                )}
              </div>
            </div>

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

          {/* Row 2: Account | Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account <span className="text-red-500">*</span>
              </label>
              <AccountSearch
                accounts={accounts}
                value={accountId}
                onChange={(id) => { setAccountId(id); setErrors((p) => ({ ...p, account: '' })); }}
                placeholder="Type to search account"
                hasError={!!errors.account}
              />
              {errors.account && <p className="mt-1 text-xs text-red-600">{errors.account}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (PKR) <span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.01" min="0.01"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Amount"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })); }} />
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="Comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)} />
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

          {/* Make auto settlements + Allocations table */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
              <input type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-green-500"
                checked={autoSettle}
                onChange={(e) => setAutoSettle(e.target.checked)} />
              <span className="text-sm font-medium text-gray-700">Make auto settlements</span>
            </label>

            {errors.alloc && <p className="mb-2 text-xs text-red-600">{errors.alloc}</p>}

            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2.5 w-10">
                      <input type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 accent-green-500"
                        checked={allAllocated}
                        onChange={toggleAll} />
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Description</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Date</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Due Date</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Total Amount</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Adjusted Amount</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Balance Amount</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Allocate</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-sm text-orange-500 bg-gray-50">
                        No record found
                      </td>
                    </tr>
                  ) : (
                    openInvoices.map((inv) => {
                      const checked = parseFloat(allocAmounts[inv.id] || '0') > 0;
                      return (
                        <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 accent-green-500"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setAllocAmounts((p) => { const n = { ...p }; delete n[inv.id]; return n; });
                                } else {
                                  setAllocAmounts((p) => ({ ...p, [inv.id]: String(inv.balance_amount) }));
                                }
                              }} />
                          </td>
                          <td className="px-3 py-2 text-gray-800">{inv.subject || inv.number}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {new Date(inv.date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-800">{fmt(inv.net_amount)}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{fmt(inv.paid_amount)}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{fmt(inv.balance_amount)}</td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" step="0.01" min="0"
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                              placeholder="0.00"
                              value={allocAmounts[inv.id] || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v || parseFloat(v) <= 0) {
                                  setAllocAmounts((p) => { const n = { ...p }; delete n[inv.id]; return n; });
                                } else {
                                  setAllocAmounts((p) => ({ ...p, [inv.id]: v }));
                                }
                              }} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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

