import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getDesignations, createDesignation, updateDesignation, deleteDesignation,
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getProjects, createProject, updateProject, deleteProject,
} from '../api/employees';
import { Employee, Department, Designation, Project } from '../types/employee';
import { validateEmail, validatePhone, validateCNIC, validateNTN } from '../utils/validators';

const TABS = ['Employees', 'Departments', 'Designations', 'Projects'];
const fmt = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

// ── Shared UI helpers ──────────────────────────────────────────────────────────

function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 align-middle">
      <svg className="w-2.5 h-2.5 -mb-0.5 text-gray-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5l8 8H4z"/></svg>
      <svg className="w-2.5 h-2.5 -mt-0.5 text-gray-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19l-8-8h16z"/></svg>
    </span>
  );
}

function TrashBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-gray-400 hover:text-red-500 transition-colors p-1">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}

function PrintSVG() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function ExcelSVG() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function printTable(title: string, headers: string[], rows: string[][]) {
  const w = window.open('', '_blank', 'width=900,height=600');
  if (!w) return;
  const body = rows.map(r =>
    `<tr>${r.map(c => `<td style="padding:6px 12px;border-bottom:1px solid #eee">${c ?? ''}</td>`).join('')}</tr>`
  ).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:sans-serif;padding:20px}h1{font-size:18px;margin-bottom:16px}
    table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:13px}
    td{font-size:13px}@media print{body{padding:0}}</style></head>
    <body><h1>${title}</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${body}</tbody></table></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Splendid-style list toolbar: Search + PRINT + EXPORT TO EXCEL */
function ListToolbar({ search, onSearch, label, onPrint, onExport }: {
  search: string; onSearch: (v: string) => void; label: string;
  onPrint: () => void; onExport: () => void;
}) {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-green-500 w-56"
          placeholder={`Search ${label}...`}
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <button onClick={onPrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors">
        <PrintSVG /> PRINT
      </button>
      <button onClick={onExport} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors">
        <ExcelSVG /> EXPORT TO EXCEL
      </button>
    </div>
  );
}

