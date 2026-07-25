import { useCallback, useEffect, useRef, useState } from 'react';
import CustomerForm from '../components/CustomerForm';
import {
  createCustomer,
  deleteCustomer,
  getCustomerCategories,
  getCustomers,
} from '../api/customers';
import type { Customer, CustomerCategory, CustomerFilters } from '../types/customer';

const PAGE_SIZE = 50;

// ── Sort icon (two triangles) ─────────────────────────────────────────────────
function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 align-middle">
      <svg className="w-2.5 h-2.5 -mb-0.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5l8 8H4z"/></svg>
      <svg className="w-2.5 h-2.5 -mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19l-8-8h16z"/></svg>
    </span>
  );
}

// ── Toolbar icon buttons ──────────────────────────────────────────────────────
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

// ── SVGs ──────────────────────────────────────────────────────────────────────
const PrintSVG  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const ExcelSVG  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" /></svg>;
const ImportSVG = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const BulkSVG   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const FilterSVG = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>;
const TrashSVG  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EditSVG   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const PortalSVG = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>;

// ── Filter types ──────────────────────────────────────────────────────────────
interface PendingFilters { code: string; name: string; category_id: string; is_active: string; }
const emptyFilters: PendingFilters = { code: '', name: '', category_id: '', is_active: '' };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [perPage,    setPerPage]    = useState(PAGE_SIZE);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing,  setImporting]  = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<PendingFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<CustomerFilters>({});
  const filterRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  useEffect(() => {
    getCustomerCategories().then(setCategories).catch(() => {});
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await getCustomers({ ...appliedFilters, page, limit: perPage });
      setCustomers(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, perPage]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Close filter modal on outside click
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
    if (!window.confirm('Delete this customer?')) return;
    setDeletingId(id);
    try { await deleteCustomer(id); fetchCustomers(); }
    catch { alert('Could not delete customer.'); }
    finally { setDeletingId(null); }
  }

  function handleEdit(c: Customer) { setEditTarget(c); setShowForm(true); }
  function handleAdd()              { setEditTarget(null); setShowForm(true); }
  function handleFormSaved()        { setShowForm(false); setEditTarget(null); fetchCustomers(); }

  async function handlePrint() {
    const all = await getCustomers({ ...appliedFilters, page: 1, limit: 99999 });
    const rows = all.data.map(c => `
      <tr>
        <td>${c.code}</td>
        <td>${c.print_name}</td>
        <td>${c.category_name ?? ''}</td>
        <td>${c.contact_person ?? ''}</td>
        <td>${c.email_1 ?? ''}</td>
        <td>${c.phone_1 ?? ''}</td>
      </tr>`).join('');
    const w = window.open('', '_blank')!;
    w.document.write(`<!DOCTYPE html><html><head><title>Customers</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f3f4f6;font-weight:600}
      h2{margin-bottom:8px}</style></head><body>
      <h2>Customers</h2>
      <table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Contact Person</th><th>Email</th><th>Phone</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.print();
  }

  async function handleExportExcel() {
    const all = await getCustomers({ ...appliedFilters, page: 1, limit: 99999 });
    const headers = ['Code', 'Name', 'Category', 'Contact Person', 'Email', 'Phone'];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(','),
      ...all.data.map(c => [c.code, c.print_name, c.category_name ?? '', c.contact_person ?? '', c.email_1 ?? '', c.phone_1 ?? ''].map(escape).join(',')),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadImportTemplate() {
    const headers = 'print_name,customer_name,display_name,contact_person,phone_1,email_1,is_active';
    const example = 'John Doe,John Doe Full,John,Jane Smith,03001234567,john@example.com,true';
    const blob = new Blob([[headers, example].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'customers_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportSubmit() {
    if (!importFile) return;
    setImporting(true); setImportError(null);
    try {
      const text = await importFile.text();
      const [headerLine, ...dataLines] = text.split(/\r?\n/).filter(l => l.trim());
      const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const parseRow = (line: string) => {
        const vals: string[] = [];
        let cur = '', inQ = false;
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; }
          else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
          else cur += ch;
        }
        vals.push(cur.trim());
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
      };
      const rows = dataLines.filter(l => l.trim()).map(parseRow);
      let successCount = 0;
      const errors: string[] = [];
      for (const [i, row] of rows.entries()) {
        try {
          await createCustomer({ ...row, is_active: row.is_active !== 'false' } as never);
          successCount++;
        } catch (e) {
          errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Failed'}`);
        }
      }
      if (errors.length) {
        setImportError(`Imported ${successCount}/${rows.length} rows.\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''}`);
      } else {
        setShowImport(false); setImportFile(null); fetchCustomers();
        alert(`Successfully imported ${successCount} customer(s).`);
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const allSelected = customers.length > 0 && customers.every(c => selected.has(c.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(customers.map(c => c.id)));
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';

  if (showForm) return (
        <CustomerForm
      customer={editTarget}
      onClose={() => { setShowForm(false); setEditTarget(null); }}
      onSaved={handleFormSaved}
    />
  );

  return (
    <div className="p-6">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-5 py-2 rounded transition-colors"
        >
          + ADD CUSTOMER
        </button>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-4 relative">
        {/* FILTERS button — left */}
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

          {/* FILTERS modal */}
          {showFilters && (
            <div className="absolute top-10 left-0 z-50 bg-white border-2 border-green-500 rounded-lg shadow-2xl w-96 p-5">
              {/* Floating red × */}
              <button
                onClick={() => setShowFilters(false)}
                className="absolute -top-4 -right-4 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow-md z-10"
              >×</button>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input className={inputCls} placeholder="C-000001"
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

              {/* Footer */}
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
          <ToolBtn icon={<BulkSVG />}   label="BULK PORTAL ACCESS" disabled />
          <ToolBtn icon={<PrintSVG />}  label="PRINT"           onClick={handlePrint} />
          <ToolBtn icon={<ExcelSVG />}  label="EXPORT TO EXCEL" onClick={handleExportExcel} />
          <ToolBtn icon={<ImportSVG />} label="IMPORT"          onClick={() => { setShowImport(true); setImportFile(null); setImportError(null); }} />
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="w-4 h-4 rounded"
                  checked={allSelected} onChange={toggleAll} />
              </th>
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
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">No customers found</td>
              </tr>
            ) : (
              customers.map(c => (
                <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selected.has(c.id) ? 'bg-blue-50' : ''
                }`}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" className="w-4 h-4 rounded"
                      checked={selected.has(c.id)}
                      onChange={() => setSelected(prev => {
                        const n = new Set(prev);
                        n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                        return n;
                      })} />
                  </td>
                  <td className="px-4 py-2.5">
                    <button className="text-blue-600 hover:underline text-sm font-medium"
                      onClick={() => handleEdit(c)}>
                      {c.code}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button className="text-blue-600 hover:underline text-sm font-medium"
                      onClick={() => handleEdit(c)}>
                      {c.print_name}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.category_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.contact_person ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.email_1 ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.phone_1 ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button title="Portal Access"
                        className="text-gray-400 hover:text-blue-500 transition-colors p-1">
                        <PortalSVG />
                      </button>
                      <button title="Edit" onClick={() => handleEdit(c)}
                        className="text-gray-400 hover:text-green-500 transition-colors p-1">
                        <EditSVG />
                      </button>
                      <button title="Delete" onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
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

      {/* ── Pagination: Splendid style ─────────────────────────────────────── */}
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

      {/* ── Customer form slide-over ────────────────────────────────────────── */}

      {/* ── Import modal ───────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowImport(false)}
              className="absolute -top-3.5 -right-3.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow"
            >×</button>

            <h2 className="text-lg font-semibold text-gray-800 mb-4">Import Customers</h2>

            <p className="text-sm text-gray-600 mb-3">
              Upload a CSV file to import customers. The file must have the correct column headers.
            </p>

            <button
              onClick={downloadImportTemplate}
              className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download CSV Template
            </button>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 transition-colors mb-4"
              onClick={() => importInputRef.current?.click()}
            >
              {importFile ? (
                <p className="text-sm text-green-700 font-medium">{importFile.name}</p>
              ) : (
                <>
                  <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  <p className="text-sm text-gray-500">Click to select a CSV file</p>
                </>
              )}
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportError(null); }}
              />
            </div>

            {importError && (
              <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-4 whitespace-pre-wrap max-h-32 overflow-auto">{importError}</pre>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >Cancel</button>
              <button
                onClick={handleImportSubmit}
                disabled={!importFile || importing}
                className="px-4 py-2 text-sm font-medium bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
