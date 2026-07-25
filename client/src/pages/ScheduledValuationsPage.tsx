import { apiFetch } from '../api/apiFetch';
import { useEffect, useMemo, useState } from 'react';

interface ScheduledValuation {
  id: number;
  date: string;
  narration: string | null;
  status: string;
  created_at: string;
}

interface Filters {
  dateFrom:       string;
  dateTo:         string;
  sourceDateFrom: string;
  sourceDateTo:   string;
  narration:      string;
}

interface FormState {
  date:      string;
  narration: string;
  status:    string;
}

const EMPTY_FILTERS: Filters   = { dateFrom: '', dateTo: '', sourceDateFrom: '', sourceDateTo: '', narration: '' };
const EMPTY_FORM:   FormState  = { date: new Date().toISOString().split('T')[0], narration: '', status: 'pending' };
const PAGE_SIZES = [10, 25, 50, 100];

const SortIcon = () => (
  <svg className="inline-block ml-1 w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

const BASE = '/api/scheduled-valuations';
const j = (r: Response) => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(new Error(e.error)));

async function fetchAll(params: Record<string, string>): Promise<ScheduledValuation[]> {
  const q = Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  return apiFetch(BASE + q).then(j);
}

export default function ScheduledValuationsPage() {
  const [items,   setItems]   = useState<ScheduledValuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<ScheduledValuation | null>(null);
  const [form,    setForm]    = useState<FormState>(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  // List
  const [page,           setPage]           = useState(1);
  const [pageSize,       setPageSize]       = useState(50);
  const [showFilters,    setShowFilters]    = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  async function load() {
    setLoading(true);
    const p: Record<string, string> = {};
    if (appliedFilters.dateFrom)   p.date_from   = appliedFilters.dateFrom;
    if (appliedFilters.dateTo)     p.date_to     = appliedFilters.dateTo;
    if (appliedFilters.narration)  p.narration   = appliedFilters.narration;
    try { setItems(await fetchAll(p)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [appliedFilters]);

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setError(''); setView('form');
  }
  function openEdit(item: ScheduledValuation) {
    setEditing(item);
    setForm({ date: item.date?.slice(0, 10) || '', narration: item.narration || '', status: item.status });
    setError(''); setView('form');
  }
  function closeForm() { setView('list'); setEditing(null); setError(''); load(); }

  const setF = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSave(andNew = false) {
    if (!form.date) { setError('Date is required'); return; }
    setError(''); setSaving(true);
    try {
      const payload = { date: form.date, narration: form.narration || null, status: form.status };
      if (editing)
        await apiFetch(`${BASE}/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(j);
      else
        await apiFetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(j);
      await load();
      if (andNew) { setEditing(null); setForm(EMPTY_FORM); }
      else closeForm();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this valuation?')) return;
    try {
      await apiFetch(`${BASE}/${id}`, { method: 'DELETE' }).then(j);
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  }

  function applyFilters() { setAppliedFilters({ ...pendingFilters }); setShowFilters(false); setPage(1); }
  function clearFilters()  { setPendingFilters(EMPTY_FILTERS); }
  const hasActiveFilters = Object.values(appliedFilters).some(v => v !== '');

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginated  = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  /* ── FORM VIEW ── */
  if (view === 'form') {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">
              Scheduled Valuations - {editing ? `Edit [${editing.date?.slice(0,10)}]` : 'Add []'}
            </h2>
            <span className="text-lg font-bold tracking-widest text-gray-700 uppercase">
              {editing?.status ?? 'pending'}
            </span>
          </div>

          {error && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="date" className="flex-1 px-2 py-2 text-sm focus:outline-none min-w-0"
                  value={form.date} onChange={setF('date')} />
                <button onClick={() => setForm(f => ({ ...f, date: '' }))} className="px-2 text-gray-400 hover:text-gray-700">✕</button>
                <span className="px-2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </span>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                value={form.status} onChange={setF('status')}>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Narration */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
            <textarea rows={4}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
              placeholder="Narration"
              value={form.narration} onChange={setF('narration')} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
            <div className="flex items-center">
              <button onClick={() => handleSave(false)} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-l disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                {saving ? 'Saving…' : 'SAVE AND NEW'}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving}
                className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-r border-l border-green-500 disabled:opacity-50">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
            <button onClick={closeForm}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              CLOSE
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-gray-900">Scheduled Valuations</h1>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            ADD SCHEDULED VALUATION
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => { setPendingFilters({ ...appliedFilters }); setShowFilters(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
            FILTERS{hasActiveFilters ? ' ●' : ''}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : (
          <>
            <table className="w-full text-sm border-t border-gray-200">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Date <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Narration <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 cursor-pointer whitespace-nowrap">Status <SortIcon /></th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-orange-500 text-sm">No record found</td></tr>
                ) : paginated.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline text-sm font-medium">
                        {item.date?.slice(0, 10)}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{item.narration}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold uppercase ${
                        item.status === 'completed' ? 'text-green-600' :
                        item.status === 'cancelled' ? 'text-red-500'   : 'text-gray-500'
                      }`}>{item.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-600 inline-flex">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${p === page ? 'bg-green-500 text-white border border-green-500' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm">›</button>
              </div>
              <select className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-600 focus:outline-none"
                value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* FILTERS Modal — matches Splendid layout exactly */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white rounded-lg border-2 border-green-400 shadow-xl w-full max-w-2xl mx-4">
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm flex items-center justify-center font-bold shadow">
              ×
            </button>
            <div className="px-6 py-5 space-y-4">
              {/* Date row */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-28 flex-shrink-0">Date</span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-500 whitespace-nowrap">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateFrom} onChange={e => setPendingFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500 whitespace-nowrap">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateTo} onChange={e => setPendingFilters(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>
              {/* Source Date row */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-28 flex-shrink-0">Source Date</span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-500 whitespace-nowrap">From:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.sourceDateFrom} onChange={e => setPendingFilters(f => ({ ...f, sourceDateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-500 whitespace-nowrap">To:</span>
                  <input type="date" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.sourceDateTo} onChange={e => setPendingFilters(f => ({ ...f, sourceDateTo: e.target.value }))} />
                </div>
              </div>
              {/* Narration row */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-28 flex-shrink-0">Narration</span>
                <input type="text" placeholder="Type to search narration"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.narration} onChange={e => setPendingFilters(f => ({ ...f, narration: e.target.value }))} />
              </div>
            </div>
            {/* Footer: SAVE FILTER | APPLY | CLEAR — left to right matching Splendid */}
            <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={applyFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                SAVE FILTER
              </button>
              <button onClick={applyFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-500 text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                APPLY
              </button>
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

