import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';

interface Warehouse { id: number; name: string; }
interface Product   { id: number; name: string; }

interface AuditLine {
  id?: number;
  product_id: number | '';
  product_name?: string;
  description: string;
  warehouse_id: number | '';
  quantity: number;
}

interface StockAudit {
  id: number;
  number: string;
  warehouse_id: number | null;
  warehouse_name?: string;
  date: string;
  status: 'draft' | 'completed';
  no_of_products?: number;
  lines?: AuditLine[];
}

interface FormState {
  warehouse_id: number | '';
  date: string;
}

const EMPTY_FORM: FormState = {
  warehouse_id: '',
  date: new Date().toISOString().split('T')[0],
};

const emptyLine = (): AuditLine => ({ product_id: '', description: '', warehouse_id: '', quantity: 0 });

const PAGE_SIZES = [10, 25, 50, 100];

const SortIcon = () => (
  <svg className="inline-block ml-1 w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
  </svg>
);

export default function StockAuditPage() {
  const [audits,     setAudits]     = useState<StockAudit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState<'list' | 'form'>('list');
  const [editing,    setEditing]    = useState<StockAudit | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM);
  const [lines,      setLines]      = useState<AuditLine[]>([emptyLine()]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch('/api/stock-audits');
      const d = await r.json();
      setAudits(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    apiFetch('/api/warehouses').then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d =>
      setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setLines([emptyLine()]);
    setError('');
    setView('form');
  }

  async function openEdit(a: StockAudit) {
    setEditing(a); setError('');
    try {
      const r = await apiFetch(`/api/stock-audits/${a.id}`);
      const full: StockAudit = await r.json();
      setForm({ warehouse_id: full.warehouse_id || '', date: full.date?.slice(0, 10) || '' });
      setLines(full.lines?.length ? full.lines.map(l => ({
        id: l.id, product_id: l.product_id || '', product_name: l.product_name,
        description: l.description || '', warehouse_id: l.warehouse_id || '', quantity: l.quantity,
      })) : [emptyLine()]);
    } catch {
      setForm({ warehouse_id: a.warehouse_id || '', date: a.date?.slice(0, 10) || '' });
      setLines([emptyLine()]);
    }
    setView('form');
  }

  function closeForm() { setView('list'); setEditing(null); setError(''); load(); }

  function updLine(i: number, patch: Partial<AuditLine>) {
    setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  }
  function confirmLine(i: number) {
    setLines(ls => {
      if (i === ls.length - 1) return [...ls, emptyLine()];
      return ls;
    });
  }
  function removeLine(i: number) {
    setLines(prev => { const n = prev.filter((_, j) => j !== i); return n.length ? n : [emptyLine()]; });
  }

  async function handleSave() {
    if (!form.warehouse_id) { setError('Warehouse is required'); return; }
    setError(''); setSaving(true);
    try {
      const payload = {
        warehouse_id: Number(form.warehouse_id),
        date: form.date,
        lines: lines.filter(l => l.product_id !== '').map(l => ({
          product_id: Number(l.product_id),
          description: l.description || null,
          warehouse_id: l.warehouse_id !== '' ? Number(l.warehouse_id) : null,
          quantity: l.quantity,
        })),
      };
      if (editing) {
        await apiFetch(`/api/stock-audits/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/stock-audits', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      }
      await load(); closeForm();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleComplete(id: number) {
    try { await apiFetch(`/api/stock-audits/${id}/complete`, { method: 'POST' }); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this stock audit?')) return;
    try { await apiFetch(`/api/stock-audits/${id}`, { method: 'DELETE' }); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  function printAudits(rows: StockAudit[]) {
    const win = window.open('', '_blank', 'width=900,height=650');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Stock Audits</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:40px;}
.hdr{display:flex;justify-content:space-between;margin-bottom:10px;}.co{font-size:22px;font-weight:bold;}.ti{font-size:22px;font-weight:bold;}
hr{border:none;border-top:1.5px solid #000;margin-bottom:18px;}table{width:100%;border-collapse:collapse;}
thead th{text-align:left;font-weight:bold;padding:6px 8px;border-bottom:1.5px solid #000;}
tbody td{padding:6px 8px;border-bottom:1px solid #ddd;}</style></head><body>
<div class="hdr"><span class="co">Evotrade</span><span class="ti">Stock Audits</span></div><hr/>
<table><thead><tr><th>Number</th><th>Date</th><th>Warehouse</th><th>No. of Products</th><th>Status</th></tr></thead>
<tbody>${rows.map(r => `<tr><td>${r.number}</td><td>${r.date?.slice(0,10)??''}</td><td>${r.warehouse_name??''}</td><td>${r.no_of_products??0}</td><td>${r.status}</td></tr>`).join('')}</tbody>
</table></body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
  }

  function exportAudits(rows: StockAudit[]) {
    const esc = (v: string | number | null | undefined) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv = [['Number','Date','Warehouse','No. of Products','Status'].join(','),
      ...rows.map(r => [esc(r.number),esc(r.date?.slice(0,10)),esc(r.warehouse_name),esc(r.no_of_products),esc(r.status)].join(','))
    ].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'StockAudits.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(audits.length / pageSize));
  const paginated  = audits.slice((page - 1) * pageSize, page * pageSize);

  /* ── FORM VIEW ── */
  if (view === 'form') {
    const displayNumber = editing?.number || 'SAU-NEW';
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">

          {/* Header */}
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Stock Audit</h2>

          {error && <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Fields row: Warehouse | Number | Date */}
          <div className="flex items-end gap-4 mb-6">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                value={form.warehouse_id}
                onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value ? Number(e.target.value) : '' }))}>
                <option value="">-Choose-</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number <span className="text-red-500">*</span></label>
              <div className="flex">
                <button type="button" className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-l text-xs border-r border-green-700">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 8L10 13l4.5-5H5.5z"/></svg>
                </button>
                <input readOnly className="w-32 border-t border-b border-gray-300 px-2 py-2 text-sm bg-gray-50 text-gray-600 text-center" value={displayNumber} />
                <button type="button" className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-r text-xs border-l border-green-700">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input type="date" className="px-2 py-2 text-sm focus:outline-none" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                <button type="button" onClick={() => setForm(f => ({ ...f, date: '' }))} className="px-2 text-gray-400 hover:text-gray-700">✕</button>
                <span className="px-2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {/* QUICK ADD / SCAN + IMPORT + EXPORT */}
          <div className="flex items-center justify-between mb-4">
            <button type="button"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-semibold rounded border border-gray-200 cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              QUICK ADD / SCAN
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                IMPORT
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" />
              <button type="button"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                EXPORT
              </button>
            </div>
          </div>

          {/* Lines table */}
          <div className="border border-gray-200 rounded mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 w-48">Warehouse</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700 w-28">Quantity</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-2">
                      <select
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white mb-1"
                        value={line.product_id}
                        onChange={e => updLine(i, { product_id: e.target.value === '' ? '' : Number(e.target.value) })}>
                        <option value="">Type to search product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="text" placeholder="Description"
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                        value={line.description}
                        onChange={e => updLine(i, { description: e.target.value })} />
                    </td>
                    <td className="px-4 py-2 w-48 align-top">
                      <select
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                        value={line.warehouse_id}
                        onChange={e => updLine(i, { warehouse_id: e.target.value === '' ? '' : Number(e.target.value) })}>
                        <option value="">-Choose-</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 w-28 align-top">
                      <input type="number" min={0} step="any"
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={line.quantity}
                        onChange={e => updLine(i, { quantity: Number(e.target.value) })} />
                    </td>
                    <td className="px-4 py-2 text-center w-20 align-top">
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button type="button" onClick={() => confirmLine(i)} className="text-green-600 hover:text-green-800">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                          </svg>
                        </button>
                        <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CONSOLIDATE & COMPARE */}
          <div className="flex justify-end mb-6">
            <button type="button" disabled
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-semibold rounded border border-gray-200 cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              CONSOLIDATE &amp; COMPARE
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-200">
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
              </svg>
              {saving ? 'Saving…' : 'SAVE'}
            </button>
            <button type="button" onClick={closeForm}
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
          <h1 className="text-lg font-bold text-gray-900">Stock Audits</h1>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            START AUDIT
          </button>
        </div>

        {/* Toolbar: PRINT + EXPORT (gray outlined, right-aligned) */}
        <div className="flex items-center justify-end gap-2 mb-5">
          <button onClick={() => printAudits(audits)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            PRINT
          </button>
          <button onClick={() => exportAudits(audits)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 text-sm font-semibold rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            EXPORT TO EXCEL
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
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Number <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Date <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Warehouse <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">No. of Products <SortIcon /></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Status <SortIcon /></th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-orange-500 text-sm">No record found</td></tr>
                ) : paginated.map(a => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <button onClick={() => openEdit(a)} className="text-green-600 hover:underline text-sm font-medium">{a.number}</button>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{a.date?.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{a.warehouse_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{a.no_of_products ?? 0}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold uppercase ${a.status === 'completed' ? 'text-green-600' : 'text-gray-500'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {a.status === 'draft' && (
                          <>
                            <button onClick={() => handleComplete(a.id)} className="text-xs text-green-600 hover:underline">Complete</button>
                            <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-600 inline-flex">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
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
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${p === page ? 'bg-green-600 text-white border border-green-600' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
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
    </div>
  );
}
