import { useCallback, useEffect, useRef, useState } from 'react';
import ProductForm from '../components/ProductForm';
import { createProduct, deleteProduct, getBrands, getProductCategories, getProducts } from '../api/products';
import { getVendors } from '../api/vendors';
import type { Vendor } from '../types/vendor';
import type { Brand, Product, ProductCategory, ProductFilters, ProductType } from '../types/product';

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<ProductType, string> = {
  product:         'Product',
  service:         'Service',
  product_variant: 'Variant',
};

function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 align-middle">
      <svg className="w-2.5 h-2.5 -mb-0.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5l8 8H4z"/></svg>
      <svg className="w-2.5 h-2.5 -mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19l-8-8h16z"/></svg>
    </span>
  );
}

function ToolBtn({ icon, label, onClick, disabled, red }: {
  icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; red?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded transition-colors ${
        disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
        : red     ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}>
      {icon} {label}
    </button>
  );
}

const PrintSVG      = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const ExcelSVG      = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></svg>;
const ImportSVG     = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const FilterSVG     = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>;
const TrashSVG      = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EditSVG       = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;

interface PendingFilters {
  code: string; name: string; type: string; category_id: string;
  brand_id: string; principal_vendor_id: string; is_active: string;
  sale_price_from: string; sale_price_to: string;
}
const emptyFilters: PendingFilters = {
  code: '', name: '', type: '', category_id: '',
  brand_id: '', principal_vendor_id: '', is_active: '',
  sale_price_from: '', sale_price_to: '',
};

function NoImage() {
  return (
    <div className="w-10 h-10 bg-gray-100 border border-gray-200 rounded flex flex-col items-center justify-center gap-0.5">
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-[7px] text-gray-400 font-medium leading-none">NO IMAGE</span>
    </div>
  );
}

