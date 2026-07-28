import { useEffect, useState } from 'react';
import type { CrmLead, CrmActivity } from '../types/crmLead';
import { getCrmLeads, getCrmLead, deleteCrmLead, addActivity, deleteActivity, convertCrmLead } from '../api/crmLeads';
import { LEAD_STATUSES } from '../types/crmLead';
import CrmLeadForm from '../components/CrmLeadForm';

// ── Activity Panel ────────────────────────────────────────────────────────────
function ActivityPanel({ lead, onClose, onRefresh }: { lead: CrmLead; onClose: () => void; onRefresh: () => void }) {
  const [full,    setFull]    = useState<CrmLead | null>(null);
  const [type,    setType]    = useState('note');
  const [date,    setDate]    = useState(new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState('');
  const [desc,    setDesc]    = useState('');
  const [adding,  setAdding]  = useState(false);

  useEffect(() => { getCrmLead(lead.id).then(setFull); }, [lead.id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setAdding(true);
    try {
      await addActivity(lead.id, { type, date, subject: subject || null, description: desc || null });
      setSubject(''); setDesc('');
      getCrmLead(lead.id).then(setFull); onRefresh();
    } finally { setAdding(false); }
  }

  async function handleDelAct(actId: number) {
    if (!confirm('Delete activity?')) return;
    await deleteActivity(lead.id, actId); getCrmLead(lead.id).then(setFull);
  }

  const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'task'];

  return (
    <div className="w-full flex flex-col bg-white">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{lead.name}</h2>
            {lead.company && <p className="text-sm text-gray-500">{lead.company}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <form onSubmit={handleAdd} className="border rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">Add Activity</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={type} onChange={e => setType(e.target.value)}>
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Subject</label>
              <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" rows={2} value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700" disabled={adding}>
                {adding ? 'Adding…' : 'Add Activity'}
              </button>
            </div>
          </form>
          <div className="space-y-2">
            {(full?.activities ?? []).map((act: CrmActivity) => (
              <div key={act.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{act.type}</span>
                    <span className="ml-2 text-xs text-gray-400">{act.date?.slice(0, 10)}</span>
                    {act.subject && <p className="text-sm font-medium mt-1">{act.subject}</p>}
                  </div>
                  <button onClick={() => handleDelAct(act.id)} className="text-gray-300 hover:text-red-500 text-xs">&times;</button>
                </div>
                {act.description && <p className="text-sm text-gray-600 mt-1">{act.description}</p>}
              </div>
            ))}
            {!full?.activities?.length && <p className="text-sm text-gray-400 text-center py-4">No activities yet</p>}
          </div>
        </div>
    </div>
  );
}

// ── Circular Progress Card ────────────────────────────────────────────────────
function StatusCard({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 bg-white min-w-[180px] border-l-4 border-l-gray-300">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight">{label || 'Unknown'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{count}/{total}</p>
      </div>
      <div className="relative shrink-0 w-12 h-12">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
          <circle cx="26" cy="26" r={r} fill="none" stroke="#ef4444" strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ── Sort Icon ─────────────────────────────────────────────────────────────────
function SortIcon() {
  return (
    <span className="inline-flex flex-col ml-1 text-gray-400" style={{ fontSize: 8, lineHeight: 1 }}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor" className="mt-0.5"><path d="M4 5L0 0h8z"/></svg>
    </span>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────
const emptyFilters = {
  number:     '',
  contact:    '',
  assignedTo: '',
  leadSource: '',
  leadStatus: '',
  city:       '',
  tag:        '',
  project:    '',
};
type Filters = typeof emptyFilters;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CrmPage() {
  const [leads,   setLeads]   = useState<CrmLead[]>([]);
  const [search,  setSearch]  = useState('');
  const [editing, setEditing] = useState<CrmLead | null | undefined>(undefined);
  const [viewing, setViewing] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...emptyFilters });
  const [showMore,       setShowMore]       = useState(false);

  // Pagination
  const [page,    setPage]    = useState(1);
  const [perPage, setPerPage] = useState(50);

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== '').length;

  async function load(f: Filters = appliedFilters, q = search) {
    setLoading(true);
    try {
      const p: Record<string, string> = {};
      if (q)            p.search = q;
      if (f.leadStatus) p.lead_status = f.leadStatus;
      if (f.leadSource) p.source = f.leadSource;
      let data = await getCrmLeads(p);
      if (f.number)     data = data.filter(l => (l.number ?? '').toLowerCase().includes(f.number.toLowerCase()));
      if (f.contact)    data = data.filter(l => (l.contact_name ?? '').toLowerCase().includes(f.contact.toLowerCase()));
      if (f.assignedTo) data = data.filter(l => (l.assigned_to ?? '').toLowerCase().includes(f.assignedTo.toLowerCase()));
      if (f.tag)        data = data.filter(l => (l.tag ?? '').toLowerCase().includes(f.tag.toLowerCase()));
      if (f.city)       data = data.filter(l => ((l as unknown as Record<string,string>).city ?? '').toLowerCase().includes(f.city.toLowerCase()));
      if (f.project)    data = data.filter(l => ((l as unknown as Record<string,string>).project ?? '').toLowerCase().includes(f.project.toLowerCase()));
      setLeads(data);
      setPage(1);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [search]);

  async function handleDelete(id: number) {
    if (!confirm('Delete this lead?')) return;
    try { await deleteCrmLead(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  }

  async function handleConvert(id: number) {
    if (!confirm('Convert this lead to a Customer?')) return;
    try { await convertCrmLead(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Convert failed'); }
  }

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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(leads.length / perPage));
  const pageLeads  = leads.slice((page - 1) * perPage, page * perPage);

  // Pipeline status summary cards
  const statusGroups = leads.reduce<Record<string, number>>((acc, l) => {
    const key = l.lead_status || 'Unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (editing !== undefined) return (
    <CrmLeadForm lead={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />
  );

  if (viewing) return (
    <ActivityPanel lead={viewing} onClose={() => setViewing(null)} onRefresh={load} />
  );

  return (
    <div className="p-6">
      {/* Row 1: Title + Add button */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Leads</h1>
        <button
          className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-600"
          onClick={() => setEditing(null)}
        >
          + ADD LEAD
        </button>
      </div>

      {/* Row 2: FILTERS (left) + Search (right) */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => { setPendingFilters({ ...appliedFilters }); setShowFilters(true); }}
          className="relative flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
          FILTERS
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-blue-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Search</span>
          <input
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-48"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Pipeline Status Summary Cards */}
      {!loading && Object.keys(statusGroups).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {Object.entries(statusGroups).map(([status, count]) => (
            <StatusCard key={status} label={status} count={count} total={leads.length} />
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Number <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Date <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Contact <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Phone 1 <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Phone 2 <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">City <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Assigned To <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Lead Source <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Lead Status <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Tags <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100">Projects <SortIcon /></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="px-3 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : pageLeads.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-10 text-center text-orange-500">No record found</td></tr>
            ) : pageLeads.map(l => (
              <tr key={l.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">
                  <button className="text-blue-600 hover:underline text-xs font-mono" onClick={() => setEditing(l)}>
                    {l.number ?? '—'}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{l.lead_date?.slice(0, 10) ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{l.contact_name || '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {l.phone ? (
                    <span className="flex items-center gap-1">
                      {l.phone}
                      <button
                        type="button"
                        title="Copy"
                        onClick={() => copyToClipboard(l.phone!)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-xs">—</td>
                <td className="px-3 py-2 text-xs">{(l as unknown as Record<string,string>).city || '—'}</td>
                <td className="px-3 py-2 text-xs">{l.assigned_to || '—'}</td>
                <td className="px-3 py-2 text-xs">{l.source || '—'}</td>
                <td className="px-3 py-2 text-xs">{l.lead_status || '—'}</td>
                <td className="px-3 py-2 text-xs">{l.tag || '—'}</td>
                <td className="px-3 py-2 text-xs">—</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button title="Edit" className="text-blue-500 hover:text-blue-700" onClick={() => setEditing(l)}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button title="Activities" className="text-gray-500 hover:text-gray-700" onClick={() => setViewing(l)}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </button>
                    <button title="Delete" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(l.id)}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    {l.converted_to_customer_id ? (
                      <span title="Converted to Customer" className="text-green-600 text-xs font-medium whitespace-nowrap">Converted</span>
                    ) : (
                      <button title="Convert to Customer" className="text-green-500 hover:text-green-700" onClick={() => handleConvert(l.id)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && leads.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${p === page ? 'bg-green-500 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none"
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      {/* FILTERS Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white border-2 border-green-500 rounded-lg shadow-2xl w-full max-w-xl mx-4">
            <button onClick={() => setShowFilters(false)} className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-red-600 z-10">×</button>

            <div className="px-6 py-5 space-y-3">
              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Number</label>
                <input type="text" placeholder="Type to search number" className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.number} onChange={e => setPendingFilters(p => ({ ...p, number: e.target.value }))} />
              </div>

              {/* Contact */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Contact</label>
                <div className="flex-1 relative">
                  <input type="text" placeholder="Type to search contact" className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
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
                  <input type="text" placeholder="Type to search assigned to" className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
                    value={pendingFilters.assignedTo} onChange={e => setPendingFilters(p => ({ ...p, assignedTo: e.target.value }))} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Lead Source */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Lead Source</label>
                <div className="flex-1 relative">
                  <input type="text" placeholder="Type to search lead source" className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
                    value={pendingFilters.leadSource} onChange={e => setPendingFilters(p => ({ ...p, leadSource: e.target.value }))} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Lead Status */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Lead Status</label>
                <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden">
                  <select className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white appearance-none min-w-0"
                    value={pendingFilters.leadStatus} onChange={e => setPendingFilters(p => ({ ...p, leadStatus: e.target.value }))}>
                    <option value="">Select lead status</option>
                    {LEAD_STATUSES.filter(s => s !== 'None').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="px-2 text-gray-400 pointer-events-none"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></span>
                </div>
              </div>

              {/* City */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">City</label>
                <input type="text" placeholder="Type to search city" className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  value={pendingFilters.city} onChange={e => setPendingFilters(p => ({ ...p, city: e.target.value }))} />
              </div>

              {/* Tags */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Tags</label>
                <div className="flex-1 relative">
                  <input type="text" placeholder="Type to search tags" className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
                    value={pendingFilters.tag} onChange={e => setPendingFilters(p => ({ ...p, tag: e.target.value }))} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* Projects */}
              <div className="flex items-center gap-4">
                <label className="w-28 shrink-0 text-sm text-gray-700">Projects</label>
                <div className="flex-1 relative">
                  <input type="text" placeholder="Type to search projects" className="w-full border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:border-blue-400"
                    value={pendingFilters.project} onChange={e => setPendingFilters(p => ({ ...p, project: e.target.value }))} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </span>
                </div>
              </div>

              {/* SHOW MORE */}
              <div className="flex justify-end pt-1">
                <button onClick={() => setShowMore(v => !v)} className="flex items-center gap-1 bg-green-500 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-600">
                  SHOW MORE
                  <svg className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
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
