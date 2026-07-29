import { apiFetch, parseJsonOrThrow } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import { getCrmCalls, createCrmCall, updateCrmCall, deleteCrmCall } from '../api/crmCalls';
import { CrmCall, CallStatus } from '../types/crmCall';
import { validateName, validatePhone, validatePositive } from '../utils/validators';
import SearchSelect from '../components/SearchSelect';

interface Customer { id: number; print_name: string; }

const STATUS_COLOR: Record<CallStatus, string> = {
  planned:   'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  missed:    'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};

const PURPOSES = ['Follow-up', 'Sales', 'Support', 'Demo', 'Feedback', 'Other'];

// ── Filters ───────────────────────────────────────────────────────────────────
const emptyFilters = {
  contact:    '',
  assignedTo: '',
  status:     '',
  priority:   '',
  startFrom:  '',
  startTo:    '',
  endFrom:    '',
  endTo:      '',
};
type Filters = typeof emptyFilters;

// ── SortIcon ──────────────────────────────────────────────────────────────────
function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 text-gray-400" style={{ fontSize: 8, lineHeight: 1 }}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className="mt-0.5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  );
}

// ── Call Form ─────────────────────────────────────────────────────────────────
function CallForm({ onSave, onClose, initial, customers }: {
  onSave: (d: Partial<CrmCall>) => Promise<void>;
  onClose: () => void;
  initial: CrmCall | null;
  customers: Customer[];
}) {
  const [form, setForm] = useState<Partial<CrmCall>>(
    initial || { status: 'planned', call_type: 'outbound', follow_up_required: false }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (k: keyof CrmCall, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);
  useEffect(() => {
    apiFetch('/api/employees').then(parseJsonOrThrow)
      .then(d => setEmployeeOptions((d as { name: string }[]).map(e => e.name))).catch(() => {});
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!(form.subject ?? '').trim()) errs.subject = 'Subject is required.';
    const contactErr = validateName(form.contact_name ?? '', 'Contact name');
    if ((form.contact_name ?? '').trim() && contactErr) errs.contact_name = contactErr;
    const phoneErr = validatePhone(form.phone ?? ''); if (phoneErr) errs.phone = phoneErr;
    const durErr = validatePositive(form.duration_minutes ?? 0, 'Duration'); if (durErr) errs.duration_minutes = durErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const submit = async () => {
    if (!validate()) { setError('Please fix the highlighted fields before saving.'); return; }
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="w-full flex flex-col bg-white">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{initial ? 'Edit' : 'New'} Call Log</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div>
            <label className="label">Subject *</label>
            <input className={`input ${fieldErrors.subject ? 'border-red-500' : ''}`} value={form.subject || ''} onChange={e => set('subject', e.target.value)} />
            {fieldErrors.subject && <p className="text-xs text-red-500 mt-1">{fieldErrors.subject}</p>}
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={form.customer_id || ''} onChange={e => set('customer_id', Number(e.target.value) || undefined)}>
              <option value="">—</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Name</label>
              <input className={`input ${fieldErrors.contact_name ? 'border-red-500' : ''}`} value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} />
              {fieldErrors.contact_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.contact_name}</p>}
            </div>
            <div>
              <label className="label">Phone</label>
              <input className={`input ${fieldErrors.phone ? 'border-red-500' : ''}`} value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="label">Call Type</label>
              <select className="input" value={form.call_type || 'outbound'} onChange={e => set('call_type', e.target.value)}>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            <div>
              <label className="label">Purpose</label>
              <select className="input" value={form.call_purpose || ''} onChange={e => set('call_purpose', e.target.value)}>
                <option value="">—</option>
                {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Call Date</label><input type="datetime-local" className="input" value={form.call_date?.slice(0, 16) || ''} onChange={e => set('call_date', e.target.value)} /></div>
            <div>
              <label className="label">Duration (mins)</label>
              <input type="number" min={0} className={`input ${fieldErrors.duration_minutes ? 'border-red-500' : ''}`} value={form.duration_minutes || ''} onChange={e => set('duration_minutes', Number(e.target.value))} />
              {fieldErrors.duration_minutes && <p className="text-xs text-red-500 mt-1">{fieldErrors.duration_minutes}</p>}
            </div>
            <div>
              <label className="label">Assigned To</label>
              <SearchSelect value={form.assigned_to || ''} onChange={v => set('assigned_to', v)} options={employeeOptions} placeholder="Type to search employee" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status || 'planned'} onChange={e => set('status', e.target.value)}>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.follow_up_required || false} onChange={e => set('follow_up_required', e.target.checked)} />
            <label className="label mb-0">Follow-up Required</label>
            {form.follow_up_required && (
              <input type="date" className="input ml-4 w-40" value={form.follow_up_date?.slice(0, 10) || ''} onChange={e => set('follow_up_date', e.target.value)} />
            )}
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <div className="flex">
            <button onClick={submit} disabled={saving} className="bg-gray-200 text-gray-600 px-5 py-2 text-sm font-medium hover:bg-gray-300 rounded-l">
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button type="button" className="bg-gray-200 text-gray-600 px-2 py-2 hover:bg-gray-300 rounded-r border-l border-gray-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <button type="button" onClick={onClose} className="flex items-center gap-1 bg-yellow-400 text-white px-5 py-2 text-sm font-medium rounded hover:bg-yellow-500">
            <span className="text-lg leading-none">&times;</span> CLOSE
          </button>
        </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CrmCallsPage() {
  const [calls, setCalls]         = useState<CrmCall[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search]                  = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<CrmCall | null>(null);
  const [error, setError]         = useState('');

  // Filters
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...emptyFilters });

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== '').length;

  function load(f: Filters = appliedFilters, q = search) {
    const params: Record<string, string> = {};
    if (q) params.search = q;
    if (f.status) params.status = f.status;
    getCrmCalls(params).then(data => {
      let filtered = data;
      if (f.contact)    filtered = filtered.filter(c => (c.contact_name ?? '').toLowerCase().includes(f.contact.toLowerCase()));
      if (f.assignedTo) filtered = filtered.filter(c => (c.assigned_to ?? '').toLowerCase().includes(f.assignedTo.toLowerCase()));
      if (f.startFrom)  filtered = filtered.filter(c => (c.call_date ?? '') >= f.startFrom);
      if (f.startTo)    filtered = filtered.filter(c => (c.call_date ?? '') <= f.startTo + 'T23:59:59');
      if (f.endFrom)    filtered = filtered.filter(c => (c.follow_up_date ?? '') >= f.endFrom);
      if (f.endTo)      filtered = filtered.filter(c => (c.follow_up_date ?? '') <= f.endTo);
      setCalls(filtered);
    }).catch(e => setError(e.message));
  }

  useEffect(() => {
    load();
    apiFetch('/api/customers?limit=500').then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
  }, []);

  useEffect(() => { load(appliedFilters, search); }, [search]);

  function applyFilters() {
    const f = { ...pendingFilters };
    setAppliedFilters(f);
    setShowFilters(false);
    load(f, search);
  }

  function clearFilters() {
    const f = { ...emptyFilters };
    setPendingFilters(f);
    setAppliedFilters(f);
    setShowFilters(false);
    load(f, search);
  }

  const save = async (data: Partial<CrmCall>) => {
    if (editing) await updateCrmCall(editing.id, data);
    else await createCrmCall(data);
    load();
  };

  // calendar icon
  const CalIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  if (showForm) return (
        <CallForm onSave={save} onClose={() => { setShowForm(false); setEditing(null); }} initial={editing} customers={customers} />
  );

  return (
    <div className="p-6">
      {/* Title + Add button */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Call</h1>
        <button
          className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600"
          onClick={() => { setEditing(null); setShowForm(true); }}
        >
          + ADD CALL
        </button>
      </div>

      {error && <p className="text-red-600 mb-2 text-sm">{error}</p>}

      {/* FILTERS button */}
      <div className="mb-4">
        <button
          onClick={() => { setPendingFilters({ ...appliedFilters }); setShowFilters(true); }}
          className="relative flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          FILTERS
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-blue-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Table — headers shown only when there are records; empty state matches Splendid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {calls.length === 0 ? (
          <div className="px-6 py-8">
            <p className="font-semibold text-gray-800">Records Not Exist</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Number <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Subject <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Customer <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Type <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Call Date <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Duration <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Follow-up <SortIcon /></th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">{c.number}</td>
                  <td className="px-3 py-2 text-xs font-medium">{c.subject}</td>
                  <td className="px-3 py-2 text-xs">{c.customer_name || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{c.call_type || '—'}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{c.call_date?.slice(0, 16).replace('T', ' ') || '—'}</td>
                  <td className="px-3 py-2 text-xs">{c.duration_minutes ? `${c.duration_minutes}m` : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{c.follow_up_required ? (c.follow_up_date?.slice(0, 10) || 'Yes') : '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button title="Edit" className="text-blue-500 hover:text-blue-700"
                        onClick={() => { setEditing(c); setShowForm(true); }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button title="Delete" className="text-red-400 hover:text-red-600"
                        onClick={async () => { if (confirm('Delete this call?')) { await deleteCrmCall(c.id); load(); } }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* FILTERS Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white border-2 border-green-500 rounded-lg shadow-2xl w-full max-w-xl mx-4">
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-red-600 z-10">×</button>

            <div className="px-6 py-5 space-y-3">
              {/* Contact */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Contact</label>
                <div className="flex-1 relative">
                  <input type="text" placeholder="Type to search contact"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
                    value={pendingFilters.contact} onChange={e => setPendingFilters(p => ({ ...p, contact: e.target.value }))} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Assigned To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Assigned To</label>
                <div className="flex-1 relative">
                  <input type="text" placeholder="Type to search assigned to"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
                    value={pendingFilters.assignedTo} onChange={e => setPendingFilters(p => ({ ...p, assignedTo: e.target.value }))} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Status</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <select className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none"
                    value={pendingFilters.status} onChange={e => setPendingFilters(p => ({ ...p, status: e.target.value }))}>
                    <option value="">Select status</option>
                    <option value="planned">Planned</option>
                    <option value="completed">Completed</option>
                    <option value="missed">Missed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span className="px-2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Priority</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <select className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none"
                    value={pendingFilters.priority} onChange={e => setPendingFilters(p => ({ ...p, priority: e.target.value }))}>
                    <option value="">Select priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <span className="px-2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Start Date From/To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Start Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.startFrom} onChange={e => setPendingFilters(p => ({ ...p, startFrom: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.startTo} onChange={e => setPendingFilters(p => ({ ...p, startTo: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                </div>
              </div>

              {/* End Date From/To */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">End Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">From:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.endFrom} onChange={e => setPendingFilters(p => ({ ...p, endFrom: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">To:</span>
                  <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden min-w-0">
                    <input type="date" className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
                      value={pendingFilters.endTo} onChange={e => setPendingFilters(p => ({ ...p, endTo: e.target.value }))} />
                    <span className="px-2 text-gray-400"><CalIcon /></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3 flex items-center gap-2">
              <button onClick={() => {}} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters} className="flex items-center gap-1 bg-gray-200 text-gray-600 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                APPLY
              </button>
              <button onClick={clearFilters} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

