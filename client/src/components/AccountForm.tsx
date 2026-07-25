import { useEffect, useRef, useState } from 'react';
import type { Account, AccountFormData, AccountGroup } from '../types/account';
import { createAccount, getAccountsLookup, updateAccount } from '../api/accounts';

interface Props {
  account: Account | null;
  defaultParent?: Account | null;
  onClose: () => void;
  onSaved: (account: Account, addNew: boolean) => void;
}

const EMPTY: AccountFormData = {
  code: '', name: '', description: '',
  account_group: 'transactional',
  parent_id: '', opening_balance: 0, is_active: true,
};

function toFormData(a: Account): AccountFormData {
  return {
    code: a.code, name: a.name,
    description: a.description ?? '',
    account_group: a.account_group ?? 'transactional',
    parent_id: a.parent_id ? String(a.parent_id) : '',
    opening_balance: a.opening_balance,
    is_active: a.is_active,
  };
}

export default function AccountForm({ account, defaultParent, onClose, onSaved }: Props) {
  const isEdit = account !== null;

  const initForm = (): AccountFormData => {
    if (isEdit) return toFormData(account);
    return { ...EMPTY, parent_id: defaultParent ? String(defaultParent.id) : '' };
  };

  const [form, setForm]       = useState<AccountFormData>(initForm);
  const [lookup, setLookup]   = useState<Account[]>([]);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Partial<Record<keyof AccountFormData, string>>>({});
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAccountsLookup().then(setLookup).catch(() => {});
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

  function set<K extends keyof AccountFormData>(k: K, v: AccountFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function suggestCode() {
    if (!form.parent_id) return;
    const parent = lookup.find((a) => String(a.id) === form.parent_id);
    if (!parent) return;
    const prefix = parent.code + '-';
    const siblings = lookup.filter((a) => a.code.startsWith(prefix));
    let maxNum = 0;
    siblings.forEach((a) => {
      const suffix = a.code.slice(prefix.length);
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });
    set('code', `${parent.code}-${String(maxNum + 1).padStart(4, '0')}`);
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.parent_id) e.parent_id = 'Parent account is required';
    if (!form.code.trim()) e.code = 'Code is required';
    if (!form.name.trim()) e.name = 'Name is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave(addNew: boolean) {
    if (!validate()) return;
    setSaving(true);
    setShowSaveMenu(false);
    try {
      let saved: Account;
      if (isEdit) {
        saved = await updateAccount(account.id, form);
      } else {
        saved = await createAccount(form);
      }
      onSaved(saved, addNew);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  // Only group (control) accounts that sit under a top-level type header are
  // selectable as parents — i.e. the 110/111/.../502 sub-groups, not leaf
  // accounts or the top-level type headers. Exclude self to avoid cycles.
  const parentOptions = lookup.filter(
    (a) =>
      a.account_group === 'control' &&
      a.parent_id !== null &&
      (!isEdit || a.id !== account?.id)
  );

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title bar */}
        <div className="flex items-center justify-between bg-gray-100 border-b border-gray-200 px-5 py-3 rounded-t">
          <h2 className="text-sm font-semibold text-gray-800">
            Accounts - [{isEdit ? account.code : ''}]
          </h2>
          <button type="button" onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none font-bold">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Row 1: Parent Account (left) + Account Group (right) */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Parent Account <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  className={`w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500 appearance-none pr-8 ${
                    errors.parent_id ? 'border-red-400' : 'border-gray-300'
                  }`}
                  value={form.parent_id}
                  onChange={(e) => set('parent_id', e.target.value)}
                >
                  <option value=""></option>
                  {parentOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </span>
              </div>
              {errors.parent_id && <p className="mt-1 text-xs text-red-600">{errors.parent_id}</p>}
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs font-medium text-gray-700">Account Group</label>
                <span className="text-xs text-amber-500">(Cannot be changed once account created.)</span>
              </div>
              <div className="flex items-center gap-6 mt-2">
                {(['transactional', 'control'] as AccountGroup[]).map((g) => (
                  <label key={g} className={`flex items-center gap-2 cursor-pointer ${isEdit ? 'opacity-60' : ''}`}>
                    <input
                      type="radio"
                      name="account_group"
                      value={g}
                      checked={form.account_group === g}
                      disabled={isEdit}
                      onChange={() => set('account_group', g)}
                      className="accent-green-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{g.charAt(0).toUpperCase() + g.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Account Code (left) + Account Name (right) */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Account Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-0">
                <input
                  type="text"
                  className={`flex-1 border rounded-l px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 ${
                    errors.code ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder=""
                  value={form.code}
                  disabled={isEdit && account.is_system}
                  onChange={(e) => set('code', e.target.value)}
                />
                {!isEdit && (
                  <button
                    type="button"
                    onClick={suggestCode}
                    title="Auto-suggest code from parent"
                    className="px-3 py-2 bg-green-600 text-white rounded-r text-sm hover:bg-green-700 flex items-center"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
              {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${
                  errors.name ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="Account Name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Info note — plain text, "account openings" bold */}
          <p className="text-sm text-gray-600">
            To add <strong>account openings</strong>, please create a Journal Entry.
          </p>

          {isEdit && account.is_system && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠ This is a system account. Code cannot be changed.
            </p>
          )}
        </div>

        {/* Footer — right-aligned */}
        <div className="flex items-center justify-end border-t border-gray-200 bg-gray-50 px-5 py-3 rounded-b gap-3">
          {/* SAVE AND NEW split button */}
          <div className="relative inline-flex" ref={saveMenuRef}>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(!isEdit)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-l border-r border-green-700 hover:bg-green-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving…' : isEdit ? 'SAVE' : 'SAVE AND NEW'}
            </button>
            {!isEdit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowSaveMenu((s) => !s)}
                className="px-2 py-2 bg-green-600 text-white rounded-r hover:bg-green-700 disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {showSaveMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-max">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Save and Close
                </button>
              </div>
            )}
          </div>

          {/* CLOSE button */}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 text-gray-900 text-sm font-semibold rounded hover:bg-yellow-500 disabled:opacity-50"
          >
            <span className="text-base leading-none font-bold">×</span>
            CLOSE
          </button>
        </div>
    </div>
  );
}
