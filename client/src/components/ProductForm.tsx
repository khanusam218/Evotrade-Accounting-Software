import { useEffect, useRef, useState } from 'react';
import type { Brand, Product, ProductCategory, ProductFormData, Tax } from '../types/product';
import {
  createProduct, getBrands, getNextProductCode,
  getProductCategories, getTaxes, updateProduct,
} from '../api/products';
import { validateItemName, validatePositive } from '../utils/validators';
import CustomFieldsTab from './CustomFieldsTab';
import { getVendors } from '../api/vendors';
import type { Vendor } from '../types/vendor';

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
  onRefresh?: () => void;
  onSavedAndNew?: () => void;
}

const EMPTY: ProductFormData = {
  name: '', type: 'product', category_id: '', brand_id: '',
  unit_of_measurement: '', fractional_units: false,
  track_inventory: false, manage_batch: false, manage_serial: false,
  has_packaging: false, is_assembled: false,
  is_purchased: false, purchase_price: '', purchase_tax_id: '', manage_purchase_tax: false,
  is_sold: false, sale_price: '', sale_tax_id: '', mrp: '', mrp_exclusive_of_tax: false, dont_allow_public: false,
  is_active: true,
  description: '', short_description: '',
  image: null,
  principal_vendor_id: '',
  hs_code: '',
};

function toFormData(p: Product): ProductFormData {
  return {
    name: p.name, type: p.type,
    category_id: p.category_id ? String(p.category_id) : '',
    brand_id: p.brand_id ? String(p.brand_id) : '',
    unit_of_measurement: p.unit_of_measurement,
    fractional_units: p.fractional_units,
    track_inventory: p.track_inventory, manage_batch: p.manage_batch,
    manage_serial: p.manage_serial, has_packaging: p.has_packaging,
    is_assembled: p.is_assembled, is_purchased: p.is_purchased,
    purchase_price: p.purchase_price != null ? String(p.purchase_price) : '',
    purchase_tax_id: p.purchase_tax_id ? String(p.purchase_tax_id) : '',
    manage_purchase_tax: p.manage_purchase_tax, is_sold: p.is_sold,
    sale_price: p.sale_price != null ? String(p.sale_price) : '',
    sale_tax_id: p.sale_tax_id ? String(p.sale_tax_id) : '',
    mrp: p.mrp != null ? String(p.mrp) : '',
    mrp_exclusive_of_tax: p.mrp_exclusive_of_tax,
    dont_allow_public: p.dont_allow_public, is_active: p.is_active,
    description: p.description ?? '', short_description: p.short_description ?? '',
    image: p.image ?? null,
    principal_vendor_id: p.principal_vendor_id ? String(p.principal_vendor_id) : '',
    hs_code: p.hs_code ?? '',
  };
}

type FormTab = 'general' | 'detail' | 'custom' | 'packings' | 'catalog' | 'stock' | 'taxes';