/** Splendid-style pagination: < 1 > | per-page */
function Pagination({ page, total, perPage, onPage, onPerPage }: {
  page: number; total: number; perPage: number;
  onPage: (p: number) => void; onPerPage: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-l text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 flex items-center justify-center border-t border-b border-r border-gray-300 text-sm font-medium transition-colors ${
              p === page ? 'bg-green-500 text-white border-green-500' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-r text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <select
        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none"
        value={perPage}
        onChange={e => { onPerPage(Number(e.target.value)); onPage(1); }}
      >
        {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}

/** Shared slide-over footer: SAVE AND NEW ▲ | × CLOSE */
function SlideOverFooter({ saving, onSave, onSaveNew, onClose }: {
  saving: boolean;
  onSave: () => void;
  onSaveNew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-t border-gray-200">
      <div className="flex rounded overflow-hidden shadow-sm">
        <button onClick={onSave} disabled={saving}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-5 py-2 transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : 'SAVE AND NEW'}
        </button>
        <button onClick={onSaveNew} disabled={saving}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2.5 py-2 border-l border-gray-300 transition-colors disabled:opacity-50">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      <button onClick={onClose}
        className="bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium px-5 py-2 rounded transition-colors flex items-center gap-1.5">
        <span className="text-lg leading-none font-light">×</span> CLOSE
      </button>
    </div>
  );
}

/** Shared Custom Fields card (same across all forms) */
function CustomFieldsCard() {
  return (
    <div className="max-w-2xl">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Add Fields</h3>
          <div className="w-56">
            <label className="block text-sm font-medium text-gray-700 mb-1">Field <span className="text-red-500">*</span></label>
            <div className="relative">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none">
                <option value="">-Choose-</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="dropdown">Dropdown</option>
                <option value="textarea">Text Area</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-end gap-3">
          <button type="button" className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            ADD
          </button>
          <button type="button" className="flex items-center gap-1.5 bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded">
            <span className="text-base leading-none font-light">×</span> CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Department slide-over form ─────────────────────────────────────────────────
function DeptForm({ initial, onSave, onClose }: { initial: Department | null; onSave: (d: Partial<Department>) => Promise<void>; onClose: () => void }) {
  const [name, setName]       = useState(initial?.name || '');
  const [notes, setNotes]     = useState(initial?.notes || '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const nameInvalid = touched && !name.trim();

  async function handleSave(saveAndNew = false) {
    setTouched(true);
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await onSave({ name, notes });
      if (saveAndNew) { setName(''); setNotes(''); setTouched(false); }
      else onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-full flex flex-col bg-white">
        {/* Header — no tabs, matches Splendid */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            {initial ? `Departments - Edit [${initial.name}]` : 'Departments - Add []'}
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <div className="space-y-5 max-w-2xl">
            {/* Department Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Name <span className="text-red-500">*</span>
              </label>
              <input
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none transition-colors ${
                  nameInvalid
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:border-green-500'
                }`}
                value={name}
                onChange={e => { setName(e.target.value); setTouched(true); }}
                onBlur={() => setTouched(true)}
              />
              {nameInvalid && (
                <p className="text-red-500 text-xs mt-1">Department name is required.</p>
              )}
            </div>
            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <SlideOverFooter saving={saving} onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onClose={onClose} />
    </div>
  );
}

// ── Designation slide-over form ────────────────────────────────────────────────
function DesigForm({ initial, departments, onSave, onClose }: { initial: Designation | null; departments: Department[]; onSave: (d: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm]     = useState({ name: initial?.name || '', department_id: initial?.department_id || '', notes: initial?.notes || '' });
  const [dgTab, setDgTab]   = useState<'general' | 'custom'>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSave(saveAndNew = false) {
    setSaving(true); setError('');
    try {
      await onSave({ ...form, department_id: Number(form.department_id) || null });
      if (saveAndNew) setForm({ name: '', department_id: '', notes: '' });
      else onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';

  return (
    <div className="w-full flex flex-col bg-white">
        <div className="shrink-0 px-6 pt-5 pb-0 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {initial ? `Designations - Edit [${initial.name}]` : 'Designations - Add []'}
          </h2>
          <div className="flex gap-6">
            {(['general', 'custom'] as const).map(t => (
              <button key={t} onClick={() => setDgTab(t)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  dgTab === t ? 'border-green-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}>
                {t === 'general' ? 'General' : 'Custom Fields'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {dgTab === 'general' && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <div className="relative">
                  <select
                    className={inputCls + ' appearance-none pr-8'}
                    value={form.department_id}
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">-Choose-</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className={inputCls} rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}
          {dgTab === 'custom' && <CustomFieldsCard />}
        </div>
        <SlideOverFooter saving={saving} onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onClose={onClose} />
    </div>
  );
}

// --- Employee form (Splendid-style wide slide-over) ---
type FormTab = 'general' | 'custom' | 'appuser';

function CalendarSVG() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function EmployeeForm({ initial, departments, designations, nextCode, onSave, onClose }: {
  initial: Employee | null;
  departments: Department[];
  designations: Designation[];
  nextCode: string;
  onSave: (data: Partial<Employee>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Employee>>({ is_active: true, salary: 0, ...initial });
  const [formTab, setFormTab]     = useState<FormTab>('general');
  const [phone2, setPhone2]       = useState('');
  const [phone3, setPhone3]       = useState('');
  const [dob, setDob]             = useState('');
  const [dor, setDor]             = useState('');
  const [addrLine2, setAddrLine2]   = useState('');
  const [imageUrl, setImageUrl]     = useState('');
  const [customField, setCustomField] = useState('');
  const [appUser, setAppUser]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (k: keyof Employee, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const resetForm = () => {
    setForm({ is_active: true, salary: 0 });
    setPhone2(''); setPhone3(''); setDob(''); setDor(''); setAddrLine2('');
    setFieldErrors({});
  };

  function validateEmployeeFields(): Record<string, string> {
    const errs: Record<string, string> = {};
    const emailErr = validateEmail(String(form.email || '')); if (emailErr) errs.email = emailErr;
    const p1 = validatePhone(String(form.phone || '')); if (p1) errs.phone = p1;
    const p2 = validatePhone(phone2); if (p2) errs.phone2 = p2;
    const p3 = validatePhone(phone3); if (p3) errs.phone3 = p3;
    const cnicErr = validateCNIC(String(form.cnic || '')); if (cnicErr) errs.cnic = cnicErr;
    const ntnErr = validateNTN(String(form.ntn || '')); if (ntnErr) errs.ntn = ntnErr;
    return errs;
  }

  async function handleSave(saveAndNew = false) {
    const errs = validateEmployeeFields();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setError('Please fix the highlighted fields before saving.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(form);
      if (saveAndNew) resetForm();
      else onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const displayCode = initial?.code ?? nextCode;

  const tabLabels: { key: FormTab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'custom',  label: 'Custom Fields' },
    { key: 'appuser', label: 'Application User' },
  ];

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="w-full flex flex-col bg-white">

        {/* ── Header + tabs ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-5 pb-0 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {initial ? `Employees - Edit [${initial.code}]` : 'Employees - Add []'}
          </h2>
          <div className="flex gap-6">
            {tabLabels.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFormTab(key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  formTab === key
                    ? 'border-green-500 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          {formTab === 'general' && (
            <div className="space-y-5">

              {/* Row 1: Code + Name  |  Profile image */}
              <div className="flex gap-6 items-start">
                <div className="flex-1 grid grid-cols-2 gap-5">
                  {/* Employee Code */}
                  <div>
                    <label className={labelCls}>Employee Code <span className="text-red-500">*</span></label>
                    <div className="flex items-stretch border border-gray-300 rounded overflow-hidden">
                      <button type="button" className="bg-green-500 hover:bg-green-600 px-3 flex items-center text-white">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <input
                        readOnly
                        value={displayCode}
                        className="flex-1 px-3 py-2 text-sm bg-white focus:outline-none text-gray-700 cursor-default"
                      />
                      <button type="button" className="bg-green-500 hover:bg-green-600 px-3 flex items-center text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Employee Name */}
                  <div>
                    <label className={labelCls}>Employee Name <span className="text-red-500">*</span></label>
                    <input
                      className={inputCls}
                      placeholder="Employee Name"
                      value={form.name || ''}
                      onChange={e => set('name', e.target.value)}
                    />
                  </div>
                </div>

                {/* Profile image */}
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
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setImageUrl(URL.createObjectURL(f)); }}
                    />
                  </label>
                </div>
              </div>

              {/* Row 2: Email + Phone 1 + Phone 2 + Phone 3 */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" className={inputCls} placeholder="Email"
                    value={form.email || ''} onChange={e => { set('email', e.target.value); setFieldErrors(f => ({ ...f, email: validateEmail(e.target.value) })); }} />
                  {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label className={labelCls}>Phone 1</label>
                  <input className={inputCls} placeholder="Phone 1"
                    value={form.phone || ''} onChange={e => { set('phone', e.target.value); setFieldErrors(f => ({ ...f, phone: validatePhone(e.target.value) })); }} />
                  {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label className={labelCls}>Phone 2</label>
                  <input className={inputCls} placeholder="Phone 2"
                    value={phone2} onChange={e => { setPhone2(e.target.value); setFieldErrors(f => ({ ...f, phone2: validatePhone(e.target.value) })); }} />
                  {fieldErrors.phone2 && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone2}</p>}
                </div>
                <div>
                  <label className={labelCls}>Phone 3</label>
                  <input className={inputCls} placeholder="Phone 3"
                    value={phone3} onChange={e => { setPhone3(e.target.value); setFieldErrors(f => ({ ...f, phone3: validatePhone(e.target.value) })); }} />
                  {fieldErrors.phone3 && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone3}</p>}
                </div>
              </div>

              {/* Row 3: Department + Designation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Department</label>
                  <div className="relative">
                    <select
                      className={inputCls + ' appearance-none pr-8'}
                      value={form.department_id || ''}
                      onChange={e => set('department_id', Number(e.target.value) || undefined)}
                    >
                      <option value="">-Choose-</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Designation</label>
                  <div className="relative">
                    <select
                      className={inputCls + ' appearance-none pr-8'}
                      value={form.designation_id || ''}
                      onChange={e => set('designation_id', Number(e.target.value) || undefined)}
                    >
                      <option value="">-Choose-</option>
                      {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Row 4: Date Of Birth + Date Of Joining + Date Of Resignation */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Date Of Birth',       val: dob,                              setter: setDob },
                  { label: 'Date Of Joining',      val: form.join_date?.slice(0,10) || '', setter: (v: string) => set('join_date', v) },
                  { label: 'Date Of Resignation',  val: dor,                              setter: setDor },
                ].map(({ label, val, setter }) => (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <div className="relative">
                      <input type="date" className={inputCls + ' pr-10'}
                        value={val} onChange={e => setter(e.target.value)} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <CalendarSVG />
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Row 5: Address Line 1 + Address Line 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Address Line 1</label>
                  <input className={inputCls} placeholder="Address Line 1"
                    value={form.address || ''} onChange={e => set('address', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Address Line 2</label>
                  <input className={inputCls} placeholder="Address Line 2"
                    value={addrLine2} onChange={e => setAddrLine2(e.target.value)} />
                </div>
              </div>

              {/* Additional fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Salary</label>
                  <input type="number" className={inputCls}
                    value={form.salary || ''} onChange={e => set('salary', Number(e.target.value))} />
                </div>
                <div>
                  <label className={labelCls}>Bank Account</label>
                  <input className={inputCls}
                    value={form.bank_account || ''} onChange={e => set('bank_account', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>CNIC</label>
                  <input className={inputCls} placeholder="e.g. 12345-1234567-1"
                    value={form.cnic || ''} onChange={e => { set('cnic', e.target.value); setFieldErrors(f => ({ ...f, cnic: validateCNIC(e.target.value) })); }} />
                  {fieldErrors.cnic && <p className="text-xs text-red-500 mt-1">{fieldErrors.cnic}</p>}
                </div>
                <div>
                  <label className={labelCls}>NTN</label>
                  <input className={inputCls} placeholder="e.g. 1234567-8"
                    value={form.ntn || ''} onChange={e => { set('ntn', e.target.value); setFieldErrors(f => ({ ...f, ntn: validateNTN(e.target.value) })); }} />
                  {fieldErrors.ntn && <p className="text-xs text-red-500 mt-1">{fieldErrors.ntn}</p>}
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={3}
                  value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="emp_active" className="w-4 h-4 text-green-600 rounded"
                  checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)} />
                <label htmlFor="emp_active" className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
          )}

          {formTab === 'custom' && <CustomFieldsCard />}

          {formTab === 'appuser' && (
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">Application User</label>
              <div className="relative">
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 appearance-none"
                  value={appUser}
                  onChange={e => setAppUser(e.target.value)}
                >
                  <option value="">-Choose-</option>
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────────── */}
        <SlideOverFooter saving={saving} onSave={() => handleSave(false)} onSaveNew={() => handleSave(true)} onClose={onClose} />
    </div>
  );
}

// --- Project form ---
function ProjectForm({ initial, customers, onSave, onClose }: any) {
  const [form, setForm] = useState<Partial<Project>>({ status: 'active', budget: 0, ...initial });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const set = (k: keyof Project, v: any) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="w-full flex flex-col">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[480px]">
        <h3 className="font-semibold mb-4">{initial ? 'Edit' : 'New'} Project</h3>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="label">Customer</label>
            <select className="input" value={form.customer_id || ''} onChange={e => set('customer_id', Number(e.target.value) || undefined)}>
              <option value="">—</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.print_name}</option>)}
            </select>
          </div>
          <div><label className="label">Reference</label><input className="input" value={form.reference || ''} onChange={e => set('reference', e.target.value)} /></div>
          <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date?.slice(0, 10) || ''} onChange={e => set('start_date', e.target.value)} /></div>
          <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date?.slice(0, 10) || ''} onChange={e => set('end_date', e.target.value)} /></div>
          <div><label className="label">Budget</label><input type="number" className="input" value={form.budget || ''} onChange={e => set('budget', Number(e.target.value))} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status || 'active'} onChange={e => set('status', e.target.value as any)}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const [tab, setTab] = useState(0);
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [customers,    setCustomers]    = useState<any[]>([]);
  const [modal,        setModal]        = useState<any>(null);
  const [error,        setError]        = useState('');

  // Per-tab search + pagination
  const [empSearch,  setEmpSearch]  = useState(''); const [empPage,  setEmpPage]  = useState(1); const [empPer,  setEmpPer]  = useState(50);
  const [deptSearch, setDeptSearch] = useState(''); const [deptPage, setDeptPage] = useState(1); const [deptPer, setDeptPer] = useState(50);
  const [dgSearch,   setDgSearch]   = useState(''); const [dgPage,   setDgPage]   = useState(1); const [dgPer,   setDgPer]   = useState(50);
  const [projSearch, setProjSearch] = useState(''); const [projPage, setProjPage] = useState(1); const [projPer, setProjPer] = useState(50);

  const reload = () => {
    getDepartments().then(setDepartments);
    getDesignations().then(setDesignations);
    getEmployees().then(setEmployees);
    getProjects().then(setProjects);
  };

  useEffect(() => {
    reload();
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  const del = async (fn: () => Promise<any>) => {
    try { await fn(); reload(); } catch (e: any) { setError(e.message); }
  };

  // ── Early returns: show form full-page ───────────────────────────────────────
  if (modal?.type === 'employee') return (
    <EmployeeForm
      initial={modal.data}
      departments={departments}
      designations={designations}
      nextCode={`E-${String(employees.length + 1).padStart(6, '0')}`}
      onClose={() => setModal(null)}
      onSave={async (d: any) => { if (modal.data) await updateEmployee(modal.data.id, d); else await createEmployee(d); reload(); setModal(null); }}
    />
  );
  if (modal?.type === 'dept') return (
    <DeptForm initial={modal.data} onClose={() => setModal(null)}
      onSave={async (d) => { if (modal.data) await updateDepartment(modal.data.id, d); else await createDepartment(d); reload(); setModal(null); }} />
  );
  if (modal?.type === 'desig') return (
    <DesigForm initial={modal.data} departments={departments} onClose={() => setModal(null)}
      onSave={async (d) => { if (modal.data) await updateDesignation(modal.data.id, d); else await createDesignation(d); reload(); setModal(null); }} />
  );
  if (modal?.type === 'project') return (
    <ProjectForm initial={modal.data} customers={customers} onClose={() => setModal(null)}
      onSave={async (d: any) => { if (modal.data) await updateProject(modal.data.id, d); else await createProject(d); reload(); setModal(null); }} />
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">HR & Payroll</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded text-sm font-medium ${tab === i ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Employees ── */}
      {tab === 0 && (() => {
        const filtered = employees.filter(e =>
          !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
          (e.code ?? '').toLowerCase().includes(empSearch.toLowerCase())
        );
        const paged = filtered.slice((empPage - 1) * empPer, empPage * empPer);
        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Employees</h2>
              <button
                onClick={() => setModal({ type: 'employee', data: null })}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                + ADD EMPLOYEE
              </button>
            </div>
            <ListToolbar search={empSearch} onSearch={v => { setEmpSearch(v); setEmpPage(1); }} label="employees"
              onPrint={() => printTable('Employees', ['Code', 'Name', 'Department', 'Designation', 'CNIC', 'Salary', 'Status'],
                filtered.map(e => [e.code ?? '', e.name, e.department_name ?? '', e.designation_name ?? '', e.cnic ?? '', fmt(e.salary), e.is_active ? 'Active' : 'Inactive']))}
              onExport={() => exportCsv('employees.csv', ['Code', 'Name', 'Department', 'Designation', 'CNIC', 'Salary', 'Status'],
                filtered.map(e => [e.code ?? '', e.name, e.department_name ?? '', e.designation_name ?? '', e.cnic ?? '', fmt(e.salary), e.is_active ? 'Active' : 'Inactive']))}
            />
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Code <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Department <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Designation <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">CNIC <SortIcon /></th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Salary <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status <SortIcon /></th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(e => (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{e.code}</td>
                      <td className="px-4 py-2.5">
                        <button className="text-blue-600 hover:underline text-sm font-medium text-left"
                          onClick={() => setModal({ type: 'employee', data: e })}>
                          {e.name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{e.department_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{e.designation_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{e.cnic}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(e.salary)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {e.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <TrashBtn onClick={() => del(() => deleteEmployee(e.id))} />
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={empPage} total={filtered.length} perPage={empPer} onPage={setEmpPage} onPerPage={setEmpPer} />
          </>
        );
      })()}

      {/* ── Departments ── */}
      {tab === 1 && (() => {
        const filtered = departments.filter(d =>
          !deptSearch || d.name.toLowerCase().includes(deptSearch.toLowerCase())
        );
        const paged = filtered.slice((deptPage - 1) * deptPer, deptPage * deptPer);
        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Departments</h2>
              <button
                onClick={() => setModal({ type: 'dept', data: null })}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                + ADD DEPARTMENT
              </button>
            </div>
            <ListToolbar search={deptSearch} onSearch={v => { setDeptSearch(v); setDeptPage(1); }} label="departments"
              onPrint={() => printTable('Departments', ['Name'], filtered.map(d => [d.name]))}
              onExport={() => exportCsv('departments.csv', ['Name'], filtered.map(d => [d.name]))}
            />
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name <SortIcon /></th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(d => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <button className="text-blue-600 hover:underline text-sm font-medium text-left"
                          onClick={() => setModal({ type: 'dept', data: d })}>
                          {d.name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <TrashBtn onClick={() => del(() => deleteDepartment(d.id))} />
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">No departments found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={deptPage} total={filtered.length} perPage={deptPer} onPage={setDeptPage} onPerPage={setDeptPer} />
          </>
        );
      })()}

      {/* ── Designations ── */}
      {tab === 2 && (() => {
        const filtered = designations.filter(d =>
          !dgSearch || d.name.toLowerCase().includes(dgSearch.toLowerCase()) ||
          (d.department_name ?? '').toLowerCase().includes(dgSearch.toLowerCase())
        );
        const paged = filtered.slice((dgPage - 1) * dgPer, dgPage * dgPer);
        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Designations</h2>
              <button
                onClick={() => setModal({ type: 'desig', data: null })}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                + ADD DESIGNATION
              </button>
            </div>
            <ListToolbar search={dgSearch} onSearch={v => { setDgSearch(v); setDgPage(1); }} label="designations"
              onPrint={() => printTable('Designations', ['Name', 'Department'], filtered.map(d => [d.name, d.department_name ?? '']))}
              onExport={() => exportCsv('designations.csv', ['Name', 'Department'], filtered.map(d => [d.name, d.department_name ?? '']))}
            />
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Department <SortIcon /></th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(d => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <button className="text-blue-600 hover:underline text-sm font-medium text-left"
                          onClick={() => setModal({ type: 'desig', data: d })}>
                          {d.name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{d.department_name}</td>
                      <td className="px-4 py-2.5 text-right">
                        <TrashBtn onClick={() => del(() => deleteDesignation(d.id))} />
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No designations found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={dgPage} total={filtered.length} perPage={dgPer} onPage={setDgPage} onPerPage={setDgPer} />
          </>
        );
      })()}

      {/* ── Projects ── */}
      {tab === 3 && (() => {
        const filtered = projects.filter(p =>
          !projSearch || p.name.toLowerCase().includes(projSearch.toLowerCase()) ||
          (p.customer_name ?? '').toLowerCase().includes(projSearch.toLowerCase())
        );
        const paged = filtered.slice((projPage - 1) * projPer, projPage * projPer);
        return (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Projects</h2>
              <button
                onClick={() => setModal({ type: 'project', data: null })}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
              >
                + ADD PROJECT
              </button>
            </div>
            <ListToolbar search={projSearch} onSearch={v => { setProjSearch(v); setProjPage(1); }} label="projects"
              onPrint={() => printTable('Projects', ['Name', 'Customer', 'Start', 'End', 'Budget', 'Status'],
                filtered.map(p => [p.name, p.customer_name ?? '', p.start_date?.slice(0, 10) ?? '', p.end_date?.slice(0, 10) ?? '', fmt(p.budget), p.status]))}
              onExport={() => exportCsv('projects.csv', ['Name', 'Customer', 'Start', 'End', 'Budget', 'Status'],
                filtered.map(p => [p.name, p.customer_name ?? '', p.start_date?.slice(0, 10) ?? '', p.end_date?.slice(0, 10) ?? '', fmt(p.budget), p.status]))}
            />
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Start <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">End <SortIcon /></th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Budget <SortIcon /></th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status <SortIcon /></th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(p => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <button className="text-blue-600 hover:underline text-sm font-medium text-left"
                          onClick={() => setModal({ type: 'project', data: p })}>
                          {p.name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{p.customer_name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.start_date?.slice(0, 10)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.end_date?.slice(0, 10)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(p.budget)}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{p.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <TrashBtn onClick={() => del(() => deleteProject(p.id))} />
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No projects found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={projPage} total={filtered.length} perPage={projPer} onPage={setProjPage} onPerPage={setProjPer} />
          </>
        );
      })()}

    </div>
  );
}



