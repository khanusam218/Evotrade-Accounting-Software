import { useCallback, useEffect, useRef, useState } from 'react';
import VendorForm from '../components/VendorForm';
import { createVendor, deleteVendor, getVendorCategories, getVendors } from '../api/vendors';
import type { Vendor, VendorCategory, VendorFilters } from '../types/vendor';

const PAGE_SIZE = 50;

function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 align-middle">
      <svg className="w-2.5 h-2.5 -mb-0.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5l8 8H4z"/></svg>
      <svg className="w-2.5 h-2.5 -mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19l-8-8h16z"/></svg>
    </span>
  );
}

function ToolBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded transition-colors ${
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {icon} {label}
    </button>
  );
}

const PrintSVG  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const ExcelSVG  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></svg>;
const ImportSVG = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const FilterSVG = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>;
const TrashSVG  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EditSVG   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;

interface PendingFilters { code: string; name: string; category_id: string; is_active: string; }
const emptyFilters: PendingFilters = { code: '', name: '', category_id: '', is_active: '' };

export default function VendorsPage() {
  const [vendors,    setVendors]    = useState<Vendor[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [perPage,    setPerPage]    = useState(PAGE_SIZE);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; fail: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<PendingFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<VendorFilters>({});
  const filterRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  useEffect(() => {
    getVendorCategories().then(setCategories).catch(() => {});
  }, []);

  const fetchVendors = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await getVendors({ ...appliedFilters, page, limit: perPage });
      setVendors(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, perPage]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function applyFilters() {
    setPage(1);
    setAppliedFilters({
      code:        pendingFilters.code        || undefined,
      name:        pendingFilters.name        || undefined,
      category_id: pendingFilters.category_id || undefined,
      is_active:   pendingFilters.is_active   || undefined,
    });
    setShowFilters(false);
  }

  function clearFilters() {
    setPendingFilters(emptyFilters);
    setPage(1);
    setAppliedFilters({});
    setShowFilters(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this vendor?')) return;
    setDeletingId(id);
    try { await deleteVendor(id); fetchVendors(); }
    catch { alert('Could not delete vendor.'); }
    finally { setDeletingId(null); }
  }

  async function handlePrint() {
    try {
      const all = await getVendors({ ...appliedFilters, page: 1, limit: 10000 });
      const headers = ['Code', 'Name', 'Category', 'Contact Person', 'Email', 'Phone', 'Status'];
      const rows = all.data.map(v => [
        v.code, v.print_name, v.category_name ?? '', v.contact_person ?? '',
        v.email ?? '', v.phone_1 ?? '', v.is_active ? 'Active' : 'Inactive',
      ]);
      const w = window.open('', '_blank', 'width=900,height=600');
      if (!w) return;
      const body = rows.map(r =>
        `<tr>${r.map(c => `<td style="padding:6px 12px;border-bottom:1px solid #eee">${c}</td>`).join('')}</tr>`
      ).join('');
      w.document.write(`<!DOCTYPE html><html><head><title>Vendors</title>
        <style>body{font-family:sans-serif;padding:20px}h1{font-size:18px;margin-bottom:16px}
        table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:13px}
        td{font-size:13px}@media print{body{padding:0}}</style></head>
        <body><h1>Vendors</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody></table></body></html>`);
      w.document.close(); w.focus(); w.print();
    } catch (e: any) { setError(e.message); }
  }

  async function handleExport() {
    try {
      const all = await getVendors({ ...appliedFilters, page: 1, limit: 10000 });
      const headers = ['Code', 'Name', 'Category', 'Contact Person', 'Email', 'Phone', 'Status'];
      const rows = all.data.map(v => [
        v.code, v.print_name, v.category_name ?? '', v.contact_person ?? '',
        v.email ?? '', v.phone_1 ?? '', v.is_active ? 'Active' : 'Inactive',
      ]);
      const escape = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vendors.csv';
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
      try {
        await createVendor({
          print_name: name,
          email: get(col('email')),
          phone_1: get(col('phone')),
          phone_2: '',
          category_id: '',
          opening_balance: 0,
          credit_limit_days: 0,
          is_principal: false,
          contact_person: get(col('contact person')),
          address: get(col('address')),
          is_active: true,
        });
        ok++;
      } catch { fail++; }
    }

    setImporting(false);
    setImportResult({ ok, fail });
    fetchVendors();
  }

  function handleEdit(v: Vendor)  { setEditTarget(v); setShowForm(true); }
  function handleAdd()             { setEditTarget(null); setShowForm(true); }
  function handleFormSaved()       { setShowForm(false); setEditTarget(null); fetchVendors(); }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';

  if (showForm) return (
        <VendorForm
      vendor={editTarget}
      onClose={() => { setShowForm(false); setEditTarget(null); }}
      onSaved={handleFormSaved}
      onRefresh={fetchVendors}
    />
  );

  return (
    <div className="p-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-5 py-2 rounded transition-colors"
        >
          + ADD VENDOR
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-4 relative">
        {/* FILTERS — left */}
        <div className="relative" ref={filterRef}>
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

          {showFilters && (
            <div className="absolute top-10 left-0 z-50 bg-white border-2 border-green-500 rounded-lg shadow-2xl w-96 p-5">
              <button
                onClick={() => setShowFilters(false)}
                className="absolute -top-4 -right-4 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow-md z-10"
              >×</button>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input className={inputCls} placeholder="V-000001"
                    value={pendingFilters.code}
                    onChange={e => setPendingFilters(f => ({ ...f, code: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input className={inputCls} placeholder="Search name..."
                    value={pendingFilters.name}
                    onChange={e => setPendingFilters(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select className={inputCls}
                    value={pendingFilters.category_id}
                    onChange={e => setPendingFilters(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">All</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className={inputCls}
                    value={pendingFilters.is_active}
                    onChange={e => setPendingFilters(f => ({ ...f, is_active: e.target.value }))}>
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                <button onClick={applyFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors">
                  SAVE FILTER
                </button>
                <button onClick={applyFilters}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-4 py-1.5 rounded transition-colors">
                  APPLY
                </button>
                <button onClick={clearFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors">
                  CLEAR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right-side buttons */}
        <div className="flex items-center gap-2">
          <ToolBtn icon={<PrintSVG />}  label="PRINT"           onClick={handlePrint} />
          <ToolBtn icon={<ExcelSVG />}  label="EXPORT TO EXCEL" onClick={handleExport} />
          <ToolBtn icon={<ImportSVG />} label={importing ? 'IMPORTING...' : 'IMPORT'} disabled={importing} onClick={() => importInputRef.current?.click()} />
          <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

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
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Code <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Name <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Category <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Contact Person <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Email <SortIcon /></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone <SortIcon /></th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading...
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">No vendors found</td>
              </tr>
            ) : (
              vendors.map(v => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <button className="text-blue-600 hover:underline text-sm font-medium" onClick={() => handleEdit(v)}>
                      {v.code}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button className="text-blue-600 hover:underline text-sm font-medium" onClick={() => handleEdit(v)}>
                      {v.print_name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{v.category_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{v.contact_person ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{v.email ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{v.phone_1 ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button title="Edit" onClick={() => handleEdit(v)}
                        className="text-gray-400 hover:text-green-500 transition-colors p-1">
                        <EditSVG />
                      </button>
                      <button title="Delete" onClick={() => handleDelete(v.id)}
                        disabled={deletingId === v.id}
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
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-l text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 flex items-center justify-center border-t border-b border-r border-gray-300 text-sm font-medium transition-colors ${
                p === page ? 'bg-green-500 text-white border-green-500' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-r text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <select
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none"
          value={perPage}
          onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
        >
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}
