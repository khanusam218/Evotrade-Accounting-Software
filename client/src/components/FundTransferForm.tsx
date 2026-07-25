import { useEffect, useRef, useState } from 'react';
import type { BankAccount } from '../types/bankAccount';
import type { FundTransfer, FundTransferFormData } from '../types/fundTransfer';
import { getBankAccountsLookup } from '../api/bankAccounts';
import { createFundTransfer, getNextFTNumber, updateFundTransfer } from '../api/fundTransfers';

interface Props {
  transfer: FundTransfer | null;
  onClose: () => void;
  onSaved: () => void;
}

function today() { return new Date().toISOString().slice(0, 10); }

function AccountSearch({
  accounts, value, onChange, placeholder, hasError, exclude,
}: {
  accounts: BankAccount[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  hasError: boolean;
  exclude?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const selected          = accounts.find((a) => String(a.id) === value);

  const filtered = accounts.filter((a) => {
    if (exclude && String(a.id) === exclude) return false;
    const q = query.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      (a.bank_name ?? '').toLowerCase().includes(q)
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
        } ${open ? 'ring-1 ring-green-400 border-green-400' : ''}`}
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
          ) : filtered.map((a) => (
            <button key={a.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
              onClick={() => select(String(a.id))}>
              <span>{a.name}</span>
              <span className="text-xs text-gray-400 ml-2">{a.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FundTransferForm({ transfer, onClose, onSaved }: Props) {
  const isEdit = transfer !== null;
  const status = isEdit ? transfer.status : 'draft';

  const [number,       setNumber]       = useState(isEdit ? transfer.number : '');
  const [date,         setDate]         = useState(isEdit ? transfer.date.slice(0, 10) : today());
  const [reference,    setReference]    = useState(isEdit ? (transfer.reference ?? '') : '');
  const [fromAccountId, setFromId]      = useState(isEdit ? String(transfer.from_bank_account_id) : '');
  const [toAccountId,   setToId]        = useState(isEdit ? String(transfer.to_bank_account_id) : '');
  const [amount,       setAmount]       = useState(isEdit ? String(transfer.amount) : '');
  const [comments,     setComments]     = useState(isEdit ? (transfer.comments ?? '') : '');
  const [attachments,  setAttachments]  = useState<File[]>([]);
  const [dragOver,     setDragOver]     = useState(false);

  const [bankAccounts,   setBankAccounts]   = useState<BankAccount[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [numberLoading,  setNumberLoading]  = useState(!isEdit);
  const [showSaveMenu,   setShowSaveMenu]   = useState(false);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const saveMenuRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) return;
    getNextFTNumber()
      .then((n) => { setNumber(n); setNumberLoading(false); })
      .catch(() => setNumberLoading(false));
  }, [isEdit]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node))
        setShowSaveMenu(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    if (!date)          e.date   = 'Date is required';
    if (!fromAccountId) e.from   = 'From account is required';
    if (!toAccountId)   e.to     = 'To account is required';
    if (fromAccountId && toAccountId && fromAccountId === toAccountId)
      e.to = 'From and To accounts must be different';
    if (!amount || parseFloat(amount) <= 0) e.amount = 'Amount must be greater than zero';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!validate()) return;
    const payload: FundTransferFormData = {
      date, reference: reference.trim(), comments: comments.trim(),
      from_bank_account_id: fromAccountId,
      to_bank_account_id:   toAccountId,
      amount,
    };
    setSaving(true);
    try {
      if (isEdit) await updateFundTransfer(transfer.id, payload);
      else        await createFundTransfer(payload);
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  function refreshNumber() {
    if (isEdit) return;
    setNumberLoading(true);
    getNextFTNumber().then(setNumber).finally(() => setNumberLoading(false));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  }

  const STATUS_LABEL: Record<string, string> = {
    draft: 'DRAFT', posted: 'POSTED', cancelled: 'CANCELLED',
  };

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title bar — white bg, no × button (matches Splendid) */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            Funds Transfer - [{isEdit ? transfer.number : (numberLoading ? '…' : number)}]
          </h2>
          <span className="text-sm font-bold text-gray-500 tracking-wider">
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">

          {/* Row 1: Number | Date | Reference */}
          <div className="grid grid-cols-3 gap-4">

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
                  <button type="button" onClick={refreshNumber}
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
                  onChange={(e) => { setDate(e.target.value); setErrors(p => ({ ...p, date: '' })); }} />
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

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>

          {/* From Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Account <span className="text-red-500">*</span>
            </label>
            <AccountSearch
              accounts={bankAccounts} value={fromAccountId}
              onChange={(id) => { setFromId(id); setErrors(p => ({ ...p, from: '', to: '' })); }}
              placeholder="Type to search account" hasError={!!errors.from} />
            {errors.from && <p className="mt-1 text-xs text-red-600">{errors.from}</p>}
          </div>

          {/* To Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Account <span className="text-red-500">*</span>
            </label>
            <AccountSearch
              accounts={bankAccounts} value={toAccountId}
              onChange={(id) => { setToId(id); setErrors(p => ({ ...p, to: '' })); }}
              placeholder="Type to search account" hasError={!!errors.to}
              exclude={fromAccountId} />
            {errors.to && <p className="mt-1 text-xs text-red-600">{errors.to}</p>}
          </div>

          {/* Amount (PKR) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (PKR) <span className="text-red-500">*</span>
            </label>
            <input type="number" step="0.01" min="0.01"
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: '' })); }} />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea rows={4}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)} />
          </div>

          {/* Attachments — dashed + BROWSE FILES (matches Splendid) */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Attachments</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex items-center justify-center gap-4 border-2 border-dashed rounded-lg px-6 py-6 transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'
              }`}>
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
          {/* SAVE AND NEW gray split */}
          <div className="relative flex items-stretch rounded overflow-hidden border border-gray-300" ref={saveMenuRef}>
            <button type="button" onClick={handleSave} disabled={saving}
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

          {/* × CLOSE yellow */}
          <button type="button" onClick={onClose} disabled={saving}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded disabled:opacity-60">
            <span className="text-base leading-none">×</span>
            CLOSE
          </button>
        </div>

    </div>
  );
}
