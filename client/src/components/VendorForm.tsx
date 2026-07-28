import { useEffect, useRef, useState } from 'react';
import type { Vendor, VendorCategory, VendorFormData } from '../types/vendor';
import { createVendor, getVendorCategories, getNextVendorCode, updateVendor } from '../api/vendors';
import { validateEmail, validateName, validatePhone, validatePositive, validateZip } from '../utils/validators';
import { PK_PROVINCES, PK_CITIES, COUNTRIES } from '../data/locations';
import CustomFieldsTab from './CustomFieldsTab';

interface Props {
  vendor: Vendor | null;
  onClose: () => void;
  onSaved: () => void;
  onRefresh?: () => void;
  onSavedAndNew?: () => void;
}

type FormTab = 'general' | 'address' | 'custom';

const EMPTY: VendorFormData = {
  print_name: '',
  email: '',
  phone_1: '',
  phone_2: '',
  category_id: '',
  opening_balance: 0,
  credit_limit_days: 0,
  is_principal: false,
  contact_person: '',
  address: '',
  is_active: true,
  profile_image: null,
  address_line1: '', address_line2: '',
  city: '', state: '', zip: '', country: '',
};

function toFormData(v: Vendor): VendorFormData {
  return {
    print_name:        v.print_name,
    email:             v.email          ?? '',
    phone_1:           v.phone_1        ?? '',
    phone_2:           v.phone_2        ?? '',
    category_id:       v.category_id    ? String(v.category_id) : '',
    opening_balance:   v.opening_balance,
    credit_limit_days: v.credit_limit_days,
    is_principal:      v.is_principal,
    contact_person:    v.contact_person ?? '',
    address:           v.address        ?? '',
    is_active:         v.is_active,
    profile_image:     v.profile_image  ?? null,
    address_line1:     v.address_line1  ?? '',
    address_line2:     v.address_line2  ?? '',
    city:              v.city           ?? '',
    state:             v.state          ?? '',
    zip:               v.zip            ?? '',
    country:           v.country        ?? '',
  };
}

