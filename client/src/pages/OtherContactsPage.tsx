import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import { validateEmail, validateName, validatePhone } from '../utils/validators';

interface OtherContact {
  id: number; code: string; print_name: string; category?: string;
  contact_person?: string; phone?: string; email?: string; address?: string; notes?: string; is_active: boolean;
}

interface Filters { code?: string; name?: string; category?: string; contact_person?: string; email?: string; phone?: string; custom_field?: string; }

type SortField = 'code' | 'print_name' | 'category' | 'contact_person' | 'email' | 'phone';

const CATEGORIES = ['Bank', 'Government', 'NGO', 'Contractor', 'Consultant', 'Other'];

const SVG = {
  edit:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trash:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  print:  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
  excel:  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z" /></svg>,
  filter: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4-2A1 1 0 017 15v-4.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>,
};

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: 'asc' | 'desc' }) {
  if (sortField !== field) return <span className="text-gray-400 ml-1 text-xs">⇅</span>;
  return <span className="text-blue-600 ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

function ContactForm({ initial, onSave, onClose }: { initial: OtherContact | null; onSave: (d: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<OtherContact>>({ is_active: true, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (k: keyof OtherContact, v: any) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const submit = async (andNew: boolean) => {
    const errs: Record<string, string> = {};
    const nameErr = validateName(form.print_name || '', 'Name'); if (nameErr) errs.print_name = nameErr;
    const phoneErr = validatePhone(form.phone || ''); if (phoneErr) errs.phone = phoneErr;
    const emailErr = validateEmail(form.email || ''); if (emailErr) errs.email = emailErr;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setError('Please fix the highlighted fields before saving.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(form);
      if (andNew && !initial) { setForm({ is_active: true }); }
      else { onClose(); }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="w-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? `Edit Other Contact — [${initial.code}]` : 'Other Contact — Add []'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {/* Row 1: Name */}
          <div>
            <label className={lbl}>Name <span className="text-red-500">*</span></label>
            <input className={`${inp} ${fieldErrors.print_name ? 'border-red-500' : ''}`} placeholder="Contact Name" value={form.print_name || ''} onChange={e => set('print_name', e.target.value)} />
            {fieldErrors.print_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.print_name}</p>}
          </div>

          {/* Row 2: Category | Contact Person */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Category</label>
              <select className={inp} value={form.category || ''} onChange={e => set('category', e.target.value)}>
                <option value="">— Choose —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Contact Person</label>
              <input className={inp} placeholder="Contact Person" value={form.contact_person || ''} onChange={e => set('contact_person', e.target.value)} />
            </div>
          </div>

          {/* Row 3: Phone | Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Phone</label>
              <input className={inp} placeholder="Phone" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" className={inp} placeholder="Email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>
          </div>

          {/* Row 4: Address */}
          <div>
            <label className={lbl}>Address</label>
            <textarea className={inp + ' resize-none'} rows={2} placeholder="Address" value={form.address || ''} onChange={e => set('address', e.target.value)} />
          </div>

          {/* Row 5: Notes */}
          <div>
            <label className={lbl}>Notes</label>
            <textarea className={inp + ' resize-none'} rows={3} placeholder="Notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>

          {/* Status */}
          <div>
            <label className={lbl}>Status</label>
            <select className={inp} value={form.is_active ? 'active' : 'inactive'} onChange={e => set('is_active', e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-white flex gap-2 justify-end shrink-0">
          {!initial && (
            <button type="button" onClick={() => submit(true)} disabled={saving}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-semibold px-6 py-2 rounded transition-colors disabled:opacity-50">
              {saving ? 'SAVING…' : 'SAVE AND NEW'}
            </button>
          )}
          <button type="button" onClick={() => submit(false)} disabled={saving}
            className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-6 py-2 rounded transition-colors disabled:opacity-50">
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
    </div>
  );
}

export default function OtherContactsPage() {
  const [contacts, setContacts]       = useState<OtherContact[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<OtherContact | null>(null);

  // Filters
  const [showFilters, setShowFilters]       = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>({});
  const [appliedFilters, setAppliedFilters] = useState<Filters>({});

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams();
      if (appliedFilters.code)           p.set('code', appliedFilters.code);
      if (appliedFilters.name)           p.set('search', appliedFilters.name);
      if (appliedFilters.category)       p.set('category', appliedFilters.category);
      if (appliedFilters.contact_person) p.set('contact_person', appliedFilters.contact_person);
      if (appliedFilters.email)          p.set('email', appliedFilters.email);
      if (appliedFilters.phone)          p.set('phone', appliedFilters.phone);

      let data: OtherContact[] = await apiFetch('/api/other-contacts?' + p).then(r => r.json());
      if (!Array.isArray(data)) data = [];

      if (sortField) {
        data.sort((a, b) => {
          const av = (a[sortField] ?? '') as string;
          const bv = (b[sortField] ?? '') as string;
          const cmp = av.localeCompare(bv);
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
      setContacts(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [appliedFilters, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const save = async (data: any) => {
    const method = editing ? 'PUT' : 'POST';
    const url    = editing ? `/api/other-contacts/${editing.id}` : '/api/other-contacts';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error((await r.json()).error || 'Save failed');
    load();
  };

  const del = async (id: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    const r = await fetch(`/api/other-contacts/${id}`, { method: 'DELETE' });
    if (!r.ok) { setError((await r.json()).error || 'Delete failed'); return; }
    load();
  };

  const appliedCount = Object.values(appliedFilters).filter(Boolean).length;

  function handlePrint() {
    const headers = ['Code', 'Name', 'Category', 'Contact Person', 'Email', 'Phone'];
    const rows = contacts.map(c => [c.code || '', c.print_name, c.category || '', c.contact_person || '', c.email || '', c.phone || '']);
    const w = window.open('', '_blank', 'width=900,height=600');
    if (!w) return;
    const body = rows.map(r =>
      `<tr>${r.map(cell => `<td style="padding:6px 12px;border-bottom:1px solid #eee">${cell}</td>`).join('')}</tr>`
    ).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Other Contacts</title>
      <style>body{font-family:sans-serif;padding:20px}h1{font-size:18px;margin-bottom:16px}
      table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:13px}
      td{font-size:13px}@media print{body{padding:0}}</style></head>
      <body><h1>Other Contacts</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  function handleExport() {
    const headers = ['Code', 'Name', 'Category', 'Contact Person', 'Email', 'Phone'];
    const rows = contacts.map(c => [c.code || '', c.print_name, c.category || '', c.contact_person || '', c.email || '', c.phone || '']);
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'other-contacts.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const thCls = 'px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap';

  if (showForm) return (
        <ContactForm
      initial={editing}
      onSave={save}
      onClose={() => { setShowForm(false); setEditing(null); }}
    />
  );

  return (
    <div className="p-6">
      {/* Row 1: Title + ADD button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Other Contacts</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors"
        >
          + ADD OTHER CONTACT
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

      {/* Row 2: Action buttons */}
      <div className="flex items-center justify-between mb-6">
        {/* Left: FILTERS */}
        <button
          onClick={() => { setPendingFilters(appliedFilters); setShowFilters(true); }}
          className="relative inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors"
        >
          {SVG.filter}
          FILTERS
          {appliedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {appliedCount}
            </span>
          )}
        </button>

        {/* Right: PRINT + EXPORT TO EXCEL */}
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors">
            {SVG.print} PRINT
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors">
            {SVG.excel} EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={thCls} onClick={() => handleSort('code')}>
                Code <SortIcon field="code" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={thCls} onClick={() => handleSort('print_name')}>
                Name <SortIcon field="print_name" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={thCls} onClick={() => handleSort('category')}>
                Category <SortIcon field="category" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={thCls} onClick={() => handleSort('contact_person')}>
                Contact Person <SortIcon field="contact_person" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={thCls} onClick={() => handleSort('email')}>
                Email <SortIcon field="email" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className={thCls} onClick={() => handleSort('phone')}>
                Phone <SortIcon field="phone" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-orange-500 font-medium">No record found</td></tr>
            ) : contacts.map(c => (
              <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.code || '—'}</td>
                <td className="px-4 py-3 text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => { setEditing(c); setShowForm(true); }}>{c.print_name}</td>
                <td className="px-4 py-3 text-gray-700">{c.category || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{c.contact_person || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{c.email || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{c.phone || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditing(c); setShowForm(true); }}
                      className="text-gray-500 hover:text-blue-600 transition-colors" title="Edit">
                      {SVG.edit}
                    </button>
                    <button onClick={() => del(c.id)}
                      className="text-gray-500 hover:text-red-600 transition-colors" title="Delete">
                      {SVG.trash}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FILTERS MODAL */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
          <div className="fixed inset-0 bg-black/20" onClick={() => setShowFilters(false)} />

          {/* Modal with green border */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl border-2 border-green-400 flex flex-col">

            {/* Red circle X — outside top-right corner */}
            <button
              onClick={() => setShowFilters(false)}
              className="absolute -top-3.5 -right-3.5 z-10 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Body — 2-column label | input layout */}
            <div className="p-6 space-y-4">
              {/* Code */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Code</label>
                <input type="text" placeholder="Type to search code"
                  className="col-span-2 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.code || ''}
                  onChange={e => setPendingFilters(f => ({ ...f, code: e.target.value }))} />
              </div>

              {/* Name */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input type="text" placeholder="Type to search name"
                  className="col-span-2 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.name || ''}
                  onChange={e => setPendingFilters(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Other Contact Category */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Other Contact Category</label>
                <div className="col-span-2 relative">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none pr-8"
                    value={pendingFilters.category || ''}
                    onChange={e => setPendingFilters(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select other contact category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Contact Person */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Contact Person</label>
                <input type="text" placeholder="Type to search contact person"
                  className="col-span-2 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.contact_person || ''}
                  onChange={e => setPendingFilters(f => ({ ...f, contact_person: e.target.value }))} />
              </div>

              {/* Email */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input type="text" placeholder="Type to search email"
                  className="col-span-2 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.email || ''}
                  onChange={e => setPendingFilters(f => ({ ...f, email: e.target.value }))} />
              </div>

              {/* Phone */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <input type="text" placeholder="Type to search phone"
                  className="col-span-2 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.phone || ''}
                  onChange={e => setPendingFilters(f => ({ ...f, phone: e.target.value }))} />
              </div>

              {/* Custom Field */}
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Custom Field</label>
                <select
                  className="col-span-2 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  value={pendingFilters.custom_field || ''}
                  onChange={e => setPendingFilters(f => ({ ...f, custom_field: e.target.value }))}>
                  <option value="">-Choose-</option>
                </select>
              </div>
            </div>

            {/* Footer: SAVE FILTER (left) | APPLY (center) | CLEAR (right) */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
              {/* SAVE FILTER — blue, left */}
              <button type="button" onClick={() => setShowFilters(false)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-semibold text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                SAVE FILTER
              </button>

              <div className="flex-1" />

              {/* APPLY — center */}
              <button type="button" onClick={() => { setAppliedFilters(pendingFilters); setShowFilters(false); }}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-600 px-5 py-2 rounded font-semibold text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                </svg>
                APPLY
              </button>

              {/* CLEAR — blue with refresh icon, right */}
              <button type="button" onClick={() => { setPendingFilters({}); setAppliedFilters({}); setShowFilters(false); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-semibold text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Form Slide-over */}
    </div>
  );
}

