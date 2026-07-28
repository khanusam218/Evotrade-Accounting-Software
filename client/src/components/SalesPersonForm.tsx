import { apiFetch, parseJsonOrThrow } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { SalesPerson, SalesPersonFormData } from '../types/salesperson';
import { validateEmail, validateName, validatePhone } from '../utils/validators';
import { getBankAccountsLookup } from '../api/bankAccounts';
import type { BankAccount } from '../types/bankAccount';

interface NumberSeriesRow { id: number; name: string | null; prefix: string; }
interface UserRow { id: number; user_id: string; }

interface Props {
  salesPerson: SalesPerson | null;
  onClose: () => void;
  onSaved: () => void;
  onRefresh?: () => void;
}

type FormTab = 'general' | 'appUser';

const EMPTY: SalesPersonFormData = {
  print_name: '',
  type: 'salesman',
  email: '',
  phone: '',
  can_change_price: false,
  can_add_discount: false,
  is_manager: false,
  status: 'active',
  notes: '',
  cash_account_id: '',
  sale_order_series_id: '',
  receive_payment_series_id: '',
  manager_id: '',
  application_user_id: '',
  branch_name: '',
};

function toFormData(sp: SalesPerson): SalesPersonFormData {
  return {
    print_name: sp.print_name,
    type: sp.type,
    email: sp.email ?? '',
    phone: sp.phone ?? '',
    can_change_price: sp.can_change_price,
    can_add_discount: sp.can_add_discount,
    is_manager: sp.is_manager,
    status: sp.status,
    notes: sp.notes ?? '',
    cash_account_id: sp.cash_account_id ? String(sp.cash_account_id) : '',
    sale_order_series_id: sp.sale_order_series_id ? String(sp.sale_order_series_id) : '',
    receive_payment_series_id: sp.receive_payment_series_id ? String(sp.receive_payment_series_id) : '',
    manager_id: sp.manager_id ? String(sp.manager_id) : '',
    application_user_id: sp.application_user_id ? String(sp.application_user_id) : '',
    branch_name: sp.branch_name ?? '',
  };
}

