import { useCallback, useEffect, useState } from 'react';
import { getInstruments } from '../api/instruments';
import type { PaymentInstrument } from '../types/otherTransaction';
import { INSTRUMENT_STATUS_COLORS, INSTRUMENT_STATUS_LABELS, PAYMENT_MODE_LABELS } from '../types/otherTransaction';

interface Filters {
  paymentMode: string;
  bankName: string;
  instrumentNo: string;
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
  status: string;
  showVoid: boolean;
}

function emptyFilters(): Filters {
  return {
    paymentMode: '', bankName: '', instrumentNo: '',
    dateFrom: '', dateTo: '', amountFrom: '', amountTo: '',
    status: '', showVoid: false,
  };
}

function SortIcon() {
  return (
    <svg className="inline-block ml-1 w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" />
    </svg>
  );
}

export default function InstrumentsPage() {
  const [allInstruments, setAllInstruments] = useState<PaymentInstrument[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const [showModal, setShowModal]           = useState(false);
  const [pending, setPending]               = useState<Filters>(emptyFilters());
  const [applied, setApplied]               = useState<Filters>(emptyFilters());

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getInstruments({
        payment_mode: applied.paymentMode || undefined,
        status:       applied.status      || undefined,
        date_from:    applied.dateFrom    || undefined,
        date_to:      applied.dateTo      || undefined,
      });
      setAllInstruments(data);
    } catch (err: unknown) {
      setError(`Failed to load instruments: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally { setLoading(false); }
  }, [applied]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const instruments = allInstruments.filter((inst) => {
    if (applied.bankName && !(inst.bank_name ?? '').toLowerCase().includes(applied.bankName.toLowerCase())) return false;
    if (applied.instrumentNo && !(inst.instrument_no ?? '').toLowerCase().includes(applied.instrumentNo.toLowerCase())) return false;
    if (applied.amountFrom && Number(inst.amount) < parseFloat(applied.amountFrom)) return false;
    if (applied.amountTo   && Number(inst.amount) > parseFloat(applied.amountTo))   return false;
    if (!applied.showVoid  && inst.status === 'void') return false;
    return true;
  });

  function handleApply() {
    setApplied({ ...pending });
    setShowModal(false);
  }

  function handleClear() {
    setPending(emptyFilters());
  }

  function handleSaveFilter() {
    setApplied({ ...pending });
    setShowModal(false);
  }

  function openModal() {
    setPending({ ...applied });
    setShowModal(true);
  }

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const hasActiveFilters = Object.entries(applied).some(([k, v]) =>
    k !== 'showVoid' ? Boolean(v) : v === true
  );

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Page header */}
      <div className="flex items-center bg-white border-b border-gray-200 px-6 py-3">
        <h1 className="text-lg font-bold text-gray-800">Instruments</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-white border-b border-gray-200 px-6 py-2">
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          FILTERS
          {hasActiveFilters && (
            <span className="bg-white text-blue-600 text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">!</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">
                    Payment Mode <SortIcon />
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">
                    Bank Name <SortIcon />
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">
                    Instrument No. <SortIcon />
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">
                    Instrument Date <SortIcon />
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">
                    Amount <SortIcon />
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap">
                    Status <SortIcon />
                  </th>
                </tr>
              </thead>
              <tbody>
                {instruments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-orange-500 font-medium">
                      No record found
                    </td>
                  </tr>
                ) : (
                  instruments.map((inst) => (
                    <tr key={inst.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800">
                        {inst.payment_mode ? PAYMENT_MODE_LABELS[inst.payment_mode] : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{inst.bank_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-800 font-mono">{inst.instrument_no || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {inst.instrument_date ? new Date(inst.instrument_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-800">
                        {fmt(Number(inst.amount))}
                      </td>
                      <td className="px-4 py-2.5">
                        {inst.status && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${INSTRUMENT_STATUS_COLORS[inst.status]}`}>
                            {INSTRUMENT_STATUS_LABELS[inst.status]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="relative bg-white border-2 border-green-400 rounded-lg shadow-xl w-full max-w-lg mx-4">

            {/* Red × close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm font-bold shadow"
            >
              ×
            </button>

            <div className="p-6 space-y-4">
              {/* Payment Mode */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-semibold text-gray-700 shrink-0">Payment Mode</label>
                <select
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pending.paymentMode}
                  onChange={(e) => setPending((p) => ({ ...p, paymentMode: e.target.value }))}
                >
                  <option value="">Select payment mode</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Bank Name */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-semibold text-gray-700 shrink-0">Bank Name</label>
                <input
                  type="text"
                  placeholder="Type to search bank name"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pending.bankName}
                  onChange={(e) => setPending((p) => ({ ...p, bankName: e.target.value }))}
                />
              </div>

              {/* Instrument No. */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-semibold text-gray-700 shrink-0">Instrument No.</label>
                <input
                  type="text"
                  placeholder="Type to search instrument no."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pending.instrumentNo}
                  onChange={(e) => setPending((p) => ({ ...p, instrumentNo: e.target.value }))}
                />
              </div>

              {/* Instrument Date From/To */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-semibold text-gray-700 shrink-0">Instrument Date</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input
                    type="date"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.dateFrom}
                    onChange={(e) => setPending((p) => ({ ...p, dateFrom: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">To:</span>
                  <input
                    type="date"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.dateTo}
                    onChange={(e) => setPending((p) => ({ ...p, dateTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Amount From/To */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-semibold text-gray-700 shrink-0">Amount</label>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm text-gray-500">From:</span>
                  <input
                    type="number"
                    placeholder="From"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.amountFrom}
                    onChange={(e) => setPending((p) => ({ ...p, amountFrom: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">To:</span>
                  <input
                    type="number"
                    placeholder="To"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pending.amountTo}
                    onChange={(e) => setPending((p) => ({ ...p, amountTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-36 text-sm font-semibold text-gray-700 shrink-0">Status</label>
                <select
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pending.status}
                  onChange={(e) => setPending((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="">Select status</option>
                  <option value="pending">Pending</option>
                  <option value="cleared">Cleared</option>
                  <option value="bounced">Bounced</option>
                  <option value="void">Void</option>
                </select>
              </div>

              {/* Show Void checkbox */}
              <div className="flex items-center gap-3 pl-40">
                <input
                  type="checkbox"
                  id="showVoid"
                  className="w-4 h-4 accent-blue-600"
                  checked={pending.showVoid}
                  onChange={(e) => setPending((p) => ({ ...p, showVoid: e.target.checked }))}
                />
                <label htmlFor="showVoid" className="text-sm font-medium text-gray-700">Show Void</label>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
              {/* SAVE FILTER */}
              <button
                onClick={handleSaveFilter}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                SAVE FILTER
              </button>

              {/* APPLY */}
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                APPLY
              </button>

              {/* CLEAR */}
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
