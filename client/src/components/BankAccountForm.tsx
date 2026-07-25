import { useEffect, useRef, useState } from 'react';
import type { Account } from '../types/account';
import type { BankAccount, BankAccountFormData, AccountGroup } from '../types/bankAccount';
import { getAccountsLookup } from '../api/accounts';
import { createBankAccount, updateBankAccount } from '../api/bankAccounts';

interface Props {
  account: BankAccount | null;
  onClose: () => void;
  onSaved: (account: BankAccount, addNew: boolean) => void;
}

const EMPTY: BankAccountFormData = {
  code: '', name: '', description: '', parent_id: '',
  bank_name: '', branch_name: '', account_number: '', account_holder: '',
  account_group: 'transactional', is_credit_card: false, is_active: true,
};

function toFormData(a: BankAccount): BankAccountFormData {
  return {
    code: a.code, name: a.name,
    description: a.description ?? '',
    parent_id: a.parent_id ? String(a.parent_id) : '',
    bank_name: a.bank_name,
    branch_name: a.branch_name ?? '',
    account_number: a.account_number ?? '',
    account_holder: a.account_holder ?? '',
    account_group: a.account_group,
    is_credit_card: a.is_credit_card,
    is_active: a.is_active,
  };
}

export default function BankAccountForm({ account, onClose, onSaved }: Props) {
  const isEdit = account !== null;

  const [form, setForm]       = useState<BankAccountFormData>(isEdit ? toFormData(account) : EMPTY);
  const [coaList, setCoaList] = useState<Account[]>([]);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Partial<Record<keyof BankAccountFormData, string>>>({});
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAccountsLookup().then(setCoaList).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function set<K extends keyof BankAccountFormData>(k: K, v: BankAccountFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function suggestCode() {
    if (!form.parent_id) return;
    const parent = coaList.find((a) => String(a.id) === form.parent_id);
    if (!parent) return;
    const prefix = parent.code + '-';
    const siblings = coaList.filter((a) => a.code.startsWith(prefix));
    let maxNum = 0;
    siblings.forEach((a) => {
      const n = parseInt(a.code.slice(prefix.length), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });
    set('code', `${parent.code}-${String(maxNum + 1).padStart(5, '0')}`);
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.parent_id)        e.parent_id     = 'Parent account is required';
    if (!form.code.trim())      e.code          = 'Account code is required';
    if (!form.name.trim())      e.name          = 'Account name is required';
    if (!form.bank_name.trim()) e.bank_name     = 'Bank name is required';
    if (!form.branch_name.trim()) e.branch_name = 'Branch name is required';
    if (!form.account_holder.trim()) e.account_holder = 'Bank account title is required';
    if (!form.account_number.trim()) e.account_number = 'Bank account number is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave(addNew: boolean) {
    if (!validate()) return;
    setSaving(true);
    setShowSaveMenu(false);
    try {
      const saved = isEdit
        ? await updateBankAccount(account.id, form)
        : await createBankAccount(form);
      onSaved(saved, addNew);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  // Asset accounts for parent (credit card = liability parent)
  const targetType = form.is_credit_card ? 'liability' : 'asset';
  const parentOptions = coaList.filter((a) => a.account_type === targetType);

  const inp = (hasErr: boolean) =>
    `w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
      hasErr ? 'border-red-400' : 'border-gray-300'
    }`;

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title bar */}
        <div className="flex items-center justify-between bg-white border-b border-gray-200 px-5 py-3 rounded-t">
          <h2 className="text-base font-bold text-gray-900">
            Accounts - [{isEdit ? account.code : ''}]
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Row 1: Parent Account | Account Group */}
          <div className="grid grid-cols-2 gap-6">
            {/* Parent Account */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Parent Account <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1">
                <select
                  className={`flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-400 ${
                    errors.parent_id ? 'border-red-400' : form.parent_id ? 'border-green-400' : 'border-gray-300'
                  }`}
                  value={form.parent_id}
                  onChange={(e) => set('parent_id', e.target.value)}
                >
                  <option value="">— Select Parent —</option>
                  {parentOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                {form.parent_id && (
                  <button type="button" onClick={() => set('parent_id', '')}
                    className="px-2 border border-gray-300 rounded text-gray-400 hover:text-gray-700 text-sm">
                    ×
                  </button>
                )}
              </div>
              {errors.parent_id && <p className="mt-1 text-xs text-red-600">{errors.parent_id}</p>}
            </div>

            {/* Account Group */}
            <div>
              <div className="flex items-baseline gap-1.5 mb-2">
                <label className="text-xs font-medium text-gray-600">Account Group</label>
                <span className="text-xs text-orange-500">(Cannot be changed once account created.)</span>
              </div>
              <div className="flex items-center gap-6">
                {(['transactional', 'control'] as AccountGroup[]).map((g) => (
                  <label key={g}
                    className={`flex items-center gap-2 ${isEdit ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input type="radio" name="account_group" value={g}
                      checked={form.account_group === g}
                      disabled={isEdit}
                      onChange={() => set('account_group', g)}
                      className="accent-green-500 w-4 h-4" />
                    <span className="text-sm text-gray-700">
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Account Code | Account Name */}
          <div className="grid grid-cols-2 gap-6">
            {/* Account Code */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Account Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input type="text"
                  className={`flex-1 border rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                    errors.code ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="e.g. 102-00001"
                  value={form.code}
                  disabled={isEdit}
                  onChange={(e) => set('code', e.target.value)}
                />
                {!isEdit && (
                  <button type="button" onClick={suggestCode}
                    title="Auto-suggest code from parent"
                    className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
              {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input type="text"
                className={inp(!!errors.name)}
                placeholder="Account Name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-gray-200" />

          {/* Row 3: Bank Name | Branch Name */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input type="text"
                className={inp(!!errors.bank_name)}
                placeholder="Bank Name"
                value={form.bank_name}
                onChange={(e) => set('bank_name', e.target.value)}
              />
              {errors.bank_name && <p className="mt-1 text-xs text-red-600">{errors.bank_name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Branch Name <span className="text-red-500">*</span>
              </label>
              <input type="text"
                className={inp(!!errors.branch_name)}
                placeholder="Branch Name"
                value={form.branch_name}
                onChange={(e) => set('branch_name', e.target.value)}
              />
              {errors.branch_name && <p className="mt-1 text-xs text-red-600">{errors.branch_name}</p>}
            </div>
          </div>

          {/* Row 4: Bank Account Title | Bank Account Number | Credit Card checkbox */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-start">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bank Account Title <span className="text-red-500">*</span>
              </label>
              <input type="text"
                className={inp(!!errors.account_holder)}
                placeholder="Account Title"
                value={form.account_holder}
                onChange={(e) => set('account_holder', e.target.value)}
              />
              {errors.account_holder && <p className="mt-1 text-xs text-red-600">{errors.account_holder}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bank Account Number <span className="text-red-500">*</span>
              </label>
              <input type="text"
                className={inp(!!errors.account_number)}
                placeholder="Account Number"
                value={form.account_number}
                onChange={(e) => set('account_number', e.target.value)}
              />
              {errors.account_number && <p className="mt-1 text-xs text-red-600">{errors.account_number}</p>}
            </div>
            <div className="pt-6">
              <label className={`flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap ${isEdit ? 'opacity-60' : 'cursor-pointer'}`}>
                <input type="checkbox"
                  className="w-4 h-4 accent-blue-600"
                  checked={form.is_credit_card}
                  disabled={isEdit}
                  onChange={(e) => { set('is_credit_card', e.target.checked); set('parent_id', ''); }}
                />
                Use as a credit card account
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea rows={3}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="Description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Info text */}
          <p className="text-sm text-gray-700">
            To add <strong>account openings</strong>, please create a Journal Entry.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-5 py-4 rounded-b">
          {/* SAVE AND NEW gray split button — matches Splendid */}
          <div className="relative inline-flex rounded overflow-hidden border border-gray-300" ref={saveMenuRef}>
            <button type="button" disabled={saving}
              onClick={() => handleSave(!isEdit)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving…' : isEdit ? 'SAVE' : 'SAVE AND NEW'}
            </button>
            {!isEdit && (
              <>
                <div className="w-px bg-gray-300" />
                <button type="button" disabled={saving}
                  onClick={() => setShowSaveMenu((s) => !s)}
                  className="px-2 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" clipRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </button>
              </>
            )}
            {showSaveMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-max">
                <button type="button" onClick={() => handleSave(false)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Save and Close
                </button>
              </div>
            )}
          </div>

          {/* × CLOSE — yellow with dark text, matches Splendid */}
          <button type="button" onClick={onClose} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold rounded disabled:opacity-50">
            <span className="text-base font-bold leading-none">×</span>
            CLOSE
          </button>
        </div>
    </div>
  );
}