export default function SalesPersonForm({ salesPerson, onClose, onSaved, onRefresh }: Props) {
  const isEdit = salesPerson !== null;

  const [form, setForm] = useState<SalesPersonFormData>(isEdit ? toFormData(salesPerson) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<FormTab>('general');
  const [error, setError] = useState('');

  const set = (k: keyof SalesPersonFormData, v: any) => {
    setForm(f => ({ ...f, [k]: v }));
    setError('');
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [numberSeries, setNumberSeries] = useState<NumberSeriesRow[]>([]);
  const [otherPersons, setOtherPersons] = useState<SalesPerson[]>([]);
  const [users,        setUsers]        = useState<UserRow[]>([]);

  useEffect(() => {
    getBankAccountsLookup().then(setBankAccounts).catch(() => {});
    apiFetch('/api/number-series').then(parseJsonOrThrow).then(d => setNumberSeries(d as NumberSeriesRow[])).catch(() => {});
    apiFetch('/api/sales-persons').then(parseJsonOrThrow).then(d => setOtherPersons(d as SalesPerson[])).catch(() => {});
    apiFetch('/api/users').then(parseJsonOrThrow).then(d => setUsers(d as UserRow[])).catch(() => {});
  }, []);

  const handleSave = async (saveAndNew: boolean) => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.print_name, 'Sales Person Name'); if (nameErr) errs.print_name = nameErr;
    const emailErr = validateEmail(form.email); if (emailErr) errs.email = emailErr;
    const phoneErr = validatePhone(form.phone); if (phoneErr) errs.phone = phoneErr;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setError('Please fix the highlighted fields before saving.'); return; }

    setSaving(true);
    try {
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/sales-persons/${salesPerson.id}` : '/api/sales-persons';
      const body = {
        print_name: form.print_name,
        type: form.type,
        email: form.email || null,
        phone: form.phone || null,
        can_change_price: form.can_change_price,
        can_add_discount: form.can_add_discount,
        is_manager: form.is_manager,
        status: form.status,
        notes: form.notes || null,
        cash_account_id: form.cash_account_id ? Number(form.cash_account_id) : null,
        sale_order_series_id: form.sale_order_series_id ? Number(form.sale_order_series_id) : null,
        receive_payment_series_id: form.receive_payment_series_id ? Number(form.receive_payment_series_id) : null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
        application_user_id: form.application_user_id ? Number(form.application_user_id) : null,
        branch_name: form.branch_name || null,
      };

      const r = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaving(false);
      onSaved();

      if (saveAndNew && !isEdit) {
        setForm(EMPTY);
        setTab('general');
        if (onRefresh) onRefresh();
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="w-full flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Sales Person - Add []</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => setTab('general')}
              className={`pb-3 text-sm font-medium border-b-2 ${
                tab === 'general'
                  ? 'border-green-500 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setTab('appUser')}
              className={`pb-3 text-sm font-medium border-b-2 ${
                tab === 'appUser'
                  ? 'border-green-500 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              Application User
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* GENERAL TAB */}
        {tab === 'general' && (
          <div className="space-y-4 max-w-4xl">
            {/* Row 1: Sales Person Name (full width) */}
            <div>
              <label className={labelCls}>
                Sales Person Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Sales Person Name"
                className={`${inputCls} ${fieldErrors.print_name ? 'border-red-500' : ''}`}
                value={form.print_name}
                onChange={e => set('print_name', e.target.value)}
              />
              {fieldErrors.print_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.print_name}</p>}
            </div>

            {/* Row 2: Type (checkboxes) | Cash Account */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Type <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.type === 'salesman'}
                      onChange={e => e.target.checked && set('type', 'salesman')}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Salesman</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.type === 'order_booker'}
                      onChange={e => e.target.checked && set('type', 'order_booker')}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Order Booker</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.type === 'delivery_person'}
                      onChange={e => e.target.checked && set('type', 'delivery_person')}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Delivery Person</span>
                  </label>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Cash Account <span className="text-orange-500">(Only applicable for Order Booker App.) </span>
                  <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls}
                  value={form.cash_account_id}
                  onChange={e => set('cash_account_id', e.target.value)}
                >
                  <option value="">-Choose-</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name || b.name}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: Sale Order Series | Receive Payment Series */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Sale Order Series</label>
                <div className="flex gap-2">
                  <select
                    className={inputCls}
                    value={form.sale_order_series_id}
                    onChange={e => set('sale_order_series_id', e.target.value)}
                  >
                    <option value="">-Choose-</option>
                    {numberSeries.map(s => <option key={s.id} value={s.id}>{s.name ?? s.prefix}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Receive Payment Series</label>
                <div className="flex gap-2">
                  <select
                    className={inputCls}
                    value={form.receive_payment_series_id}
                    onChange={e => set('receive_payment_series_id', e.target.value)}
                  >
                    <option value="">-Choose-</option>
                    {numberSeries.map(s => <option key={s.id} value={s.id}>{s.name ?? s.prefix}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 4: Checkboxes */}
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.can_change_price}
                  onChange={e => set('can_change_price', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Can change price</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.can_add_discount}
                  onChange={e => set('can_add_discount', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Can Add Discount</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_manager}
                  onChange={e => set('is_manager', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Is Manager</span>
              </label>
            </div>

            {/* Row 5: Manager | Branch */}
            <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Manager</label>
              <select
                className={inputCls}
                value={form.manager_id}
                onChange={e => set('manager_id', e.target.value)}
              >
                <option value="">-Choose-</option>
                {otherPersons.filter(p => !isEdit || p.id !== salesPerson!.id).map(p => (
                  <option key={p.id} value={p.id}>{p.print_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Branch</label>
              <input
                type="text"
                className={inputCls}
                placeholder="Branch"
                value={form.branch_name}
                onChange={e => set('branch_name', e.target.value)}
              />
            </div>
            </div>

            {/* Row 6: Email | Phone */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  className={`${inputCls} ${fieldErrors.email ? 'border-red-500' : ''}`}
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                />
                {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  placeholder="Phone"
                  className={`${inputCls} ${fieldErrors.phone ? 'border-red-500' : ''}`}
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
                {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
              </div>
            </div>

            {/* Row 7: Status | Notes */}
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={e => set('status', e.target.value as any)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                placeholder="Notes"
                className={inputCls + ' min-h-[100px]'}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* APPLICATION USER TAB */}
        {tab === 'appUser' && (
          <div className="max-w-4xl">
            <div>
              <label className={labelCls}>Application User</label>
              <select
                className={inputCls + ' border-green-500 focus:border-green-500'}
                value={form.application_user_id}
                onChange={e => set('application_user_id', e.target.value)}
              >
                <option value="">-Choose-</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.user_id}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-white flex gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-semibold px-6 py-2 rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'SAVING…' : 'SAVE AND NEW'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="bg-orange-400 hover:bg-orange-500 text-white text-sm font-semibold px-6 py-2 rounded transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="text-lg leading-none font-light">×</span> CLOSE
          </button>
        </div>
    </div>
  );
}