export default function VendorForm({ vendor, onClose, onSaved, onRefresh, onSavedAndNew }: Props) {
  const isEdit = vendor !== null;

  const [form,       setForm]       = useState<VendorFormData>(isEdit ? toFormData(vendor) : EMPTY);
  const [nextCode,   setNextCode]   = useState('');
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [touched,    setTouched]    = useState(false);
  const [tab,        setTab]        = useState<FormTab>('general');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // UI-only fields
  const [displayName, setDisplayName] = useState('');
  const [phone3,      setPhone3]      = useState('');

  // Searchable category
  const [catSearch, setCatSearch] = useState('');
  const [catOpen,   setCatOpen]   = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getVendorCategories().then(cats => {
      setCategories(cats);
      if (isEdit && vendor.category_id) {
        const cat = cats.find(c => c.id === vendor.category_id);
        if (cat) setCatSearch(cat.name);
      }
    }).catch(() => {});
    if (!isEdit) getNextVendorCode().then(setNextCode).catch(() => {});
  }, [isEdit, vendor]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function set<K extends keyof VendorFormData>(key: K, value: VendorFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => ({ ...prev, [key as string]: '' }));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { set('profile_image', ev.target?.result as string); return; }
        const scale = Math.max(size / img.width, size / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        set('profile_image', canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(f);
  }

  const filteredCats = categories.filter(c =>
    !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  function resetForm() {
    setForm(EMPTY);
    setDisplayName(''); setPhone3('');
    setCatSearch(''); setTouched(false); setTab('general');
    getNextVendorCode().then(setNextCode).catch(() => {});
  }

  function validateVendorFields(): Record<string, string> {
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.print_name, 'Vendor name'); if (nameErr) errs.print_name = nameErr;
    const emailErr = validateEmail(form.email); if (emailErr) errs.email = emailErr;
    const p1 = validatePhone(form.phone_1); if (p1) errs.phone_1 = p1;
    const p2 = validatePhone(form.phone_2); if (p2) errs.phone_2 = p2;
    const p3 = validatePhone(phone3); if (p3) errs.phone3 = p3;
    const zipErr = validateZip(form.zip ?? ''); if (zipErr) errs.zip = zipErr;
    const balErr = validatePositive(form.opening_balance, 'Opening balance'); if (balErr) errs.opening_balance = balErr;
    const creditErr = validatePositive(form.credit_limit_days, 'Credit limit'); if (creditErr) errs.credit_limit_days = creditErr;
    return errs;
  }

  async function handleSave(andNew: boolean) {
    setTouched(true);
    const errs = validateVendorFields();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      if (isEdit) await updateVendor(vendor.id, form);
      else        await createVendor(form);
      if (andNew) {
        onRefresh?.();
        // Editing: this instance still holds the record via the `vendor`
        // prop, which can't be reset locally — hand back to the parent to
        // swap in a fresh "add" instance instead of resetting in place
        // (that left the code field showing the OLD vendor while every
        // other field went blank, and a second save would have overwritten
        // the original record with that blank data).
        if (isEdit) onSavedAndNew?.();
        else resetForm();
      } else {
        onSaved();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  const inputCls  = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';
  const errCls    = 'w-full border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500';
  const nameErr   = touched && fieldErrors.print_name;

  const tabs: { key: FormTab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'address', label: 'Address' },
    { key: 'custom',  label: 'Custom Fields' },
  ];

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-200 px-6 pt-4 bg-white shrink-0">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`mr-6 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-green-500 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── GENERAL TAB ────────────────────────────────────────────────── */}
          {tab === 'general' && (
            <div className="space-y-5">

              {/* Row 1: Vendor Code | Vendor Name | Profile image */}
              <div className="flex gap-6 items-start">
                <div className="flex-1 grid grid-cols-2 gap-4">

                  {/* Vendor Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-stretch h-[38px]">
                      <button type="button"
                        className="bg-green-500 hover:bg-green-600 text-white px-2.5 rounded-l flex items-center justify-center">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                      </button>
                      <input
                        type="text" readOnly
                        value={isEdit ? vendor.code : nextCode}
                        className="flex-1 border-t border-b border-gray-300 px-3 text-sm bg-gray-50 text-center focus:outline-none"
                      />
                      <button type="button"
                        onClick={() => !isEdit && getNextVendorCode().then(setNextCode).catch(() => {})}
                        className="bg-green-500 hover:bg-green-600 text-white px-2.5 rounded-r flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Vendor Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text" placeholder="Vendor Name"
                      className={nameErr ? errCls : inputCls}
                      value={form.print_name}
                      onChange={e => set('print_name', e.target.value)}
                    />
                    {nameErr && <p className="mt-1 text-xs text-red-600">{fieldErrors.print_name}</p>}
                  </div>
                </div>

                {/* Profile image */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                    {form.profile_image
                      ? <img src={form.profile_image} alt="vendor" className="w-full h-full object-cover" />
                      : <svg className="w-10 h-10 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                    }
                  </div>
                  <label className="cursor-pointer border border-gray-300 rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                    Choose image
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  </label>
                </div>
              </div>

              {/* Row 2: Print Name | Display Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Print Name</label>
                  <input type="text" placeholder="Print Name" className={inputCls}
                    value={form.print_name} onChange={e => set('print_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input type="text" placeholder="Display Name" className={inputCls}
                    value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
              </div>

              {/* Row 2b: Contact Person */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input type="text" placeholder="Contact Person" className={inputCls}
                    value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
                </div>
              </div>

              {/* Row 3: Email | Phone 1 | Phone 2 | Phone 3 */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" placeholder="Email" className={inputCls}
                    value={form.email} onChange={e => set('email', e.target.value)} />
                  {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone 1</label>
                  <input type="tel" placeholder="Phone 1" className={inputCls}
                    value={form.phone_1} onChange={e => set('phone_1', e.target.value)} />
                  {fieldErrors.phone_1 && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_1}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone 2</label>
                  <input type="tel" placeholder="Phone 2" className={inputCls}
                    value={form.phone_2} onChange={e => set('phone_2', e.target.value)} />
                  {fieldErrors.phone_2 && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_2}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone 3</label>
                  <input type="tel" placeholder="Phone 3" className={inputCls}
                    value={phone3} onChange={e => setPhone3(e.target.value)} />
                  {fieldErrors.phone3 && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone3}</p>}
                </div>
              </div>

              {/* Row 4: Vendor Category (searchable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Category</label>
                <div className="relative" ref={catRef}>
                  <input
                    type="text"
                    className={inputCls + ' pr-8'}
                    placeholder="Type to search vendor category"
                    value={catSearch}
                    onChange={e => { setCatSearch(e.target.value); setCatOpen(true); set('category_id', ''); }}
                    onFocus={() => setCatOpen(true)}
                  />
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                    fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                  {catOpen && filteredCats.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                      {filteredCats.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => {
                            set('category_id', String(c.id));
                            setCatSearch(c.name);
                            setCatOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 hover:text-green-700 transition-colors"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 5: Opening | Credit Limit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening (PKR)</label>
                  <input type="number" min="0" step="0.01" className={fieldErrors.opening_balance ? errCls : inputCls}
                    value={form.opening_balance}
                    onChange={e => set('opening_balance', parseFloat(e.target.value) || 0)} />
                  {fieldErrors.opening_balance && <p className="mt-1 text-xs text-red-600">{fieldErrors.opening_balance}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (Days)</label>
                  <input type="number" min="0" step="1" className={fieldErrors.credit_limit_days ? errCls : inputCls}
                    value={form.credit_limit_days}
                    onChange={e => set('credit_limit_days', parseInt(e.target.value) || 0)} />
                  {fieldErrors.credit_limit_days && <p className="mt-1 text-xs text-red-600">{fieldErrors.credit_limit_days}</p>}
                </div>
              </div>

              {/* Is Principal */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_principal" className="w-4 h-4 rounded"
                  checked={form.is_principal}
                  onChange={e => set('is_principal', e.target.checked)} />
                <label htmlFor="is_principal" className="text-sm text-gray-700">Is Principal Vendor</label>
              </div>
            </div>
          )}

          {/* ── ADDRESS TAB ────────────────────────────────────────────────── */}
          {tab === 'address' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                  <input type="text" className={inputCls} placeholder="Address Line 1"
                    value={form.address_line1} onChange={e => set('address_line1', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input type="text" className={inputCls} placeholder="Address Line 2"
                    value={form.address_line2} onChange={e => set('address_line2', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  {form.country === 'Pakistan' ? (
                    <select className={inputCls} value={form.city} onChange={e => set('city', e.target.value)}>
                      <option value="">-Choose-</option>
                      {PK_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type="text" className={inputCls} placeholder="City"
                      value={form.city} onChange={e => set('city', e.target.value)} />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  {form.country === 'Pakistan' ? (
                    <select className={inputCls} value={form.state} onChange={e => set('state', e.target.value)}>
                      <option value="">-Choose-</option>
                      {PK_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input type="text" className={inputCls} placeholder="State"
                      value={form.state} onChange={e => set('state', e.target.value)} />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select className={inputCls} value={form.country} onChange={e => set('country', e.target.value)}>
                    <option value="">-Choose-</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                  <input type="text" className={inputCls} placeholder="Zip Code"
                    value={form.zip} onChange={e => set('zip', e.target.value)} />
                  {fieldErrors.zip && <p className="mt-1 text-xs text-red-600">{fieldErrors.zip}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── CUSTOM FIELDS TAB ──────────────────────────────────────────── */}
          {tab === 'custom' && <CustomFieldsTab entityType="vendor" entityId={vendor?.id ?? null} />}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-0 border-t border-gray-200 px-6 py-4 bg-white shrink-0">
          {/* SAVE AND NEW — left part saves + resets form */}
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-l transition-colors disabled:opacity-50"
          >
            {saving ? 'SAVING…' : 'SAVE AND NEW'}
          </button>
          {/* ▲ dropdown part — saves + closes */}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center bg-gray-300 hover:bg-gray-400 text-gray-700 px-2 py-2.5 rounded-r border-l border-gray-400 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </button>
          {/* × CLOSE — closes without saving */}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-3 flex items-center gap-1.5 bg-orange-400 hover:bg-orange-500 text-white text-sm font-semibold px-5 py-2.5 rounded transition-colors disabled:opacity-50"
          >
            × CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
