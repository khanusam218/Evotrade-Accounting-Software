import { useEffect, useState } from 'react';
import { getTransactions } from '../api/pos';
import type { POSTransaction } from '../types/pos';

const fmt = (n: number | string) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDateTime(s: string) {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ` +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  voided:    'bg-red-100 text-red-800',
  return:    'bg-amber-100 text-amber-800',
};

type SortKey = 'date' | 'number' | 'customer_name' | 'subtotal' | 'tax_total' | 'discount' | 'total' | 'payment_mode' | 'status';

function SortTh({ col, label, sort, dir, onSort, right }: {
  col: SortKey; label: string; sort: SortKey; dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void; right?: boolean;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-3 text-xs font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 ${right ? 'text-right' : 'text-left'}`}>
      {label} <span className="text-gray-400 font-normal">{sort === col ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

export default function POSTransactionsPage() {
  const [rows,    setRows]    = useState<POSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,   setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [sort, setSort] = useState<SortKey>('date');
  const [dir,  setDir]  = useState<'asc' | 'desc'>('desc');
  const [page,    setPage]    = useState(1);
  const [perPage, setPerPage] = useState(50);

  function load() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    getTransactions(params)
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(k: SortKey) {
    if (sort === k) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(k); setDir('asc'); }
    setPage(1);
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort] ?? '';
    const bv = b[sort] ?? '';
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * (dir === 'asc' ? 1 : -1);
    }
    return (Number(av) - Number(bv)) * (dir === 'asc' ? 1 : -1);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const pageRows   = sorted.slice((page - 1) * perPage, page * perPage);

  function paginationItems() {
    const all  = Array.from({ length: totalPages }, (_, i) => i + 1);
    const show = all.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2);
    const items: Array<{ type: 'page'; p: number } | { type: 'ellipsis'; key: string }> = [];
    show.forEach((p, i) => {
      if (i > 0 && show[i - 1] !== p - 1) items.push({ type: 'ellipsis', key: `e${p}` });
      items.push({ type: 'page', p });
    });
    return items;
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">POS Transactions</h1>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Search (number / customer)</label>
          <input
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-green-500"
            placeholder="e.g. POS-000003"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (setPage(1), load())}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button onClick={() => { setPage(1); load(); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-semibold">
          Search
        </button>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); load(); }}
            className="border border-gray-300 hover:bg-gray-50 text-gray-600 px-4 py-1.5 rounded text-sm font-medium">
            Clear
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <SortTh col="number"        label="Number"        sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="date"          label="Date"          sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="customer_name" label="Customer"      sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="subtotal"      label="Subtotal"      sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="tax_total"     label="Tax"           sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="discount"      label="Discount"      sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="total"         label="Total"         sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="payment_mode"  label="Payment Mode"  sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="status"        label="Status"        sort={sort} dir={dir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-6 text-sm text-amber-500 font-medium">No record found</td></tr>
            ) : pageRows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-800 whitespace-nowrap">{r.number}</td>
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{fmtDateTime(r.date)}</td>
                <td className="px-3 py-2 text-gray-800">{r.customer_name || '—'}</td>
                <td className="px-3 py-2 text-right text-gray-800">{fmt(r.subtotal)}</td>
                <td className="px-3 py-2 text-right text-gray-800">{fmt(r.tax_total)}</td>
                <td className="px-3 py-2 text-right text-gray-800">{fmt(r.discount)}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(r.total)}</td>
                <td className="px-3 py-2 text-gray-800 capitalize">{r.payment_mode}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-sm">
              ←
            </button>
            {paginationItems().map(item =>
              item.type === 'ellipsis' ? (
                <span key={item.key} className="px-1 text-gray-400 text-sm">…</span>
              ) : (
                <button key={item.p}
                  onClick={() => setPage(item.p)}
                  className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium
                    ${page === item.p
                      ? 'bg-green-500 text-white'
                      : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                  {item.p}
                </button>
              )
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-sm">
              →
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Per page:</span>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
