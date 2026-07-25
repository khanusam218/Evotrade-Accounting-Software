import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/apiFetch';

const COUNTRIES = [
  'Pakistan', 'Afghanistan', 'Bangladesh', 'China', 'India', 'Iran',
  'Iraq', 'Jordan', 'Kuwait', 'Malaysia', 'Oman', 'Qatar', 'Saudi Arabia',
  'Turkey', 'UAE', 'United Kingdom', 'United States', 'Other',
];

interface Prospect {
  id: number; code: string; print_name: string; display_name?: string;
  contact_person?: string; phone?: string; phone_2?: string; phone_3?: string;
  email?: string; address_line_1?: string; address_line_2?: string;
  city?: string; state?: string; zip?: string; country?: string;
  ntn?: string; cnic?: string; industry?: string; source?: string;
  notes?: string; status: string; photo_url?: string;
  converted_customer_name?: string;
}

type Tab = 'general' | 'address';

interface FormProps {
  initial: Prospect | null;
  onSave: (data: Partial<Prospect>) => Promise<void>;
  onSaveAndNew: (data: Partial<Prospect>) => Promise<void>;
  onClose: () => void;
}

function ProspectForm({ initial, onSave, onSaveAndNew, onClose }: FormProps) {
  const isEdit = initial !== null;
  const [tab, setTab]               = useState<Tab>('general');
  const [nextCode, setNextCode]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const [printName, setPrintName]   = useState(initial?.print_name ?? '');
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
  const [email, setEmail]           = useState(initial?.email ?? '');
  const [phone, setPhone]           = useState(initial?.phone ?? '');
  const [phone2, setPhone2]         = useState(initial?.phone_2 ?? '');
  const [phone3, setPhone3]         = useState(initial?.phone_3 ?? '');
  const [photoUrl, setPhotoUrl]     = useState(initial?.photo_url ?? '');
  const [industry, setIndustry]     = useState(initial?.industry ?? '');
  const [source, setSource]         = useState(initial?.source ?? '');
  const [notes, setNotes]           = useState(initial?.notes ?? '');
  const [status, setStatus]         = useState(initial?.status ?? 'active');
  const [addrLine1, setAddrLine1]   = useState(initial?.address_line_1 ?? '');
  const [addrLine2, setAddrLine2]   = useState(initial?.address_line_2 ?? '');
  const [city, setCity]             = useState(initial?.city ?? '');
  const [stateVal, setStateVal]     = useState(initial?.state ?? '');
  const [zip, setZip]               = useState(initial?.zip ?? '');
  const [country, setCountry]       = useState(initial?.country ?? '');
  const [contactPerson, setContactPerson] = useState(initial?.contact_person ?? '');
  const [ntn, setNtn]               = useState(initial?.ntn ?? '');
  const [cnic, setCnic]             = useState(initial?.cnic ?? '');

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEdit) {
      apiFetch('/api/prospects/next-code')
        .then(r => r.json()).then(d => setNextCode(d.code)).catch(() => {});
    }
  }, [isEdit]);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoUrl((ev.target?.result as string) ?? '');
    reader.readAsDataURL(file);
  }

  function buildPayload(): Partial<Prospect> {
    return {
      print_name: printName, display_name: displayName || undefined,
      email: email || undefined, phone: phone || undefined,
      phone_2: phone2 || undefined, phone_3: phone3 || undefined,
      photo_url: photoUrl || undefined,
      industry: industry || undefined, source: source || undefined,
      notes: notes || undefined, status,
      address_line_1: addrLine1 || undefined, address_line_2: addrLine2 || undefined,
      city: city || undefined, state: stateVal || undefined,
      zip: zip || undefined, country: country || undefined,
      contact_person: contactPerson || undefined,
      ntn: ntn || undefined, cnic: cnic || undefined,
    };
  }

  async function submit(andNew: boolean, e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!printName.trim()) { setError('Prospect Name is required'); return; }
    setSaving(true);
    try {
      if (andNew) await onSaveAndNew(buildPayload());
      else await onSave(buildPayload());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="w-full flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? `Prospect - Edit [${initial.code}]` : `Prospect - Add [${nextCode || '…'}]`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 shrink-0">
          {(['general', 'address'] as Tab[]).map(t => (
            <button key={t} type="button"
              className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setTab(t)}
            >{t}</button>
          ))}
        </div>

        <form onSubmit={e => submit(false, e)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

            {/* ── General Tab ── */}
            {tab === 'general' && (
              <div className="space-y-4">

                {/* Row 1: Code · Industry · Status */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Prospect Code</label>
                    <input className="input bg-gray-50 cursor-not-allowed font-mono text-sm"
                      readOnly value={isEdit ? initial.code : (nextCode || 'Auto')} />
                  </div>
                  <div>
                    <label className="label">Industry</label>
                    <input className="input" placeholder="e.g. Technology" value={industry}
                      onChange={e => setIndustry(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="converted">Converted</option>
                    </select>
                  </div>
                </div>

                {/* Image + Names block */}
                <div className="flex gap-6 items-start">
                  {/* Circular image */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-24 h-24 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                      {photoUrl
                        ? <img src={photoUrl} alt="prospect" className="w-full h-full object-cover" />
                        : <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"/>
                          </svg>
                      }
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="text-xs text-indigo-600 hover:underline font-medium">Choose image</button>
                    {photoUrl && (
                      <button type="button" onClick={() => { setPhotoUrl(''); if (fileRef.current) fileRef.current.value = ''; }}
                        className="text-xs text-red-400 hover:underline">Remove</button>
                    )}
                  </div>

                  {/* Name fields */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="label">Prospect Name <span className="text-red-500">*</span></label>
                      <input className="input" placeholder="Full prospect / company name"
                        value={printName} onChange={e => setPrintName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Display Name</label>
                      <input className="input" placeholder="Short display name"
                        value={displayName} onChange={e => setDisplayName(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" placeholder="email@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                {/* Phones */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Phone 1</label>
                    <input className="input" placeholder="+92 300 0000000"
                      value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Phone 2</label>
                    <input className="input" placeholder="Alternate phone"
                      value={phone2} onChange={e => setPhone2(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Phone 3</label>
                    <input className="input" placeholder="Another phone"
                      value={phone3} onChange={e => setPhone3(e.target.value)} />
                  </div>
                </div>

                {/* Source + Notes */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Source</label>
                    <select className="input" value={source} onChange={e => setSource(e.target.value)}>
                      <option value="">— Select —</option>
                      {['Website','Referral','Social Media','Cold Call','Exhibition','Advertisement','Other'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="input resize-none" rows={2} placeholder="Additional notes"
                      value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Address Tab ── */}
            {tab === 'address' && (
              <div className="space-y-4">
                <div>
                  <label className="label">Address Line 1</label>
                  <textarea className="input resize-none" rows={2} placeholder="Street address"
                    value={addrLine1} onChange={e => setAddrLine1(e.target.value)} />
                </div>
                <div>
                  <label className="label">Address Line 2</label>
                  <textarea className="input resize-none" rows={2} placeholder="Suite, unit, building, floor"
                    value={addrLine2} onChange={e => setAddrLine2(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">City</label>
                    <input className="input" placeholder="City"
                      value={city} onChange={e => setCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">State / Province</label>
                    <input className="input" placeholder="State"
                      value={stateVal} onChange={e => setStateVal(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">ZIP / Postal Code</label>
                    <input className="input" placeholder="00000"
                      value={zip} onChange={e => setZip(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Country</label>
                  <select className="input" value={country} onChange={e => setCountry(e.target.value)}>
                    <option value="">— Select Country —</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Contact Person</label>
                  <input className="input" placeholder="Contact person name"
                    value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" style={{ color: '#15803d' }}>NTN</label>
                    <input className="input" placeholder="National Tax Number"
                      value={ntn} onChange={e => setNtn(e.target.value)}
                      style={{ borderColor: '#bbf7d0' }} />
                  </div>
                  <div>
                    <label className="label" style={{ color: '#15803d' }}>CNIC</label>
                    <input className="input" placeholder="00000-0000000-0"
                      value={cnic} onChange={e => setCnic(e.target.value)}
                      style={{ borderColor: '#bbf7d0' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 flex items-center gap-2 shrink-0">
            <div className="flex">
              <button
                type="submit"
                disabled={saving}
                className="bg-gray-200 text-gray-600 px-5 py-2 text-sm font-medium hover:bg-gray-300 rounded-l"
              >
                {saving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              {!isEdit && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={e => submit(true, e as unknown as React.FormEvent)}
                  className="bg-gray-200 text-gray-600 px-2 py-2 hover:bg-gray-300 rounded-r border-l border-gray-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 bg-yellow-400 text-white px-5 py-2 text-sm font-medium rounded hover:bg-yellow-500"
            >
              <span className="text-lg leading-none">&times;</span> CLOSE
            </button>
          </div>
        </form>
    </div>
  );
}

interface FilterState {
  code: string; name: string; contactPerson: string; email: string; phone: string; status: string;
}
const emptyFilter = (): FilterState => ({ code: '', name: '', contactPerson: '', email: '', phone: '', status: '' });

export default function ProspectsPage() {
  const [prospects, setProspects]   = useState<Prospect[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft]           = useState<FilterState>(emptyFilter());
  const [applied, setApplied]       = useState<FilterState>(emptyFilter());
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Prospect | null>(null);
  const [error, setError]           = useState('');

  const hasActiveFilter = Object.values(applied).some(Boolean);

  const load = (f: FilterState) => {
    const params = new URLSearchParams();
    if (f.name)    params.set('search', f.name);
    if (f.status)  params.set('status', f.status);
    apiFetch('/api/prospects?' + params)
      .then(r => r.json())
      .then((data: Prospect[]) => {
        let filtered = data;
        if (f.code)          filtered = filtered.filter(p => p.code.toLowerCase().includes(f.code.toLowerCase()));
        if (f.contactPerson) filtered = filtered.filter(p => (p.contact_person ?? '').toLowerCase().includes(f.contactPerson.toLowerCase()));
        if (f.email)         filtered = filtered.filter(p => (p.email ?? '').toLowerCase().includes(f.email.toLowerCase()));
        if (f.phone)         filtered = filtered.filter(p => (p.phone ?? '').includes(f.phone));
        setProspects(filtered);
      })
      .catch(e => setError(e.message));
  };

  useEffect(() => { load(applied); }, [applied]);

  const save = async (data: Partial<Prospect>) => {
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/prospects/${editing.id}` : '/api/prospects';
    const r = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json()).error);
    load(applied);
    setShowForm(false);
    setEditing(null);
  };

  const saveAndNew = async (data: Partial<Prospect>) => {
    const r = await apiFetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json()).error);
    load(applied);
    setEditing(null);
    setShowForm(false);
    setTimeout(() => setShowForm(true), 50);
  };

  const del = async (id: number) => {
    if (!confirm('Delete this prospect?')) return;
    const r = await apiFetch(`/api/prospects/${id}`, { method: 'DELETE' });
    if (!r.ok) { setError((await r.json()).error); return; }
    load(applied);
  };

  const openEdit = (p: Prospect) => { setEditing(p); setShowForm(true); };

  if (showForm) return (
        <ProspectForm
      initial={editing}
      onSave={save}
      onSaveAndNew={saveAndNew}
      onClose={() => { setShowForm(false); setEditing(null); }}
    />
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Prospects</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-5 py-2 rounded transition-colors"
        >
          + ADD PROSPECT
        </button>
      </div>

      {error && <p className="text-red-600 mb-2 text-sm">{error}</p>}

      {/* Toolbar */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => { setDraft({ ...applied }); setShowFilters(true); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-colors ${
            hasActiveFilter ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M13 16h-2" />
          </svg>
          FILTERS
          {hasActiveFilter && <span className="ml-1 bg-white text-green-600 text-xs rounded-full px-1.5 py-0.5 font-bold">●</span>}
        </button>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-2xl border-2 border-green-500">
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600 z-10">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="px-6 py-5 space-y-3">
              {[
                { label: 'Code',           placeholder: 'Type to search code',           key: 'code' },
                { label: 'Name',           placeholder: 'Type to search name',           key: 'name' },
                { label: 'Contact Person', placeholder: 'Type to search contact person', key: 'contactPerson' },
                { label: 'Email',          placeholder: 'Type to search email',          key: 'email' },
                { label: 'Phone',          placeholder: 'Type to search phone',          key: 'phone' },
              ].map(({ label, placeholder, key }) => (
                <div key={key} className="flex items-center gap-4">
                  <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">{label}</label>
                  <input
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder={placeholder}
                    value={draft[key as keyof FilterState]}
                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-medium text-gray-700 flex-shrink-0">Status</label>
                <select
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={draft.status}
                  onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="converted">Converted</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button type="button"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                SAVE FILTER
              </button>
              <button type="button"
                onClick={() => { setApplied({ ...draft }); setShowFilters(false); }}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                APPLY
              </button>
              <button type="button"
                onClick={() => setDraft(emptyFilter())}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Photo</th>
              <th className="table-th">Code</th>
              <th className="table-th">Prospect Name</th>
              <th className="table-th">Contact</th>
              <th className="table-th">Phone</th>
              <th className="table-th">Email</th>
              <th className="table-th">City</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="table-td">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {p.photo_url
                      ? <img src={p.photo_url} alt={p.print_name} className="w-full h-full object-cover" />
                      : <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                    }
                  </div>
                </td>
                <td className="table-td font-mono text-xs text-gray-500">{p.code}</td>
                <td className="table-td font-medium text-gray-900">{p.print_name}</td>
                <td className="table-td text-gray-600">{p.contact_person || '—'}</td>
                <td className="table-td text-gray-600">{p.phone || '—'}</td>
                <td className="table-td text-gray-600">{p.email || '—'}</td>
                <td className="table-td text-gray-500">{p.city || '—'}</td>
                <td className="table-td">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === 'active'    ? 'bg-blue-100 text-blue-800' :
                    p.status === 'converted' ? 'bg-green-100 text-green-800' :
                                               'bg-gray-100 text-gray-600'
                  }`}>{p.status}</span>
                </td>
                <td className="table-td">
                  <button className="text-xs text-indigo-600 hover:underline mr-2"
                    onClick={() => openEdit(p)}>Edit</button>
                  <button className="text-xs text-red-600 hover:underline"
                    onClick={() => del(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {prospects.length === 0 && (
              <tr><td colSpan={9} className="table-td text-center text-gray-400 py-10">No prospects found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
