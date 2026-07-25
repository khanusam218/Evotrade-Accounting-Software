import { useEffect, useRef, useState } from 'react';
import type { Customer, CustomerCategory, CustomerFormData } from '../types/customer';
import {
  createCustomer,
  createCustomerCategory,
  getCustomerCategories,
  getNextCode,
  updateCustomer,
} from '../api/customers';
import { validateEmail, validatePhone, validateZip } from '../utils/validators';

interface Props {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

type FormTab = 'general' | 'address' | 'custom';

const EMPTY: CustomerFormData = {
  print_name: '',
  email_1: '', email_2: '', email_3: '',
  phone_1: '', phone_2: '', phone_3: '',
  opening_balance: 0,
  credit_limit: 0,
  default_discount_percent: 0,
  withholding_tax_percent: 0,
  category_id: '',
  contact_person: '',
  is_active: true,
  address_line_1: '', address_line_2: '',
  city: '', state_province: '', country: '', zip_code: '',
};

function toFormData(c: Customer): CustomerFormData {
  return {
    print_name:                c.print_name,
    email_1:                   c.email_1 ?? '',
    email_2:                   c.email_2 ?? '',
    email_3:                   c.email_3 ?? '',
    phone_1:                   c.phone_1 ?? '',
    phone_2:                   c.phone_2 ?? '',
    phone_3:                   c.phone_3 ?? '',
    opening_balance:           c.opening_balance,
    credit_limit:              c.credit_limit,
    default_discount_percent:  c.default_discount_percent,
    withholding_tax_percent:   c.withholding_tax_percent,
    category_id:               c.category_id ? String(c.category_id) : '',
    contact_person:            c.contact_person ?? '',
    is_active:                 c.is_active,
    address_line_1:            c.address_line_1 ?? '',
    address_line_2:            c.address_line_2 ?? '',
    city:                      c.city ?? '',
    state_province:            c.state_province ?? '',
    country:                   c.country ?? '',
    zip_code:                  c.zip_code ?? '',
  };
}

// ── Shared small helpers ───────────────────────────────────────────────────────

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({ id, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      id={id}
      {...props}
      className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 ${
        props.className ?? 'border-gray-300'
      }`}
    />
  );
}

function CalendarSVG() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function CustomerForm({ customer, onClose, onSaved }: Props) {
  const isEdit = customer !== null;

  const [form, setForm]           = useState<CustomerFormData>(isEdit ? toFormData(customer) : EMPTY);
  const [nextCode, setNextCode]   = useState('');
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [activeTab, setActiveTab] = useState<FormTab>('general');
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Partial<Record<keyof CustomerFormData, string>>>({});

  // Extra UI-only fields (not in API type yet)
  const [displayName,         setDisplayName]         = useState('');
  const [longitude,           setLongitude]           = useState(String(customer?.longitude ?? ''));
  const [latitude,            setLatitude]            = useState(String(customer?.latitude ?? ''));
  const [isCashCustomer,      setIsCashCustomer]      = useState(false);
  const [isSaleTaxRegistered, setIsSaleTaxRegistered] = useState(false);
  const [imageUrl,            setImageUrl]            = useState('');


  // Category search
  const [catSearch,    setCatSearch]    = useState('');
  const [catOpen,      setCatOpen]      = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCustomerCategories().then(setCategories).catch(() => {});
    if (!isEdit) getNextCode().then(setNextCode).catch(() => {});
  }, [isEdit]);

  // Close category dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function set<K extends keyof CustomerFormData>(key: K, value: CustomerFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.print_name.trim()) e.print_name = 'Customer name is required';
    const email1Err = validateEmail(form.email_1); if (email1Err) e.email_1 = email1Err;
    const email2Err = validateEmail(form.email_2); if (email2Err) e.email_2 = email2Err;
    const email3Err = validateEmail(form.email_3); if (email3Err) e.email_3 = email3Err;
    const phone1Err = validatePhone(form.phone_1); if (phone1Err) e.phone_1 = phone1Err;
    const phone2Err = validatePhone(form.phone_2); if (phone2Err) e.phone_2 = phone2Err;
    const phone3Err = validatePhone(form.phone_3); if (phone3Err) e.phone_3 = phone3Err;
    const zipErr = validateZip(form.zip_code); if (zipErr) e.zip_code = zipErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function resolveCategoryId(): Promise<string> {
    if (form.category_id) return form.category_id;
    const typed = catSearch.trim();
    if (!typed) return '';
    const existing = categories.find(c => c.name.toLowerCase() === typed.toLowerCase());
    if (existing) return String(existing.id);
    const created = await createCustomerCategory(typed);
    setCategories(prev => [...prev, created]);
    return String(created.id);
  }

  async function handleSave(saveAndNew = false) {
    if (!validate()) return;
    setSaving(true);
    try {
      const category_id = await resolveCategoryId();
      const payload = { ...form, category_id };
      if (isEdit) {
        await updateCustomer(customer.id, payload);
      } else {
        await createCustomer(payload);
      }
      if (saveAndNew) {
        setForm(EMPTY);
        setDisplayName('');
        setLongitude('');
        setLatitude('');
        setIsCashCustomer(false);
        setIsSaleTaxRegistered(false);
        setImageUrl('');
        setCatSearch('');
        setErrors({});
        setActiveTab('general');
        getNextCode().then(setNextCode).catch(() => {});
      } else {
        onSaved();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  const displayCode = isEdit ? customer.code : (nextCode || 'C-000001');

  const filteredCats = categories.filter(c =>
    !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase())
  );
  const selectedCatName = categories.find(c => String(c.id) === form.category_id)?.name ?? '';

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';

  const TABS: { key: FormTab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'address', label: 'Address' },
    { key: 'custom',  label: 'Custom Fields' },
  ];

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* ── Header + Tabs ─────────────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-5 pb-0 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {isEdit ? `Customers - Edit [${customer.code}]` : 'Customers - Add []'}
          </h2>
          <div className="flex gap-6">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-green-500 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── GENERAL TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'general' && (
            <div className="space-y-5">

              {/* Row 1: Customer Code | Customer Name | Profile Image */}
              <div className="flex gap-6 items-start">
                <div className="flex-1 grid grid-cols-2 gap-5">
                  {/* Customer Code */}
                  <div>
                    <Label text="Customer Code" required />
                    <div className="flex items-stretch border border-gray-300 rounded overflow-hidden">
                      <button type="button"
                        className="bg-green-500 hover:bg-green-600 px-3 flex items-center text-white">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <input
                        readOnly
                        value={displayCode}
                        className="flex-1 px-3 py-2 text-sm bg-white focus:outline-none text-gray-700 cursor-default"
                      />
                      <button type="button"
                        onClick={() => !isEdit && getNextCode().then(setNextCode).catch(() => {})}
                        className="bg-green-500 hover:bg-green-600 px-3 flex items-center text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Customer Name */}
                  <div>
                    <Label text="Customer Name" required />
                    <input
                      className={`${inputCls} ${errors.print_name ? 'border-red-500' : ''}`}
                      placeholder="Customer Name"
                      value={form.print_name}
                      onChange={e => set('print_name', e.target.value)}
                    />
                    {errors.print_name && (
                      <p className="text-red-500 text-xs mt-1">{errors.print_name}</p>
                    )}
                  </div>
                </div>

                {/* Profile Image */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-24 h-24 rounded-full border-2 border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <label className="cursor-pointer border border-gray-300 rounded px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Choose image
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setImageUrl(URL.createObjectURL(f)); }} />
                  </label>
                </div>
              </div>

              {/* Row 2: Print Name | Display Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label text="Print Name" />
                  <input className={inputCls} placeholder="Print Name"
                    value={form.print_name}
                    onChange={e => set('print_name', e.target.value)} />
                </div>
                <div>
                  <Label text="Display Name" />
                  <input className={inputCls} placeholder="Display Name"
                    value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
              </div>

              {/* Row 3: Email 1 | Email 2 | Email 3 | Phone 1 — 4 columns */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label text="Email 1" />
                  <input type="email" className={inputCls} placeholder="Email 1"
                    value={form.email_1} onChange={e => set('email_1', e.target.value)} />
                  {errors.email_1 && <p className="text-xs text-red-500 mt-1">{errors.email_1}</p>}
                </div>
                <div>
                  <Label text="Email 2" />
                  <input type="email" className={inputCls} placeholder="Email 2"
                    value={form.email_2} onChange={e => set('email_2', e.target.value)} />
                  {errors.email_2 && <p className="text-xs text-red-500 mt-1">{errors.email_2}</p>}
                </div>
                <div>
                  <Label text="Email 3" />
                  <input type="email" className={inputCls} placeholder="Email 3"
                    value={form.email_3} onChange={e => set('email_3', e.target.value)} />
                  {errors.email_3 && <p className="text-xs text-red-500 mt-1">{errors.email_3}</p>}
                </div>
                <div>
                  <Label text="Phone 1" />
                  <input type="tel" className={inputCls} placeholder="Phone 1"
                    value={form.phone_1} onChange={e => set('phone_1', e.target.value)} />
                  {errors.phone_1 && <p className="text-xs text-red-500 mt-1">{errors.phone_1}</p>}
                </div>
              </div>

              {/* Row 4: Phone 2 | Phone 3 | Customer Category — 3 columns */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label text="Phone 2" />
                  <input type="tel" className={inputCls} placeholder="Phone 2"
                    value={form.phone_2} onChange={e => set('phone_2', e.target.value)} />
                  {errors.phone_2 && <p className="text-xs text-red-500 mt-1">{errors.phone_2}</p>}
                </div>
                <div>
                  <Label text="Phone 3" />
                  <input type="tel" className={inputCls} placeholder="Phone 3"
                    value={form.phone_3} onChange={e => set('phone_3', e.target.value)} />
                  {errors.phone_3 && <p className="text-xs text-red-500 mt-1">{errors.phone_3}</p>}
                </div>

                {/* Customer Category — searchable dropdown */}
                <div ref={catRef}>
                  <Label text="Customer Category" />
                  <div className="relative">
                    <div
                      className="flex items-center border border-gray-300 rounded px-3 py-2 text-sm cursor-pointer focus-within:border-green-500 bg-white"
                      onClick={() => setCatOpen(o => !o)}
                    >
                      <input
                        className="flex-1 focus:outline-none text-sm bg-transparent"
                        placeholder="Type to search customer category"
                        value={catOpen ? catSearch : selectedCatName}
                        onChange={e => { setCatSearch(e.target.value); setCatOpen(true); }}
                        onFocus={() => { setCatOpen(true); setCatSearch(''); }}
                      />
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {catOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto mt-0.5">
                        <div
                          className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer"
                          onMouseDown={() => { set('category_id', ''); setCatOpen(false); setCatSearch(''); }}
                        >
                          — None —
                        </div>
                        {filteredCats.map(c => (
                          <div
                            key={c.id}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${
                              String(c.id) === form.category_id ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                            }`}
                            onMouseDown={() => { set('category_id', String(c.id)); setCatOpen(false); setCatSearch(''); }}
                          >
                            {c.name}
                          </div>
                        ))}
                        {filteredCats.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400">No categories found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 5: Longitude | Latitude | Is Cash Customer | Is Sale Tax Registered */}
              <div className="grid grid-cols-4 gap-4 items-end">
                <div>
                  <Label text="Longitude" />
                  <input className={inputCls} placeholder="longitude"
                    value={longitude} onChange={e => setLongitude(e.target.value)} />
                </div>
                <div>
                  <Label text="Latitude" />
                  <input className={inputCls} placeholder="latitude"
                    value={latitude} onChange={e => setLatitude(e.target.value)} />
                </div>
                <div className="flex flex-col gap-3 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-green-600 rounded"
                      checked={isCashCustomer} onChange={e => setIsCashCustomer(e.target.checked)} />
                    <span className="text-sm text-gray-700">Is Cash Customer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-green-600 rounded"
                      checked={isSaleTaxRegistered} onChange={e => setIsSaleTaxRegistered(e.target.checked)} />
                    <span className="text-sm text-gray-700">Is Sale Tax Registered</span>
                  </label>
                </div>
              </div>

              {/* Financial Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label text="Opening Balance" />
                  <input type="number" min="0" step="0.01" className={inputCls}
                    value={form.opening_balance}
                    onChange={e => set('opening_balance', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label text="Credit Limit" />
                  <input type="number" min="0" step="0.01" className={inputCls}
                    value={form.credit_limit}
                    onChange={e => set('credit_limit', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label text="Default Discount (%)" />
                  <input type="number" min="0" max="100" step="0.01" className={inputCls}
                    value={form.default_discount_percent}
                    onChange={e => set('default_discount_percent', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label text="Withholding Tax (%)" />
                  <input type="number" min="0" max="100" step="0.01" className={inputCls}
                    value={form.withholding_tax_percent}
                    onChange={e => set('withholding_tax_percent', parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              {/* Contact Person + Status + Active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label text="Contact Person" />
                  <input className={inputCls} placeholder="Primary contact name"
                    value={form.contact_person}
                    onChange={e => set('contact_person', e.target.value)} />
                </div>
                <div>
                  <Label text="Status" />
                  <div className="relative">
                    <select
                      className={inputCls + ' appearance-none pr-8'}
                      value={form.is_active ? 'true' : 'false'}
                      onChange={e => set('is_active', e.target.value === 'true')}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ADDRESS TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'address' && (
            <div className="space-y-4 max-w-3xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label text="Address Line 1" />
                  <input className={inputCls} placeholder="Address Line 1"
                    value={form.address_line_1} onChange={e => set('address_line_1', e.target.value)} />
                </div>
                <div>
                  <Label text="Address Line 2" />
                  <input className={inputCls} placeholder="Address Line 2"
                    value={form.address_line_2} onChange={e => set('address_line_2', e.target.value)} />
                </div>
                <div>
                  <Label text="City" />
                  <input className={inputCls} placeholder="City"
                    value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <Label text="State / Province" />
                  <input className={inputCls} placeholder="State / Province"
                    value={form.state_province} onChange={e => set('state_province', e.target.value)} />
                </div>
                <div>
                  <Label text="Country" />
                  <input className={inputCls} placeholder="Country"
                    value={form.country} onChange={e => set('country', e.target.value)} />
                </div>
                <div>
                  <Label text="ZIP / Postal Code" />
                  <input className={inputCls} placeholder="ZIP / Postal Code"
                    value={form.zip_code} onChange={e => set('zip_code', e.target.value)} />
                  {errors.zip_code && <p className="text-xs text-red-500 mt-1">{errors.zip_code}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── CUSTOM FIELDS TAB ───────────────────────────────────────────── */}
          {activeTab === 'custom' && (
            <div className="max-w-2xl">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-5 py-4">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Add Fields</h3>
                  <div className="w-56">
                    <Label text="Field" required />
                    <div className="relative">
                      <select className={inputCls + ' appearance-none pr-8'}>
                        <option value="">-Choose-</option>
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-end gap-3">
                  <button type="button"
                    className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    ADD
                  </button>
                  <button type="button"
                    className="flex items-center gap-1.5 bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded">
                    <span className="text-base leading-none font-light">×</span> CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: SAVE AND NEW ▲ | × CLOSE ─────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          <div className="flex rounded overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-5 py-2 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'SAVE AND NEW'}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-2 border-l border-gray-300 transition-colors disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium px-5 py-2 rounded transition-colors flex items-center gap-1.5"
          >
            <span className="text-lg leading-none font-light">×</span> CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
