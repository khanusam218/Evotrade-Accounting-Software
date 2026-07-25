import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';

interface Category { id: number; name: string; }
interface Counter {
  id: number; name: string;
  warehouse_id: number | null; warehouse_name?: string;
  notes: string | null; is_active: boolean;
  categories: Category[];
}

const j = (r: Response) => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(new Error(e.error)));

// ─── Multi-Select Dropdown ────────────────────────────────────────────────────
function MultiSelect({ all, selected, onChange, placeholder }: {
  all: Category[]; selected: number[]; onChange: (ids: number[]) => void; placeholder: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const selectedItems = all.filter(c => selected.includes(c.id));
  const filtered      = all.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div className="relative" ref={ref}>
      <div
        className="min-h-[38px] w-full border border-gray-300 rounded px-2 py-1.5 flex flex-wrap gap-1 items-center cursor-pointer bg-white focus-within:ring-1 focus-within:ring-green-500"
        onClick={() => setOpen(v => !v)}>
        {selectedItems.map(c => (
          <span key={c.id} className="flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
            {c.name}
            <button type="button" className="hover:text-green-900 leading-none"
              onClick={e => { e.stopPropagation(); toggle(c.id); }}>×</button>
          </span>
        ))}
        {selectedItems.length === 0 && <span className="text-gray-400 text-sm">{placeholder}</span>}
        <svg className="ml-auto h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-56 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Search categories…" value={search}
              onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No categories found</p>
            ) : filtered.map(c => (
              <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={e => e.stopPropagation()}>
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="text-sm text-gray-700">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail Form (full-page) ──────────────────────────────────────────────────
function CounterDetail({ initial, categories, onSave, onClose }: {
  initial: Counter | null;
  categories: Category[];
  onSave: (d: Record<string, unknown>, mode: 'new' | 'close') => Promise<void>;
  onClose: () => void;
}) {
  const [name,    setName]    = useState(initial?.name ?? '');
  const [catIds,  setCatIds]  = useState<number[]>(initial?.categories.map(c => c.id) ?? []);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dropOpen]);

  async function save(mode: 'new' | 'close') {
    if (!name.trim()) { setError('Name is required'); return; }
    if (catIds.length === 0) { setError('At least one product category is required'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ name: name.trim(), category_ids: catIds, is_active: true }, mode);
      if (mode === 'new') { setName(''); setCatIds([]); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-3xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Delivery Counter - {initial ? `Edit [${initial.name}]` : 'Add []'}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Product Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Categories <span className="text-red-500">*</span>
            </label>
            <MultiSelect all={categories} selected={catIds} onChange={setCatIds} placeholder="Product Categories" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          {/* SAVE AND NEW split button */}
          <div className="relative flex" ref={dropRef}>
            <button type="button" onClick={() => save('new')} disabled={saving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-l disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button type="button" onClick={() => setDropOpen(v => !v)} disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-r border-l border-green-500 disabled:opacity-60">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </button>
            {dropOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-gray-200 rounded shadow-lg z-20">
                <button type="button" onClick={() => { setDropOpen(false); save('close'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Save and Close
                </button>
              </div>
            )}
          </div>

          {/* CLOSE */}
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
            <span className="text-base leading-none">×</span>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DeliveryCounterPage() {
  const [view,       setView]       = useState<'list' | 'detail'>('list');
  const [counters,   setCounters]   = useState<Counter[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState<Counter | null>(null);
  const [actErr,     setActErr]     = useState('');
  const [search,     setSearch]     = useState('');
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('asc');
  const [page,       setPage]       = useState(1);
  const [perPage,    setPerPage]    = useState(50);

  async function load() {
    setLoading(true);
    try {
      const [c, cat] = await Promise.all([
        apiFetch('/api/pos-delivery-counters').then(j),
        apiFetch('/api/product-categories').then(j),
      ]);
      setCounters(c as Counter[]); setCategories(cat as Category[]);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(d: Record<string, unknown>, mode: 'new' | 'close') {
    if (editing) {
      await apiFetch(`/api/pos-delivery-counters/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j);
    } else {
      await apiFetch('/api/pos-delivery-counters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j);
    }
    await load();
    if (mode === 'close') { setView('list'); setEditing(null); }
    else { setEditing(null); }
  }

  async function handleDelete(c: Counter) {
    if (!confirm(`Delete counter "${c.name}"?`)) return;
    setActErr('');
    try {
      await apiFetch(`/api/pos-delivery-counters/${c.id}`, { method: 'DELETE' }).then(j);
      await load();
    } catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Error'); }
  }

  if (view === 'detail') {
    return (
      <CounterDetail
        initial={editing}
        categories={categories}
        onSave={handleSave}
        onClose={() => { setView('list'); setEditing(null); }}
      />
    );
  }

  const sorted = counters
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) * (sortDir === 'asc' ? 1 : -1));

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated  = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Delivery Counters</h1>
        <button onClick={() => { setEditing(null); setView('detail'); }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD DELIVERY COUNTER
        </button>
      </div>

      {actErr && <div className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{actErr}</div>}

      {/* Search */}
      <div className="mb-3 flex justify-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Search</label>
          <input
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-green-500"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-50"
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                Name <span className="text-gray-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={2} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-6 text-sm text-amber-500 font-medium">No record found</td></tr>
            ) : paginated.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button onClick={() => { setEditing(c); setView('detail'); }}
                    className="text-green-600 hover:underline font-medium text-sm text-left">
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(c)}
                    className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                ‹
              </button>
              <button className="h-8 w-8 flex items-center justify-center rounded bg-green-600 text-white text-sm font-semibold">
                {page}
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                ›
              </button>
            </div>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