export default function ProductsPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [perPage,    setPerPage]    = useState(PAGE_SIZE);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands,     setBrands]     = useState<Brand[]>([]);
  const [vendors,    setVendors]    = useState<Vendor[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; fail: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<PendingFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>({});

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  useEffect(() => {
    getProductCategories().then(setCategories).catch(() => {});
    getBrands().then(setBrands).catch(() => {});
    getVendors({ limit: 500 }).then(r => setVendors(r.data)).catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await getProducts({ ...appliedFilters, page, limit: perPage });
      setProducts(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [appliedFilters, page, perPage]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function applyFilters() {
    setPage(1);
    setAppliedFilters({
      code:        pendingFilters.code        || undefined,
      name:        pendingFilters.name        || undefined,
      type:        pendingFilters.type        || undefined,
      category_id: pendingFilters.category_id || undefined,
      brand_id:    pendingFilters.brand_id    || undefined,
      principal_vendor_id: pendingFilters.principal_vendor_id || undefined,
      is_active:   pendingFilters.is_active   || undefined,
    });
    setShowFilters(false);
  }

  function clearFilters() {
    setPendingFilters(emptyFilters);
    setPage(1); setAppliedFilters({});
    setShowFilters(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this product?')) return;
    setDeletingId(id);
    try { await deleteProduct(id); fetchProducts(); }
    catch { alert('Could not delete product.'); }
    finally { setDeletingId(null); }
  }

  async function handleDeleteSelected() {
    if (!window.confirm(`Delete ${selected.size} selected product(s)?`)) return;
    for (const id of selected) { try { await deleteProduct(id); } catch {} }
    setSelected(new Set());
    fetchProducts();
  }

  async function handlePrint() {
    try {
      const all = await getProducts({ ...appliedFilters, page: 1, limit: 10000 });
      const headers = ['Code', 'Name', 'Type', 'Category', 'Brand', 'Sale Price', 'Status'];
      const rows = all.data.map(p => [
        p.code, p.name, TYPE_LABELS[p.type], p.category_name ?? '', p.brand_name ?? '',
        p.sale_price != null ? p.sale_price.toLocaleString() : '', p.is_active ? 'Active' : 'Inactive',
      ]);
      const w = window.open('', '_blank', 'width=900,height=600');
      if (!w) return;
      const body = rows.map(r =>
        `<tr>${r.map(c => `<td style="padding:6px 12px;border-bottom:1px solid #eee">${c}</td>`).join('')}</tr>`
      ).join('');
      w.document.write(`<!DOCTYPE html><html><head><title>Products</title>
        <style>body{font-family:sans-serif;padding:20px}h1{font-size:18px;margin-bottom:16px}
        table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:13px}
        td{font-size:13px}@media print{body{padding:0}}</style></head>
        <body><h1>Products</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody></table></body></html>`);
      w.document.close(); w.focus(); w.print();
    } catch (e: any) { setError(e.message); }
  }

  async function handleExport() {
    try {
      const all = await getProducts({ ...appliedFilters, page: 1, limit: 10000 });
      const headers = ['Code', 'Name', 'Type', 'Category', 'Brand', 'Sale Price', 'Purchase Price', 'Status'];
      const rows = all.data.map(p => [
        p.code, p.name, p.type, p.category_name ?? '', p.brand_name ?? '',
        p.sale_price != null ? String(p.sale_price) : '',
        p.purchase_price != null ? String(p.purchase_price) : '',
        p.is_active ? 'Active' : 'Inactive',
      ]);
      const escape = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'products.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) { setError(e.message); }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true); setImportResult(null);

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setImporting(false); return; }

    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let cur = '', inQ = false;
      for (const ch of row) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
        else { cur += ch; }
      }
      result.push(cur);
      return result.map(c => c.trim());
    };

    const header = parseRow(lines[0]).map(h => h.toLowerCase());
    const col = (name: string) => header.indexOf(name);

    let ok = 0, fail = 0;
    for (let i = 1; i < lines.length; i++) {
      const cells = parseRow(lines[i]);
      const get = (idx: number) => (idx >= 0 ? cells[idx] ?? '' : '');
      const name = get(col('name')) || get(0);
      if (!name) { fail++; continue; }
      const rawType = get(col('type')).toLowerCase();
      const type = (['product', 'service', 'product_variant'] as const).includes(rawType as any)
        ? (rawType as 'product' | 'service' | 'product_variant') : 'product';
      try {
        await createProduct({
          name,
          type,
          category_id: '',
          brand_id: '',
          unit_of_measurement: 'Nos',
          fractional_units: false,
          track_inventory: false,
          manage_batch: false,
          manage_serial: false,
          has_packaging: false,
          is_assembled: false,
          is_purchased: true,
          purchase_price: get(col('purchase price')),
          purchase_tax_id: '',
          manage_purchase_tax: false,
          is_sold: true,
          sale_price: get(col('sale price')),
          sale_tax_id: '',
          mrp: '',
          mrp_exclusive_of_tax: false,
          dont_allow_public: false,
          is_active: true,
          description: '',
          short_description: '',
        });
        ok++;
      } catch { fail++; }
    }

    setImporting(false);
    setImportResult({ ok, fail });
    fetchProducts();
  }

  function handleEdit(p: Product) { setEditTarget(p); setShowForm(true); }
  function handleAdd()             { setEditTarget(null); setShowForm(true); }
  function handleFormSaved()       { setShowForm(false); setEditTarget(null); fetchProducts(); }

  const totalPages  = Math.max(1, Math.ceil(total / perPage));
  const allSelected = products.length > 0 && products.every(p => selected.has(p.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(products.map(p => p.id)));
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';

  if (showForm) return (
        <ProductForm
      key={editTarget ? editTarget.id : 'new'}
      product={editTarget}
      onClose={() => { setShowForm(false); setEditTarget(null); }}
      onSaved={handleFormSaved}
      onRefresh={fetchProducts}
      onSavedAndNew={() => setEditTarget(null)}
    />
  );

  return (
    <div className="p-6">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Products</h1>
        <button onClick={handleAdd}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
          + ADD PRODUCT
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {/* FILTERS — left */}
        <button
          onClick={() => setShowFilters(o => !o)}
          className="relative flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
        >
          <FilterSVG /> FILTERS
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-blue-800 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Right-side buttons */}
        <div className="flex items-center gap-2">
          <ToolBtn icon={<PrintSVG />}  label="PRINT"           onClick={handlePrint} />
          <ToolBtn icon={<ExcelSVG />}  label="EXPORT TO EXCEL" onClick={handleExport} />
          <ToolBtn icon={<ImportSVG />} label={importing ? 'IMPORTING...' : 'IMPORT'} disabled={importing} onClick={() => importInputRef.current?.click()} />
          <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          {selected.size > 0 && (
            <ToolBtn icon={<TrashSVG />} label="DELETE SELECTED PRODUCTS"
              red onClick={handleDeleteSelected} />
          )}
        </div>
      </div>

      {/* ── FILTERS overlay modal ─────────────────────────────────────────────── */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="fixed inset-0 bg-black/20" onClick={() => setShowFilters(false)} />
          <div className="relative bg-white border-2 border-green-500 rounded-lg shadow-2xl w-[620px] flex flex-col max-h-[calc(100vh-100px)]">
            {/* Floating red × */}
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-4 -right-4 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow-md z-10">
              ×
            </button>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-6">
              <div className="space-y-4">
                {/* Code */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Code</label>
                  <input className={inputCls} placeholder="Type to search code"
                    value={pendingFilters.code}
                    onChange={e => setPendingFilters(f => ({ ...f, code: e.target.value }))} />
                </div>
                {/* Name */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Name</label>
                  <input className={inputCls} placeholder="Type to search name"
                    value={pendingFilters.name}
                    onChange={e => setPendingFilters(f => ({ ...f, name: e.target.value }))} />
                </div>
                {/* Product Type */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Product Type</label>
                  <select className={inputCls} value={pendingFilters.type}
                    onChange={e => setPendingFilters(f => ({ ...f, type: e.target.value }))}>
                    <option value="">Select product type</option>
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                    <option value="product_variant">Product Variant</option>
                  </select>
                </div>
                {/* Product Category */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Product Category</label>
                  <select className={inputCls} value={pendingFilters.category_id}
                    onChange={e => setPendingFilters(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">Select product category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {/* Brand */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Brand</label>
                  <select className={inputCls} value={pendingFilters.brand_id}
                    onChange={e => setPendingFilters(f => ({ ...f, brand_id: e.target.value }))}>
                    <option value="">Select brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                {/* Sale Price From / To */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Sale Price</label>
                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-sm text-gray-500 shrink-0">From:</span>
                    <input type="number" min="0" step="0.01"
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                      placeholder="From"
                      value={pendingFilters.sale_price_from}
                      onChange={e => setPendingFilters(f => ({ ...f, sale_price_from: e.target.value }))} />
                    <span className="text-sm text-gray-500 shrink-0">To:</span>
                    <input type="number" min="0" step="0.01"
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                      placeholder="To"
                      value={pendingFilters.sale_price_to}
                      onChange={e => setPendingFilters(f => ({ ...f, sale_price_to: e.target.value }))} />
                  </div>
                </div>
                {/* Custom Field */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Custom Field</label>
                  <select className="border border-gray-300 rounded px-3 py-2 text-sm w-44 focus:outline-none focus:border-green-500">
                    <option value="">-Choose-</option>
                  </select>
                </div>
                {/* Principal */}
                <div className="flex items-center gap-4">
                  <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Principal</label>
                  <select className={inputCls} value={pendingFilters.principal_vendor_id}
                    onChange={e => setPendingFilters(f => ({ ...f, principal_vendor_id: e.target.value }))}>
                    <option value="">Select principal</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                  </select>
                </div>

                {/* SHOW MORE */}
                <div className="flex justify-end">
                  <button type="button"
                    className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                    SHOW MORE
                  </button>
                </div>
              </div>
            </div>

            {/* Footer — always visible at bottom */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-white rounded-b-lg shrink-0">
              <button onClick={applyFilters}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm font-medium px-5 py-2 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
                APPLY
              </button>
              <button onClick={clearFilters}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {importResult && (
        <div className={`mb-4 rounded-md px-4 py-3 text-sm flex items-center justify-between ${importResult.fail > 0 ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
          <span>Import complete: <strong>{importResult.ok}</strong> created{importResult.fail > 0 ? `, ${importResult.fail} failed` : ''}.</span>
          <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 ml-4">×</button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="w-4 h-4 rounded"
                  checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-2 py-3 w-14"></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Code <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Name <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Type <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Category <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Brand <SortIcon /></th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Sale Price <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status <SortIcon /></th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                  <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400">No products found</td>
              </tr>
            ) : (
              products.map(p => (
                <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selected.has(p.id) ? 'bg-blue-50' : ''
                }`}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" className="w-4 h-4 rounded"
                      checked={selected.has(p.id)}
                      onChange={() => setSelected(prev => {
                        const n = new Set(prev);
                        n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                        return n;
                      })} />
                  </td>
                  <td className="px-2 py-2.5"><NoImage /></td>
                  <td className="px-4 py-2.5">
                    <button className="text-blue-600 hover:underline text-sm font-medium" onClick={() => handleEdit(p)}>
                      {p.code}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{TYPE_LABELS[p.type]}</td>
                  <td className="px-4 py-2.5 text-gray-600">{p.category_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{p.brand_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {p.sale_price != null ? p.sale_price.toLocaleString() : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{p.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button title="Edit" onClick={() => handleEdit(p)}
                        className="text-gray-400 hover:text-green-500 transition-colors p-1">
                        <EditSVG />
                      </button>
                      <button title="Delete" onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-40">
                        <TrashSVG />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-0.5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-l text-gray-500 hover:bg-gray-50 disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 flex items-center justify-center border-t border-b border-r border-gray-300 text-sm font-medium transition-colors ${
                p === page ? 'bg-green-500 text-white border-green-500' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-r text-gray-500 hover:bg-gray-50 disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <select className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none"
          value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}
