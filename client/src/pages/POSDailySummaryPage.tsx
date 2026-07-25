import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';

const j = (r: Response) => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(new Error(e.error)));

const fmt = (n: number | string) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(s: string) {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtDateTime(s: string) {
  const d = new Date(s);
  return `${fmtDate(s)} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

interface SessionRow {
  id: number;
  date: string;
  counter_name: string;
  start_time: string;
  end_time: string | null;
  opening_cash: number;
  cash_in: number;
  sales: number;
  cash: number;
  card: number;
  bank_transfer: number;
  credit: number;
  adjusted_cn_sr: number;
  refunds: number;
  returns: number;
  cash_out: number;
  cash_short_or_excess: number;
  closing: number;
}

type SortKey =
  | 'date' | 'counter_name' | 'start_time' | 'end_time'
  | 'opening_cash' | 'cash_in' | 'sales' | 'cash' | 'card' | 'bank_transfer' | 'credit'
  | 'adjusted_cn_sr' | 'refunds' | 'returns' | 'cash_out' | 'cash_short_or_excess' | 'closing';

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

export default function POSDailySummaryPage() {
  const [rows,    setRows]    = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort,    setSort]    = useState<SortKey>('start_time');
  const [dir,     setDir]     = useState<'asc' | 'desc'>('desc');
  const [page,    setPage]    = useState(1);
  const [perPage, setPerPage] = useState(50);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/pos/sessions-summary').then(j)
      .then((data: SessionRow[]) => setRows(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
        <h1 className="text-xl font-bold text-gray-800">Daily Summary</h1>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <SortTh col="date"                 label="Date"                              sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="counter_name"         label="Counter"                           sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="start_time"           label="Start Time"                        sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="end_time"             label="End Time"                          sort={sort} dir={dir} onSort={handleSort} />
              <SortTh col="opening_cash"         label="Opening (Cash)"                    sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="cash_in"              label="Cash In"                           sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="sales"                label="Sales"                             sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="cash"                 label="Cash"                              sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="card"                 label="Card"                              sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="bank_transfer"        label="Bank Transfer"                     sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="credit"               label="Credit Sale"                       sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="adjusted_cn_sr"       label="Adjusted C.N / S.R"               sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="refunds"              label="Refunds"                           sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="returns"              label="Returns"                           sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="cash_out"             label="Cash Out"                          sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="cash_short_or_excess" label="Cash Short Or Excess"              sort={sort} dir={dir} onSort={handleSort} right />
              <SortTh col="closing"              label="Closing (Cash + Card Slips+ Bank Transfer)" sort={sort} dir={dir} onSort={handleSort} right />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={18} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={18} className="px-4 py-6 text-sm text-amber-500 font-medium">No record found</td></tr>
            ) : pageRows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-3 py-2 text-gray-800">{r.counter_name}</td>
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{fmtDateTime(r.start_time)}</td>
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{r.end_time ? fmtDateTime(r.end_time) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{fmt(r.opening_cash)}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.cash_in) ? fmt(r.cash_in) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.sales) ? fmt(r.sales) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.cash) ? fmt(r.cash) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.card) ? fmt(r.card) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.bank_transfer) ? fmt(r.bank_transfer) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.credit) ? fmt(r.credit) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.adjusted_cn_sr) ? fmt(r.adjusted_cn_sr) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.refunds) ? fmt(r.refunds) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.returns) ? fmt(r.returns) : ''}</td>
                <td className="px-3 py-2 text-right text-gray-800">{Number(r.cash_out) ? fmt(r.cash_out) : ''}</td>
                <td className={`px-3 py-2 text-right ${Number(r.cash_short_or_excess) < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {Number(r.cash_short_or_excess) !== 0 ? fmt(r.cash_short_or_excess) : ''}
                </td>
                <td className="px-3 py-2 text-right text-gray-800">{fmt(r.closing)}</td>
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

