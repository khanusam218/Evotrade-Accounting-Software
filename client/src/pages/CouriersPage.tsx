import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';

interface Courier {
  id: number; code: string; print_name: string; courier_name?: string;
  display_name?: string; contact_person?: string;
  phone?: string; phone2?: string; phone3?: string;
  email?: string; address?: string; address2?: string; city?: string; state?: string;
  zip?: string; country?: string; ntn?: string; cnic?: string;
  tracking_url?: string; notes?: string; is_active: boolean;
}

interface Filters { code?: string; name?: string; contact_person?: string; email?: string; phone?: string; }

type SortField = 'code' | 'print_name' | 'contact_person' | 'email' | 'phone';
type FormTab = 'general' | 'address';

const SVG = {
  edit:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trash:   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  filter:  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4-2A1 1 0 017 15v-4.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>,
  refresh: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  chevron: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  camera:  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: 'asc' | 'desc' }) {
  if (sortField !== field) return <span className="text-gray-400 ml-1 text-xs">⇅</span>;
  return <span className="text-blue-600 ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

function CourierForm({ initial, onSave, onClose }: { initial: Courier | null; onSave: (d: any) => Promise<void>; onClose: () => void }) {
  const isEdit = initial !== null;
  const [form, setForm]       = useState<Partial<Courier>>({ is_active: true, ...initial });
  const [tab, setTab]         = useState<FormTab>('general');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [nextCode, setNextCode] = useState(initial?.code || 'COU-000001');
  const [image, setImage]     = useState<string | null>(null);
  const fileRef               = useRef<HTMLInputElement>(null);
  const attachRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEdit) {
      apiFetch('/api/couriers/next-code').then(r => r.json()).then(d => setNextCode(d.code || 'COU-000001')).catch(() => {});
    }
  }, []);

  const set = (k: keyof Courier, v: any) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async (andNew: boolean) => {
    if (!form.print_name?.trim()) { setError('Courier Name is required'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ ...form, code: nextCode });
      if (andNew && !isEdit) {
        setForm({ is_active: true });
        setTab('general');
        setImage(null);
        apiFetch('/api/couriers/next-code').then(r => r.json()).then(d => setNextCode(d.code || 'COU-000001')).catch(() => {});
      } else {
        onClose();
      }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const inp = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder-gray-400';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? `Courier - Edit [${initial.code}]` : 'Courier - Add []'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-6">
            {(['general', 'address'] as FormTab[]).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`pb-3 text-sm font-medium border-b-2 capitalize transition-colors ${
                  tab === t ? 'border-green-500 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── GENERAL TAB ── */}
          {tab === 'general' && (
            <div className="space-y-5">
              {/* Row 1: Courier Code | Courier Name | Image */}
              <div className="flex gap-6 items-start">
                <div className="flex-1">
                  <label className={lbl}>Courier Code <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-1">
                    <button type="button" className="h-9 w-9 flex-shrink-0 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors">
                      {SVG.chevron}
                    </button>
                    <input readOnly className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 font-mono text-gray-700" value={nextCode} />
                    <button type="button"
                      onClick={() => apiFetch('/api/couriers/next-code').then(r => r.json()).then(d => setNextCode(d.code || 'CS-000001')).catch(() => {})}
                      className="h-9 w-9 flex-shrink-0 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors">
                      {SVG.refresh}
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className={lbl}>Courier Name <span className="text-red-500">*</span></label>
                  <input className={inp} placeholder="Courier Name" value={form.print_name || ''} onChange={e => set('print_name', e.target.value)} />
                </div>
                {/* Profile image */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div
                    className="w-20 h-20 rounded-full border-2 border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:border-green-400 transition-colors"
                    onClick={() => fileRef.current?.click()}>
                    {image
                      ? <img src={image} alt="profile" className="w-full h-full object-cover" />
                      : SVG.camera}
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="text-xs text-gray-500 border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 transition-colors">
                    Choose image
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
                </div>
              </div>

              {/* Row 2: Print Name | Display Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Print Name</label>
                  <input className={inp} placeholder="Print Name" value={form.courier_name || ''} onChange={e => set('courier_name', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Display Name</label>
                  <input className={inp} placeholder="Display Name" value={form.display_name || ''} onChange={e => set('display_name', e.target.value)} />
                </div>
              </div>

              {/* Row 3: Email | Phone 1 | Phone 2 | Phone 3 */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" className={inp} placeholder="Email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Phone 1</label>
                  <input className={inp} placeholder="Phone 1" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Phone 2</label>
                  <input className={inp} placeholder="Phone 2" value={form.phone2 || ''} onChange={e => set('phone2', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Phone 3</label>
                  <input className={inp} placeholder="Phone 3" value={form.phone3 || ''} onChange={e => set('phone3', e.target.value)} />
                </div>
              </div>

              {/* Tracking URL */}
              <div>
                <label className={lbl}>Tracking URL</label>
                <input className={inp} placeholder="https://track.example.com/?id=" value={form.tracking_url || ''} onChange={e => set('tracking_url', e.target.value)} />
              </div>

              {/* Attachments */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Attachments</h3>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors cursor-pointer"
                  onClick={() => attachRef.current?.click()}>
                  <p className="text-sm text-gray-400 mb-3">Drop files here or</p>
                  <button type="button"
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded transition-colors">
                    BROWSE FILES
                  </button>
                  <input ref={attachRef} type="file" multiple className="hidden" />
                </div>
              </div>
            </div>
          )}

          {/* ── ADDRESS TAB ── */}
          {tab === 'address' && (
            <div className="space-y-5">
              {/* Row 1: Address Line 1 | Address Line 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Address Line 1</label>
                  <textarea className={inp + ' resize-none'} rows={3} placeholder="Address Line 1"
                    value={form.address || ''} onChange={e => set('address', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Address Line 2</label>
                  <textarea className={inp + ' resize-none'} rows={3} placeholder="Address Line 2"
                    value={form.address2 || ''} onChange={e => set('address2', e.target.value)} />
                </div>
              </div>

              {/* Row 2: City | State | Zip | Country (dropdown) */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={lbl}>City</label>
                  <input className={inp} placeholder="City" value={form.city || ''} onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <input className={inp} placeholder="State" value={form.state || ''} onChange={e => set('state', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Zip</label>
                  <input className={inp} placeholder="Zip" value={form.zip || ''} onChange={e => set('zip', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Country</label>
                  <select className={inp} value={form.country || ''} onChange={e => set('country', e.target.value)}>
                    <option value="">-Choose-</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="Afghanistan">Afghanistan</option>
                    <option value="UAE">UAE</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                    <option value="China">China</option>
                    <option value="India">India</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Contact Person | NTN (green) | CNIC (green) */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Contact Person</label>
                  <input className={inp} placeholder="Contact Person" value={form.contact_person || ''} onChange={e => set('contact_person', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-600 mb-1">NTN</label>
                  <input className={inp} placeholder="NTN" value={form.ntn || ''} onChange={e => set('ntn', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-600 mb-1">CNIC</label>
                  <input className={inp} placeholder="CNIC" value={form.cnic || ''} onChange={e => set('cnic', e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — matches Splendid: SAVE AND NEW (gray + dropdown arrow) | CLOSE (orange) */}
        <div className="border-t border-gray-200 px-6 py-4 bg-white flex gap-2 justify-end shrink-0">
          {!isEdit && (
            <div className="flex">
              <button type="button" onClick={() => submit(true)} disabled={saving}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm font-semibold px-5 py-2 rounded-l transition-colors disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'SAVING…' : 'SAVE AND NEW'}
              </button>
              <button type="button"
                className="bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm font-semibold px-2 py-2 rounded-r border-l border-gray-300 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            CLOSE
          </button>
        </div>
    </div>
  );
}

export default function CouriersPage() {
  const [couriers,  setCouriers]  = useState<Courier[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Courier | null>(null);

  // Filters
  const [showFilters,     setShowFilters]     = useState(false);
  const [pendingFilters,  setPendingFilters]  = useState<Filters>({});
  const [appliedFilters,  setAppliedFilters]  = useState<Filters>({});

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams();
      if (appliedFilters.code)           p.set('code', appliedFilters.code);
      if (appliedFilters.name)           p.set('search', appliedFilters.name);
      if (appliedFilters.contact_person) p.set('contact_person', appliedFilters.contact_person);
      if (appliedFilters.email)          p.set('email', appliedFilters.email);
      if (appliedFilters.phone)          p.set('phone', appliedFilters.phone);

      let data: Courier[] = await apiFetch('/api/couriers?' + p).then(r => r.json());
      if (!Array.isArray(data)) data = [];

      if (sortField) {
        data.sort((a, b) => {
          const av = (a[sortField] ?? '') as string;
          const bv = (b[sortField] ?? '') as string;
          const cmp = av.localeCompare(bv);
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
      setCouriers(data);
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
    const url    = editing ? `/api/couriers/${editing.id}` : '/api/couriers';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error((await r.json()).error || 'Save failed');
    load();
  };

  const del = async (id: number) => {
    if (!confirm('Are you sure you want to delete this courier?')) return;
    const r = await fetch(`/api/couriers/${id}`, { method: 'DELETE' });
    if (!r.ok) { setError((await r.json()).error || 'Delete failed'); return; }
    load();
  };

  const appliedCount = Object.values(appliedFilters).filter(Boolean).length;
  const thCls = 'px-4 py-3 text-left font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap';

  if (showForm) return (
        <CourierForm
      initial={editing}
      onSave={save}
      onClose={() => { setShowForm(false); setEditing(null); }}
    />
  );

  return (
    <div className="p-6">
      {/* Row 1: Title + ADD button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Courier</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded font-semibold text-sm transition-colors"
        >
          + ADD COURIER
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

      {/* Row 2: FILTERS (left only — no Print/Export for Couriers) */}
      <div className="flex items-center mb-6">
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : couriers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-orange-500 font-medium">No record found</td></tr>
            ) : couriers.map(c => (
              <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.code || '—'}</td>
                <td className="px-4 py-3 text-blue-600 font-medium cursor-pointer hover:underline"
                  onClick={() => { setEditing(c); setShowForm(true); }}>{c.print_name}</td>
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

          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl border-2 border-green-400 flex flex-col">

            {/* Red circle X */}
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-3.5 -right-3.5 z-10 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Body — 2-column label | input */}
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
            </div>

            {/* Footer: SAVE FILTER (left) | APPLY (center) | CLEAR (right) */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
              <button type="button" onClick={() => setShowFilters(false)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-semibold text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                SAVE FILTER
              </button>

              <div className="flex-1" />

              <button type="button" onClick={() => { setAppliedFilters(pendingFilters); setShowFilters(false); }}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-600 px-5 py-2 rounded font-semibold text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                </svg>
                APPLY
              </button>

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

      {/* Courier Form Slide-over */}
    </div>
  );
}