const UOM_OPTIONS = ['PCS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'FT', 'BOX', 'DOZEN', 'SET', 'PAIR', 'ROLL', 'BAG', 'TON'];

function PlaceholderTab({ label }: { label: string }) {
  return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">{label} settings coming soon.</div>;
}

export default function ProductForm({ product, onClose, onSaved, onRefresh, onSavedAndNew }: Props) {
  const isEdit = product !== null;
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [tab,        setTab]        = useState<FormTab>('general');
  const [form,       setForm]       = useState<ProductFormData>(isEdit ? toFormData(product) : EMPTY);
  const [nextCode,   setNextCode]   = useState('');
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands,     setBrands]     = useState<Brand[]>([]);
  const [taxes,      setTaxes]      = useState<Tax[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [touched,    setTouched]    = useState(false);
  const [errors,     setErrors]     = useState<{ name?: string; purchase_price?: string; sale_price?: string; mrp?: string }>({});

  // UI-only state
  const [fractionalMode,    setFractionalMode]    = useState<'price' | 'qty'>('price');
  const [inventoryAccount,  setInventoryAccount]  = useState('Inventory');
  const [expenseAccount,    setExpenseAccount]    = useState('Cost of Goods Sold');
  const [purchaseDiscAcc,   setPurchaseDiscAcc]   = useState('Discounts Received');
  const [salesAccount,      setSalesAccount]      = useState('Sales');
  const [salesDiscAcc,      setSalesDiscAcc]      = useState('Discounts Given');
  const [salesReturnAcc,    setSalesReturnAcc]    = useState('Sales Return');

  // Detail tab UI-only state
  const [vendors,           setVendors]           = useState<Vendor[]>([]);
  const [shortName,         setShortName]         = useState('');
  const [sku,               setSku]               = useState('');
  const [barcode,           setBarcode]           = useState('');
  const [weight,            setWeight]            = useState('');
  const [height,            setHeight]            = useState('');
  const [width,             setWidth]             = useState('');
  const [length,            setLength]            = useState('');
  const [modelNumber,       setModelNumber]       = useState('');

  // Catalog tab UI-only state
  const [catalogContent,    setCatalogContent]    = useState('');
  const [galleryImages,     setGalleryImages]     = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Taxes tab UI-only state
  const [taxesOnSale,       setTaxesOnSale]       = useState<Tax[]>([]);
  const [taxesOnPurchase,   setTaxesOnPurchase]   = useState<Tax[]>([]);
  const [showSaleTaxModal,  setShowSaleTaxModal]  = useState(false);
  const [showPurchTaxModal, setShowPurchTaxModal] = useState(false);
  const [selectedSaleTax,   setSelectedSaleTax]   = useState<Tax | null>(null);
  const [selectedPurchTax,  setSelectedPurchTax]  = useState<Tax | null>(null);
  const [saleAppliedOn,     setSaleAppliedOn]     = useState('Sale Price');
  const [purchAppliedOn,    setPurchAppliedOn]    = useState('Purchase Price');
  const [saleCalcMode,      setSaleCalcMode]      = useState('after');
  const [purchCalcMode,     setPurchCalcMode]     = useState('after');

  function execCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  function addTaxToSale(tax: Tax) {
    if (!taxesOnSale.find(t => t.id === tax.id)) {
      setTaxesOnSale([...taxesOnSale, tax]);
    }
  }

  function addTaxToPurchase(tax: Tax) {
    if (!taxesOnPurchase.find(t => t.id === tax.id)) {
      setTaxesOnPurchase([...taxesOnPurchase, tax]);
    }
  }

  function removeTaxFromSale(taxId: number) {
    setTaxesOnSale(taxesOnSale.filter(t => t.id !== taxId));
  }

  function removeTaxFromPurchase(taxId: number) {
    setTaxesOnPurchase(taxesOnPurchase.filter(t => t.id !== taxId));
  }

  useEffect(() => {
    getProductCategories().then(setCategories).catch(() => {});
    getBrands().then(setBrands).catch(() => {});
    getTaxes().then(d => setTaxes(Array.isArray(d) ? d : [])).catch(() => {});
    getVendors({ limit: 500 }).then(r => setVendors(r.data)).catch(() => {});
    if (!isEdit) getNextProductCode().then(setNextCode).catch(() => {});
  }, [isEdit]);

  const ERROR_KEYS = ['name', 'purchase_price', 'sale_price', 'mrp'] as const;

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if ((ERROR_KEYS as readonly string[]).includes(key as string)) {
      setErrors(prev => ({ ...prev, [key as typeof ERROR_KEYS[number]]: undefined }));
    }
  }

  function resetForm() {
    setForm(EMPTY); setTouched(false); setTab('general'); setErrors({});
    setFractionalMode('price');
    setInventoryAccount('Inventory'); setExpenseAccount('Cost of Goods Sold');
    setPurchaseDiscAcc('Discounts Received'); setSalesAccount('Sales');
    setSalesDiscAcc('Discounts Given'); setSalesReturnAcc('Sales Return');
    setShortName(''); setSku(''); setBarcode('');
    setWeight(''); setHeight(''); setWidth(''); setLength('');
    setModelNumber('');
    setCatalogContent(''); setGalleryImages([]);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setTaxesOnSale([]); setTaxesOnPurchase([]);
    getNextProductCode().then(setNextCode).catch(() => {});
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { set('image', event.target?.result as string); return; }
        const scale = Math.max(size / img.width, size / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        set('image', canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleGalleryImagesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setGalleryImages(prev => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeGalleryImage(index: number) {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    const nameErr = validateItemName(form.name, 'Product name'); if (nameErr) errs.name = nameErr;
    if (form.purchase_price.trim()) {
      const err = validatePositive(parseFloat(form.purchase_price) || 0, 'Purchase price'); if (err) errs.purchase_price = err;
    }
    if (form.sale_price.trim()) {
      const err = validatePositive(parseFloat(form.sale_price) || 0, 'Sale price'); if (err) errs.sale_price = err;
    }
    if (form.mrp.trim()) {
      const err = validatePositive(parseFloat(form.mrp) || 0, 'Maximum retail price'); if (err) errs.mrp = err;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave(andNew: boolean) {
    setTouched(true);
    const uomMissing = form.type !== 'service' && !form.unit_of_measurement.trim();
    const formValid = validate();
    if (uomMissing || !formValid) { setTab('general'); return; }
    setSaving(true);
    try {
      if (isEdit) await updateProduct(product.id, form);
      else        await createProduct(form);
      if (andNew) {
        onRefresh?.();
        // Editing: this component instance still holds the record being
        // edited via the `product` prop, which can't be reset locally —
        // hand back to the parent to swap in a fresh "add" instance instead
        // of resetForm()'ing in place (that left the code field showing the
        // OLD product while every other field went blank, and a second save
        // would have overwritten the original record with that blank data).
        if (isEdit) onSavedAndNew?.();
        else resetForm();
      }
      else { onSaved(); }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally { setSaving(false); }
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';
  const errCls   = 'w-full border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500';
  const nameErr  = touched && errors.name;
  const uomErr   = touched && form.type !== 'service' && !form.unit_of_measurement.trim();

  const selectCls = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white';

  const TABS: { key: FormTab; label: string }[] = [
    { key: 'general',  label: 'General' },
    { key: 'detail',   label: 'Detail' },
    { key: 'custom',   label: 'Custom Fields' },
    { key: 'packings', label: 'Multiple Packings/SKUs' },
    { key: 'catalog',  label: 'Catalog' },
    { key: 'stock',    label: 'Stock Level' },
    { key: 'taxes',    label: 'Taxes' },
  ];

  return (
    <div className="w-full flex flex-col">
      <div className="w-full flex flex-col bg-white">

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-200 px-6 pt-4 bg-white shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`mr-5 pb-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key ? 'border-green-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-8 py-6">

          {/* ══ GENERAL TAB ══════════════════════════════════════════════════ */}
          {tab === 'general' && (
            <div className="space-y-5">

              {/* Type radio */}
              <div>
                <div className="flex items-center gap-8">
                  {(['product', 'service', 'product_variant'] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="product_type" value={t}
                        disabled={isEdit} checked={form.type === t}
                        onChange={() => set('type', t)}
                        className="w-4 h-4 accent-green-500" />
                      <span className="text-sm font-semibold text-gray-800">
                        {t === 'product' ? 'Product' : t === 'service' ? 'Services' : 'Product Variant'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-orange-500">(Cannot be changed once product created.)</p>
              </div>

              {/* Code | Name | UOM */}
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-stretch h-[38px]">
                    <button type="button"
                      className="bg-green-500 hover:bg-green-600 text-white px-2.5 rounded-l flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                    </button>
                    <input type="text" readOnly value={isEdit ? product.code : nextCode}
                      className="flex-1 border-t border-b border-gray-300 px-3 text-sm bg-gray-50 text-center focus:outline-none" />
                    <button type="button"
                      onClick={() => !isEdit && getNextProductCode().then(setNextCode).catch(() => {})}
                      className="bg-green-500 hover:bg-green-600 text-white px-2.5 rounded-r flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" placeholder="Name"
                    className={nameErr ? errCls : inputCls}
                    value={form.name} onChange={e => set('name', e.target.value)} />
                  {nameErr && <p className="mt-0.5 text-xs text-red-600">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    Unit Of Measurement (Symbol) {form.type !== 'service' && <span className="text-red-500">*</span>}
                    <span title="The symbol/abbreviation for how this product is measured (e.g. PCS, KG, LTR)"
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-400 text-white text-[9px] font-bold cursor-help ml-0.5">i</span>
                  </label>
                  <select className={uomErr ? errCls : inputCls}
                    value={form.unit_of_measurement}
                    onChange={e => set('unit_of_measurement', e.target.value)}>
                    <option value="">(eg. each, pc, kg, lt)</option>
                    {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {uomErr && <p className="mt-0.5 text-xs text-red-600">Unit is required.</p>}
                </div>
              </div>

              {/* Fractional units */}
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-gray-300"
                    checked={form.fractional_units}
                    onChange={e => set('fractional_units', e.target.checked)} />
                  <span className="text-sm text-gray-800">
                    Do you sell or purchase in fractional units?{' '}
                    <span className="text-blue-500 text-xs">(e.g. 0.5 kg, 2.25 lt, etc.)</span>
                  </span>
                </label>
                {form.fractional_units && (
                  <div className="ml-7 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="frac_mode" className="w-4 h-4 accent-gray-400"
                        checked={fractionalMode === 'price'} onChange={() => setFractionalMode('price')} />
                      <span className="text-sm font-semibold text-gray-600">Change price on transaction documents when amount updated.</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="frac_mode" className="w-4 h-4 accent-gray-400"
                        checked={fractionalMode === 'qty'} onChange={() => setFractionalMode('qty')} />
                      <span className="text-sm font-semibold text-gray-600">Change quantity on transaction documents when amount updated.</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Calculation field */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-gray-300" />
                <span className="text-sm text-gray-800">
                  Do you want to have a calculation field to calculate product quantity?{' '}
                  <span className="text-blue-500 text-xs">(e.g. 10 * 10 = 100 sq.ft, 10 * 10 * 10 = 1000 cb.ft, etc.)</span>
                </span>
              </label>

              <hr className="border-gray-200" />

              {/* 3rd Schedule */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                <span className="text-sm text-gray-800">
                  Does your product fall under 3<sup>rd</sup> Schedule Category?
                </span>
              </label>

              {/* Track Inventory */}
              {form.type !== 'service' && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300"
                    disabled={isEdit}
                    checked={form.track_inventory}
                    onChange={e => set('track_inventory', e.target.checked)} />
                  <span className={`text-sm ${isEdit ? 'text-gray-400' : 'text-gray-800'}`}>
                    Track Inventory{' '}
                    <span className="text-orange-500 text-xs">(Cannot be changed once product created.)</span>
                  </span>
                </label>
              )}

              {/* Inventory sub-options */}
              {form.track_inventory && form.type !== 'service' && (
                <div className="space-y-3">
                  {[
                    { key: 'manage_batch',  label: 'Do you manage batch for this product?',        hint: '(Cannot be changed once product created.)' },
                    { key: 'manage_serial', label: 'Do you manage serial number for this product?', hint: '(Cannot be changed once product created.)' },
                    { key: 'has_packaging', label: 'Do you want packaging for this product?',       hint: '(Cannot be changed once product created.)' },
                    { key: 'is_assembled',  label: 'Do you assemble this product?',                 hint: '(Cannot be changed once checked on and saved.)' },
                  ].map(({ key, label, hint }) => (
                    <label key={key} className={`flex items-center gap-2.5 cursor-pointer ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" disabled={isEdit} className="w-4 h-4 rounded border-gray-300"
                        checked={form[key as keyof ProductFormData] as boolean}
                        onChange={e => set(key as keyof ProductFormData, e.target.checked)} />
                      <span className="text-sm text-gray-800">
                        {label}{' '}
                        <span className="text-orange-500 text-xs">{hint}</span>
                      </span>
                    </label>
                  ))}

                  {/* Inventory Account */}
                  <div className="pt-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Account</label>
                    <select className={selectCls + ' w-56'} value={inventoryAccount} onChange={e => setInventoryAccount(e.target.value)}>
                      <option>Inventory</option>
                      <option>Raw Materials</option>
                      <option>Finished Goods</option>
                      <option>Work In Progress</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Do you purchase this product? */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-green-500"
                    checked={form.is_purchased}
                    onChange={e => set('is_purchased', e.target.checked)} />
                  <span className="text-sm text-gray-800">Do you purchase this product?</span>
                </label>
                {form.is_purchased && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (PKR)</label>
                        <input type="number" min="0" step="0.01" placeholder="Purchase Price"
                          className={errors.purchase_price ? errCls : inputCls} value={form.purchase_price}
                          onChange={e => set('purchase_price', e.target.value)} />
                        {errors.purchase_price && <p className="mt-0.5 text-xs text-red-600">{errors.purchase_price}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expense Account</label>
                        <select className={selectCls + ' w-full'} value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)}>
                          <option>Cost of Goods Sold</option>
                          <option>Direct Expenses</option>
                          <option>Other Expenses</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Discount Account</label>
                        <select className={selectCls + ' w-full'} value={purchaseDiscAcc} onChange={e => setPurchaseDiscAcc(e.target.value)}>
                          <option>Discounts Received</option>
                          <option>Other Income</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Taxes</label>
                        <button type="button" onClick={() => setTab('taxes')} className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Manage Taxes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Do you sale this product? */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-green-500"
                    checked={form.is_sold}
                    onChange={e => set('is_sold', e.target.checked)} />
                  <span className="text-sm text-gray-800">Do you sale this product?</span>
                </label>
                {form.is_sold && (
                  <div className="space-y-3">
                    {/* Don't allow public access */}
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded border-gray-300"
                        checked={form.dont_allow_public}
                        onChange={e => set('dont_allow_public', e.target.checked)} />
                      <span className="text-sm text-gray-800">Don't allow public access</span>
                    </label>

                    {/* Sale Price row */}
                    <div className="grid grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (PKR)</label>
                        <input type="number" min="0" step="0.01" placeholder="Sale Price"
                          className={errors.sale_price ? errCls : inputCls} value={form.sale_price}
                          onChange={e => set('sale_price', e.target.value)} />
                        {errors.sale_price && <p className="mt-0.5 text-xs text-red-600">{errors.sale_price}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sales Account</label>
                        <select className={selectCls + ' w-full'} value={salesAccount} onChange={e => setSalesAccount(e.target.value)}>
                          <option>Sales</option>
                          <option>Revenue</option>
                          <option>Other Income</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sales Discount Account</label>
                        <select className={selectCls + ' w-full'} value={salesDiscAcc} onChange={e => setSalesDiscAcc(e.target.value)}>
                          <option>Discounts Given</option>
                          <option>Other Expenses</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sale Tax</label>
                        <select className={selectCls + ' w-full'} value={form.sale_tax_id}
                          onChange={e => set('sale_tax_id', e.target.value)}>
                          <option value="">No tax</option>
                          {taxes.filter(t => t.applies_to_sales).map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* MRP row */}
                    <div className="grid grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Retail Price (PKR)</label>
                        <input type="number" min="0" step="0.01" placeholder="Retail Price"
                          className={errors.mrp ? errCls : inputCls} value={form.mrp}
                          onChange={e => set('mrp', e.target.value)} />
                        {errors.mrp && <p className="mt-0.5 text-xs text-red-600">{errors.mrp}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sales Return Account</label>
                        <select className={selectCls + ' w-full'} value={salesReturnAcc} onChange={e => setSalesReturnAcc(e.target.value)}>
                          <option>Sales Return</option>
                          <option>Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Is retail price exclusive of tax */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-gray-300"
                        checked={form.mrp_exclusive_of_tax}
                        onChange={e => set('mrp_exclusive_of_tax', e.target.checked)} />
                      <span className="text-sm text-gray-800">Is retail price exclusive of tax?</span>
                    </label>

                    {/* MRP description */}
                    <p className="text-xs text-blue-500 leading-relaxed">
                      (A maximum retail price (MRP) is a manufacturer calculated price that is the highest price that can be charged for a product sold, used for calculating tax if configured. Sale price is used for trading.)
                    </p>
                  </div>
                )}
              </div>

              {/* Product openings note */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  To add <strong>product openings</strong>, please create a Stock Adjustment and select adjustment type 'Openings'.
                </p>
              </div>
            </div>
          )}

          {/* ══ DETAIL TAB ═══════════════════════════════════════════════════ */}
          {tab === 'detail' && (
            <div className="flex gap-6">
              {/* Left column: fields (3-col grid) */}
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-4">
                  {/* Product Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
                    <select className={inputCls} value={form.category_id}
                      onChange={e => set('category_id', e.target.value)}>
                      <option value="">Type to search product category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Principal (preferred/primary vendor for this product) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Principal</label>
                    <select className={inputCls} value={form.principal_vendor_id}
                      onChange={e => set('principal_vendor_id', e.target.value)}>
                      <option value="">-Choose-</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                    </select>
                  </div>

                  {/* Product Short Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Short Name</label>
                    <input type="text" placeholder="Product Short Name" className={inputCls}
                      value={shortName} onChange={e => setShortName(e.target.value)} />
                  </div>

                  {/* SKU */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                    <input type="text" placeholder="SKU" className={inputCls}
                      value={sku} onChange={e => setSku(e.target.value)} />
                  </div>

                  {/* Product Barcode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Barcode</label>
                    <input type="text" placeholder="Product Barcode" className={inputCls}
                      value={barcode} onChange={e => setBarcode(e.target.value)} />
                  </div>

                  {/* Brand */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <select className={inputCls} value={form.brand_id}
                      onChange={e => set('brand_id', e.target.value)}>
                      <option value="">Type to search brand</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight <span className="text-orange-500 text-xs">(Please provide in kg )</span>
                    </label>
                    <input type="text" placeholder="Weight" className={inputCls}
                      value={weight} onChange={e => setWeight(e.target.value)} />
                  </div>

                  {/* Height */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Height <span className="text-orange-500 text-xs">(Please provide in inches )</span>
                    </label>
                    <input type="text" placeholder="Height" className={inputCls}
                      value={height} onChange={e => setHeight(e.target.value)} />
                  </div>

                  {/* Width */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Width <span className="text-orange-500 text-xs">(Please provide in inches )</span>
                    </label>
                    <input type="text" placeholder="Width" className={inputCls}
                      value={width} onChange={e => setWidth(e.target.value)} />
                  </div>

                  {/* Length */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Length <span className="text-orange-500 text-xs">(Please provide in inches )</span>
                    </label>
                    <input type="text" placeholder="Length" className={inputCls}
                      value={length} onChange={e => setLength(e.target.value)} />
                  </div>

                  {/* Model Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model Number</label>
                    <input type="text" placeholder="Product Model Number" className={inputCls}
                      value={modelNumber} onChange={e => setModelNumber(e.target.value)} />
                  </div>

                  {/* HS Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HS Code</label>
                    <input type="text" placeholder="e.g. 8517.12" className={inputCls}
                      value={form.hs_code} onChange={e => set('hs_code', e.target.value)} />
                  </div>

                  {/* Short Description */}
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                    <input type="text" placeholder="Short Description" className={inputCls}
                      value={form.short_description} onChange={e => set('short_description', e.target.value)} />
                  </div>

                  {/* Description */}
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea placeholder="Description" className={inputCls + ' resize-none'}
                      rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Right column: Product image */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full border-2 border-gray-300 flex items-center justify-center bg-gray-50">
                  {form.image ? (
                    <img src={form.image} alt="Product" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[9px] text-gray-400 font-medium">IMAGE</span>
                    </div>
                  )}
                </div>
                <input type="file" ref={imageInputRef} accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                <button type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="mt-4 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  Choose image
                </button>
              </div>
            </div>
          )}

          {tab === 'custom'   && <CustomFieldsTab entityType="product" entityId={product?.id ?? null} />}
          {tab === 'packings' && <PlaceholderTab label="Multiple Packings/SKUs" />}

          {/* ══ CATALOG TAB ════════════════════════════════════════════════════ */}
          {tab === 'catalog' && (
            <div className="space-y-5">
              {/* Rich Text Editor */}
              <div>
                {/* Toolbar - Complete Splendid-style toolbar */}
                <div className="flex items-center flex-wrap gap-0.5 p-2 border border-gray-300 bg-white rounded-t">
                  {/* Undo/Redo */}
                  <button type="button" onClick={() => execCommand('undo')} title="Undo" className="p-1.5 text-gray-700 hover:bg-gray-100 rounded text-sm">≡</button>
                  <button type="button" onClick={() => execCommand('redo')} title="Redo" className="p-1.5 text-gray-700 hover:bg-gray-100 rounded text-sm">⟲</button>

                  {/* Separator */}
                  <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

                  {/* Text Formatting */}
                  <button type="button" onClick={() => execCommand('bold')} title="Bold" className="px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded font-bold text-sm">B</button>
                  <button type="button" onClick={() => execCommand('italic')} title="Italic" className="px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded italic text-sm">I</button>
                  <button type="button" onClick={() => execCommand('underline')} title="Underline" className="px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded underline text-sm">U</button>
                  <button type="button" onClick={() => execCommand('strikethrough')} title="Strikethrough" className="px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded line-through text-sm">S</button>

                  {/* Separator */}
                  <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

                  {/* Font Selection */}
                  <select onChange={(e) => execCommand('fontname', e.target.value)} defaultValue="Segoe UI" className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:border-gray-400">
                    <option>Segoe UI</option>
                    <option>Arial</option>
                    <option>Georgia</option>
                    <option>Times New Roman</option>
                    <option>Courier New</option>
                  </select>

                  {/* Font Size */}
                  <select onChange={(e) => execCommand('fontsize', e.target.value)} defaultValue="3" className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:border-gray-400">
                    <option value="1">8 pt</option>
                    <option value="2">10 pt</option>
                    <option value="3">12 pt</option>
                    <option value="4">14 pt</option>
                    <option value="5">16 pt</option>
                    <option value="6">18 pt</option>
                    <option value="7">20 pt</option>
                  </select>

                  {/* Separator */}
                  <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

                  {/* Text Color */}
                  <input type="color" onChange={(e) => execCommand('forecolor', e.target.value)} defaultValue="#000000"
                    title="Text Color" className="w-8 h-7 border border-gray-300 rounded cursor-pointer" />

                  {/* Highlight */}
                  <input type="color" onChange={(e) => execCommand('backcolor', e.target.value)} defaultValue="#FFFF00"
                    title="Highlight Color" className="w-8 h-7 border border-gray-300 rounded cursor-pointer bg-yellow-300" />

                  {/* Separator */}
                  <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

                  {/* Subscript/Superscript */}
                  <button type="button" onClick={() => execCommand('subscript')} title="Subscript" className="px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded text-xs">X<sub>2</sub></button>
                  <button type="button" onClick={() => execCommand('superscript')} title="Superscript" className="px-2 py-1.5 text-gray-700 hover:bg-gray-100 rounded text-xs">X<sup>2</sup></button>

                  {/* Separator */}
                  <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

                  {/* Paragraph & Headings */}
                  <select onChange={(e) => {
                    if (e.target.value === 'p') execCommand('formatblock', '<p>');
                    else execCommand('formatblock', `<${e.target.value}>`);
                  }} defaultValue="p" className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:border-gray-400">
                    <option value="p">Paragraph</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                  </select>

                  {/* Lists */}
                  <button type="button" onClick={() => execCommand('insertunorderedlist')} title="Bullet List" className="p-1.5 text-gray-700 hover:bg-gray-100 rounded text-sm">≡</button>
                  <button type="button" onClick={() => execCommand('insertorderedlist')} title="Numbered List" className="p-1.5 text-gray-700 hover:bg-gray-100 rounded text-sm">≣</button>

                  {/* Separator */}
                  <div className="w-px h-5 bg-gray-300 mx-0.5"></div>

                  {/* Link */}
                  <button type="button" onClick={() => { const url = window.prompt('Enter URL:', 'https://'); if (url) execCommand('createlink', url); }}
                    title="Insert Link" className="p-1.5 text-gray-700 hover:bg-gray-100 rounded text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                  </button>
                </div>

                {/* Editor Area - Rich Content Area */}
                <div className="relative border border-t-0 border-gray-300 rounded-b bg-white">
                  {catalogContent === '' && (
                    <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm">
                      Enter product catalog content...
                    </div>
                  )}
                  <div contentEditable
                    ref={editorRef}
                    onInput={(e) => {
                      const content = (e.currentTarget as HTMLDivElement).innerHTML;
                      setCatalogContent(content);
                    }}
                    onBlur={(e) => {
                      const content = (e.currentTarget as HTMLDivElement).innerHTML;
                      setCatalogContent(content);
                    }}
                    className="w-full px-4 py-4 text-sm text-gray-800 focus:outline-none min-h-[300px] overflow-auto"
                    suppressContentEditableWarning
                  />
              </div>
              </div>

              {/* Gallery Images */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-6">Gallery Images</h3>

                {/* Upload Area - Splendid Style */}
                <div className="mb-4">
                  {galleryImages.length === 0 ? (
                    <div
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 cursor-pointer hover:border-gray-400 transition-colors bg-gray-50">
                      <div className="text-center">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-gray-500 font-medium">Upload Images</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {galleryImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} alt={`Gallery ${idx}`} className="w-full h-40 object-cover rounded border border-gray-200 shadow-sm" />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(idx)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm font-bold shadow-md">
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload Input & Button */}
                <input type="file" ref={galleryInputRef} accept="image/*" multiple onChange={handleGalleryImagesSelect} style={{ display: 'none' }} />
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-4 py-2.5 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  + Add Images
                </button>
              </div>
            </div>
          )}

          {tab === 'stock'    && <PlaceholderTab label="Stock Level" />}
          {/* ══ TAXES TAB ══════════════════════════════════════════════════════ */}
          {tab === 'taxes' && (
            <div className="grid grid-cols-2 gap-8">
              {/* Taxes On Sale */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Taxes On Sale</h3>
                  <button
                    type="button"
                    onClick={() => setShowSaleTaxModal(true)}
                    className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5"/></svg>
                    ADD
                  </button>
                </div>

                {/* Taxes Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {taxesOnSale.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      No taxes added. Click ADD to add taxes on sale.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Tax Name</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Rate (%)</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxesOnSale.map(tax => (
                          <tr key={tax.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-800">{tax.name}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{tax.rate}%</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeTaxFromSale(tax.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors text-sm">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Taxes On Purchase */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Taxes On Purchase</h3>
                  <button
                    type="button"
                    onClick={() => setShowPurchTaxModal(true)}
                    className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5"/></svg>
                    ADD
                  </button>
                </div>

                {/* Taxes Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {taxesOnPurchase.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      No taxes added. Click ADD to add taxes on purchase.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Tax Name</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Rate (%)</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxesOnPurchase.map(tax => (
                          <tr key={tax.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-800">{tax.name}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{tax.rate}%</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeTaxFromPurchase(tax.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors text-sm">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Tax Configuration Modal - Sales */}
              {showSaleTaxModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-900">Sale Taxes</h4>
                      <button
                        type="button"
                        onClick={() => { setShowSaleTaxModal(false); setSelectedSaleTax(null); }}
                        className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-4">
                      {/* No tax selected message */}
                      {!selectedSaleTax && (
                        <div className="text-blue-500 text-sm font-medium">No tax selected</div>
                      )}

                      {/* Tax Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax:</label>
                        <select
                          value={selectedSaleTax?.id || ''}
                          onChange={(e) => {
                            const tax = taxes.find(t => t.id === Number(e.target.value));
                            setSelectedSaleTax(tax || null);
                          }}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                          <option value="">-Choose-</option>
                          {taxes.filter(t => t.applies_to_sales && !taxesOnSale.find(st => st.id === t.id)).map(tax => (
                            <option key={tax.id} value={tax.id}>{tax.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Applied On */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Applied On:</label>
                        <select
                          value={saleAppliedOn}
                          onChange={(e) => setSaleAppliedOn(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                          <option>Sale Price</option>
                          <option>Maximum Retail Price</option>
                          <option>Purchase Price</option>
                          <option>Compound</option>
                        </select>
                      </div>

                      {/* Tax Calculation */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tax Calculation</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="saleCalcMode"
                              value="before"
                              checked={saleCalcMode === 'before'}
                              onChange={() => setSaleCalcMode('before')}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Before Discount</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="saleCalcMode"
                              value="after"
                              checked={saleCalcMode === 'after'}
                              onChange={() => setSaleCalcMode('after')}
                              className="w-4 h-4 accent-green-500"
                            />
                            <span className="text-sm text-gray-700">After Discount</span>
                          </label>
                        </div>
                      </div>

                      {/* ADD Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSaleTax) {
                            addTaxToSale(selectedSaleTax);
                            setShowSaleTaxModal(false);
                            setSelectedSaleTax(null);
                          }
                        }}
                        disabled={!selectedSaleTax}
                        className={`w-full py-2 rounded text-sm font-medium transition-colors ${
                          selectedSaleTax
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}>
                        + ADD
                      </button>
                    </div>

                    {/* Modal Footer */}
                    <div className="border-t border-gray-200 p-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setShowSaleTaxModal(false); setSelectedSaleTax(null); }}
                        className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-white font-medium rounded transition-colors">
                        × CLOSE
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tax Configuration Modal - Purchase */}
              {showPurchTaxModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-900">Purchase Taxes</h4>
                      <button
                        type="button"
                        onClick={() => { setShowPurchTaxModal(false); setSelectedPurchTax(null); }}
                        className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 space-y-4">
                      {/* No tax selected message */}
                      {!selectedPurchTax && (
                        <div className="text-blue-500 text-sm font-medium">No tax selected</div>
                      )}

                      {/* Tax Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax:</label>
                        <select
                          value={selectedPurchTax?.id || ''}
                          onChange={(e) => {
                            const tax = taxes.find(t => t.id === Number(e.target.value));
                            setSelectedPurchTax(tax || null);
                          }}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                          <option value="">-Choose-</option>
                          {taxes.filter(t => t.applies_to_purchases && !taxesOnPurchase.find(pt => pt.id === t.id)).map(tax => (
                            <option key={tax.id} value={tax.id}>{tax.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Applied On */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Applied On:</label>
                        <select
                          value={purchAppliedOn}
                          onChange={(e) => setPurchAppliedOn(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                          <option>Purchase Price</option>
                          <option>Sale Price</option>
                          <option>Maximum Retail Price</option>
                          <option>Compound</option>
                        </select>
                      </div>

                      {/* Tax Calculation */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tax Calculation</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="purchCalcMode"
                              value="before"
                              checked={purchCalcMode === 'before'}
                              onChange={() => setPurchCalcMode('before')}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Before Discount</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="purchCalcMode"
                              value="after"
                              checked={purchCalcMode === 'after'}
                              onChange={() => setPurchCalcMode('after')}
                              className="w-4 h-4 accent-green-500"
                            />
                            <span className="text-sm text-gray-700">After Discount</span>
                          </label>
                        </div>
                      </div>

                      {/* ADD Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPurchTax) {
                            addTaxToPurchase(selectedPurchTax);
                            setShowPurchTaxModal(false);
                            setSelectedPurchTax(null);
                          }
                        }}
                        disabled={!selectedPurchTax}
                        className={`w-full py-2 rounded text-sm font-medium transition-colors ${
                          selectedPurchTax
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}>
                        + ADD
                      </button>
                    </div>

                    {/* Modal Footer */}
                    <div className="border-t border-gray-200 p-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setShowPurchTaxModal(false); setSelectedPurchTax(null); }}
                        className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-white font-medium rounded transition-colors">
                        × CLOSE
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-0 border-t border-gray-200 px-6 py-4 bg-white shrink-0">
          <button type="button" onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-l transition-colors disabled:opacity-50">
            {saving ? 'SAVING…' : 'SAVE AND NEW'}
          </button>
          <button type="button" onClick={() => handleSave(false)} disabled={saving}
            className="flex items-center bg-gray-300 hover:bg-gray-400 text-gray-700 px-2 py-2.5 rounded-r border-l border-gray-400 transition-colors disabled:opacity-50">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </button>
          <button type="button" onClick={onClose} disabled={saving}
            className="ml-3 flex items-center gap-1.5 bg-orange-400 hover:bg-orange-500 text-white text-sm font-semibold px-5 py-2.5 rounded transition-colors disabled:opacity-50">
            × CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
