import { useEffect, useMemo, useState } from 'react';
import type { Warehouse } from '../types/warehouse';
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../api/warehouses';
import { validateEmail, validateName, validatePhone, validateZip } from '../utils/validators';
import { PK_PROVINCES, PK_CITIES, COUNTRIES } from '../data/locations';

function exportWarehousesToExcel(rows: Warehouse[]) {
  const headers = ['Name', 'Address Line 1', 'Address Line 2', 'City', 'State', 'Zip', 'Country', 'Contact Person', 'Email', 'Phone', 'Fax', 'Status'];
  const escape = (v: string | null | undefined) => {
    const s = v ?? '';
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows = [
    headers.join(','),
    ...rows.map((w) => [
      escape(w.name), escape(w.address_line1), escape(w.address_line2),
      escape(w.city), escape(w.state), escape(w.zip), escape(w.country),
      escape(w.contact_person), escape(w.email), escape(w.phone), escape(w.fax),
      w.is_active ? 'Active' : 'Inactive',
    ].join(',')),
  ];
  const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Warehouses.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printWarehouses(rows: Warehouse[]) {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Warehouses</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .company { font-size: 22px; font-weight: bold; }
    .report-title { font-size: 22px; font-weight: bold; }
    hr { border: none; border-top: 1.5px solid #000; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr th { text-align: left; font-weight: bold; padding: 6px 8px; border-bottom: 1.5px solid #000; font-size: 13px; }
    tbody tr td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="company">Evotrade</span>
    <span class="report-title">Warehouses</span>
  </div>
  <hr/>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Address 1</th>
        <th>City</th>
        <th>Country</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((w) => `
      <tr>
        <td>${w.name}</td>
        <td>${w.address_line1 ?? ''}</td>
        <td>${w.city ?? ''}</td>
        <td>${w.country ?? ''}</td>
        <td>${w.is_active ? 'Active' : 'Inactive'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

const PAGE_SIZES = [10, 25, 50, 100];

interface FormState {
  name: string; address_line1: string; address_line2: string;
  city: string; state: string; zip: string; country: string;
  contact_person: string; email: string; phone: string; fax: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: '', address_line1: '', address_line2: '', city: '', state: '',
  zip: '', country: '', contact_person: '', email: '', phone: '', fax: '', is_active: true,
};

function warehouseToForm(w: Warehouse): FormState {
  return {
    name: w.name, address_line1: w.address_line1 ?? '', address_line2: w.address_line2 ?? '',
    city: w.city ?? '', state: w.state ?? '', zip: w.zip ?? '', country: w.country ?? '',
    contact_person: w.contact_person ?? '', email: w.email ?? '',
    phone: w.phone ?? '', fax: w.fax ?? '', is_active: w.is_active,
  };
}

const SortIcon = () => (
  <svg className="inline-block ml-1 w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState<'list' | 'form'>('list');
  const [editing,    setEditing]    = useState<Warehouse | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [errors,     setErrors]     = useState<Partial<Record<keyof FormState, string>>>({});

  // List state
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(50);

  async function load() {
    setLoading(true);
    try { setWarehouses(await getWarehouses()); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setError(''); setErrors({}); setView('form');
  }
  function openEdit(w: Warehouse) {
    setEditing(w); setForm(warehouseToForm(w)); setError(''); setErrors({}); setView('form');
  }
  function closeForm() { setView('list'); setEditing(null); setError(''); setErrors({}); }

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    const nameErr = validateName(form.name, 'Warehouse Name'); if (nameErr) e.name = nameErr;
    const emailErr = validateEmail(form.email); if (emailErr) e.email = emailErr;
    const phoneErr = validatePhone(form.phone); if (phoneErr) e.phone = phoneErr;
    const faxErr = validatePhone(form.fax); if (faxErr) e.fax = faxErr;
    const zipErr = validateZip(form.zip); if (zipErr) e.zip = zipErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(andNew = false) {
    if (!validate()) return;
    setError(''); setSaving(true);
    try {
      if (editing) await updateWarehouse(editing.id, { ...form });
      else await createWarehouse({ ...form });
      await load();
      if (andNew) { setEditing(null); setForm(EMPTY_FORM); setErrors({}); }
      else closeForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this warehouse?')) return;
    try { await deleteWarehouse(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  }

  // Filtered + paginated
  const filtered = useMemo(() => {
    if (!search.trim()) return warehouses;
    const q = search.toLowerCase();
    return warehouses.filter((w) =>
      w.name.toLowerCase().includes(q) ||
      (w.address_line1 ?? '').toLowerCase().includes(q) ||
      (w.city ?? '').toLowerCase().includes(q) ||
      (w.country ?? '').toLowerCase().includes(q)
    );
  }, [warehouses, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* ──────────── FORM VIEW ──────────── */
  if (view === 'form') {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            Warehouses - {editing ? `Edit [${editing.name}]` : 'Add []'}
          </h2>
          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="space-y-5">
            {/* Warehouse Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse Name <span className="text-red-500">*</span>
              </label>
              <input type="text"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Warehouse Name"
                value={form.name} onChange={set('name')} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            {/* Address Line 1 | Address Line 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <textarea rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                  placeholder="Address Line 1"
                  value={form.address_line1} onChange={set('address_line1')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <textarea rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                  placeholder="Address Line 2"
                  value={form.address_line2} onChange={set('address_line2')} />
              </div>
            </div>
            {/* City | State | Zip | Country */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                {form.country === 'Pakistan' ? (
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    value={form.city} onChange={set('city')}>
                    <option value="">-Choose-</option>
                    {PK_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="City" value={form.city} onChange={set('city')} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                {form.country === 'Pakistan' ? (
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    value={form.state} onChange={set('state')}>
                    <option value="">-Choose-</option>
                    {PK_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <input type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="State" value={form.state} onChange={set('state')} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
                <input type="text"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.zip ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Zip" value={form.zip} onChange={set('zip')} />
                {errors.zip && <p className="text-xs text-red-500 mt-1">{errors.zip}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  value={form.country} onChange={set('country')}>
                  <option value="">-Choose-</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Contact Person | Email | Phone | Fax */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Contact Person" value={form.contact_person} onChange={set('contact_person')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Email" value={form.email} onChange={set('email')} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Phone" value={form.phone} onChange={set('phone')} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
                <input type="text"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${errors.fax ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Fax" value={form.fax} onChange={set('fax')} />
                {errors.fax && <p className="text-xs text-red-500 mt-1">{errors.fax}</p>}
              </div>
            </div>
          </div>

          {/* Footer: SAVE AND NEW ▼  |  × CLOSE */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-gray-200">
            <div className="flex items-center">
              <button onClick={() => handleSave(false)} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-l disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving}
                className="flex items-center px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-r border-l border-gray-500 disabled:opacity-50">
                ▼
              </button>
            </div>
            <button onClick={closeForm}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              CLOSE
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ──────────── LIST VIEW ──────────── */
  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-gray-900">Warehouses</h1>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            ADD WAREHOUSE
          </button>
        </div>

        {/* Search + PRINT + EXPORT TO EXCEL */}
        <div className="flex items-end justify-end gap-3 mb-5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input type="text"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-52 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder=""
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button
            onClick={() => printWarehouses(filtered)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button
            onClick={() => exportWarehousesToExcel(filtered)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            EXPORT TO EXCEL
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <>
            <table className="w-full text-sm border-t border-gray-200">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                    Name <SortIcon />
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                    Address1 <SortIcon />
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                    City <SortIcon />
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                    Country <SortIcon />
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                    Status <SortIcon />
                  </th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-orange-500 text-sm">No record found</td>
                  </tr>
                ) : (
                  paginated.map((w) => (
                    <tr key={w.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <button
                          onClick={() => openEdit(w)}
                          className="text-blue-600 hover:underline text-sm font-medium text-left">
                          {w.name}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">{w.address_line1 || ''}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{w.city || ''}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{w.country || ''}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">{w.is_active ? 'Active' : 'Inactive'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => handleDelete(w.id)}
                          title="Delete"
                          className="text-gray-400 hover:text-red-600 inline-flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              {/* Page buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm">
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${
                      p === page
                        ? 'bg-green-500 text-white border border-green-500'
                        : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}>
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm">
                  ›
                </button>
              </div>

              {/* Per-page dropdown */}
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-600 focus:outline-none"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
