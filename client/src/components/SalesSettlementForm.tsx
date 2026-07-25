import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { SalesSettlement, SalesSettlementLine } from '../types/salesSettlement';
import { SS_STATUS_LABELS } from '../types/salesSettlement';
import {
  createSalesSettlement, updateSalesSettlement, getSalesSettlement,
  getOpenInvoices, getNextSettlementNumber, getReceivedPayments,
} from '../api/salesSettlements';

interface Customer { id: number; print_name: string; }
interface COA      { id: number; id2?: number; name: string; }

interface Props {
  settlement: SalesSettlement | null;
  onClose: () => void;
  onSaved: () => void;
}

interface OpenInvoice {
  id: number; number: string; date?: string; due_date: string | null;
  net_amount: number; paid_amount?: number; balance_amount: number; status: string;
}

interface ReceivedPayment {
  id: number; number: string; date: string;
  total_amount: number; adjusted_amount: number; balance_amount: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  approved:  'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function SalesSettlementForm({ settlement, onClose, onSaved }: Props) {
  const isEdit = settlement !== null;
  const [customers,        setCustomers]        = useState<Customer[]>([]);
  const [accounts,         setAccounts]         = useState<COA[]>([]);
  const [openInvoices,     setOpenInvoices]     = useState<OpenInvoice[]>([]);
  const [receivedPayments, setReceivedPayments] = useState<ReceivedPayment[]>([]);

  const [number,          setNumber]          = useState('');
  const [customerId,      setCustomerId]      = useState('');
  const [accountId,       setAccountId]       = useState('');
  const [date,            setDate]            = useState(new Date().toISOString().slice(0, 10));
  const [makeSettlements, setMakeSettlements] = useState(true);
  const [comments,        setComments]        = useState('');
  const [lines,           setLines]           = useState<SalesSettlementLine[]>([]);
  const [saving,          setSaving]          = useState(false);
  const [savingContinue,  setSavingContinue]  = useState(false);
  const [error,           setError]           = useState('');

  // Allocate amounts for receivables checkboxes
  const [receivableAllocs, setReceivableAllocs] = useState<Record<number, number>>({});
  // Allocate amounts for received payments checkboxes
  const [receivedAllocs,   setReceivedAllocs]   = useState<Record<number, number>>({});

  const status = (isEdit ? settlement!.status : 'draft') as string;

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d =>
      setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
    apiFetch('/api/chart-of-accounts').then(r => r.json()).then((data: COA[]) =>
      setAccounts(Array.isArray(data) ? data : [])
    );
    if (!isEdit) getNextSettlementNumber().then(d => setNumber(d.number)).catch(() => setNumber('CS-000001'));
  }, []);

  // Auto-select first account when accounts load
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(String(accounts[0].id));
  }, [accounts]);

  useEffect(() => {
    if (!customerId) {
      setOpenInvoices([]); setReceivedPayments([]);
      setReceivableAllocs({}); setReceivedAllocs({});
      return;
    }
    getOpenInvoices(Number(customerId)).then((data) => {
      const inv = data as unknown as OpenInvoice[];
      setOpenInvoices(inv);
      setReceivableAllocs({});
    });
    getReceivedPayments(Number(customerId)).then(data => {
      setReceivedPayments(data);
      setReceivedAllocs({});
    });
  }, [customerId]);

  useEffect(() => {
    if (!settlement) return;
    getSalesSettlement(settlement.id).then(full => {
      setNumber(full.number);
      setCustomerId(String(full.customer_id));
      setAccountId(String(full.account_id));
      setDate(full.date?.slice(0, 10) ?? '');
      setComments(full.notes ?? '');
      setMakeSettlements(full.auto_settle ?? true);
      setLines(full.lines ?? []);
      const allocs: Record<number, number> = {};
      (full.lines ?? []).forEach(l => { allocs[l.invoice_id] = l.amount; });
      setReceivableAllocs(allocs);
    });
  }, [settlement]);

  function toggleReceivable(inv: OpenInvoice) {
    setReceivableAllocs(prev => {
      const next = { ...prev };
      if (next[inv.id] !== undefined) delete next[inv.id];
      else next[inv.id] = Number(inv.balance_amount);
      return next;
    });
  }
  function toggleReceived(pmt: ReceivedPayment) {
    setReceivedAllocs(prev => {
      const next = { ...prev };
      if (next[pmt.id] !== undefined) delete next[pmt.id];
      else next[pmt.id] = Number(pmt.balance_amount);
      return next;
    });
  }

  const totalReceivable = Object.values(receivableAllocs).reduce((s, v) => s + Number(v), 0);
  const totalReceived   = Object.values(receivedAllocs).reduce((s, v) => s + Number(v), 0);

  function buildPayload() {
    const activeLines: SalesSettlementLine[] = Object.entries(receivableAllocs)
      .filter(([, amt]) => Number(amt) > 0)
      .map(([invId, amt]) => {
        const inv = openInvoices.find(i => i.id === Number(invId));
        return {
          invoice_id: Number(invId),
          invoice_number: inv?.number,
          invoice_net: inv?.net_amount,
          invoice_balance: inv?.balance_amount,
          amount: Number(amt),
          write_off: false,
        };
      });
    return {
      customer_id: Number(customerId),
      account_id:  Number(accountId) || 1,
      date, reference: null,
      notes: comments || null,
      auto_settle: makeSettlements,
      lines: activeLines,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!customerId) { setError('Customer is required'); return; }
    if (Object.keys(receivableAllocs).length === 0) { setError('Select at least one receivable to settle'); return; }
    setSaving(true);
    try {
      if (isEdit) await updateSalesSettlement(settlement!.id, buildPayload());
      else        await createSalesSettlement(buildPayload());
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  async function handleSaveAndContinue() {
    setError('');
    if (!customerId) { setError('Customer is required'); return; }
    setSavingContinue(true);
    try {
      if (isEdit) await updateSalesSettlement(settlement!.id, buildPayload());
      else {
        const created = await createSalesSettlement(buildPayload());
        setNumber(created.number);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSavingContinue(false); }
  }

  const fmt = (n: number | string) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Customer Settlements {number ? `- [${number}]` : ''}
          </h2>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
              {SS_STATUS_LABELS[status as keyof typeof SS_STATUS_LABELS] || 'DRAFT'}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            {/* Row 1: Customer | Number | Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer <span className="text-red-500">*</span></label>
                <select
                  className="w-full border border-red-400 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={customerId} onChange={e => setCustomerId(e.target.value)} required
                >
                  <option value="">Type to search customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-1">
                  <button type="button"
                    className="bg-green-500 hover:bg-green-600 text-white rounded px-2 py-2"
                    title="Previous number"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <input
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-center font-mono"
                    value={number} readOnly
                  />
                  <button type="button"
                    className="bg-green-500 hover:bg-green-600 text-white rounded px-2 py-2"
                    onClick={() => getNextSettlementNumber().then(d => setNumber(d.number))}
                    title="Refresh number"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  value={date} onChange={e => setDate(e.target.value)} required
                />
              </div>
            </div>

            {/* Make auto settlements checkbox */}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={makeSettlements}
                onChange={e => setMakeSettlements(e.target.checked)}
                className="h-4 w-4 rounded border-green-500 text-green-600 accent-green-500"
              />
              <span className="font-medium">Make auto settlements</span>
            </label>

            {/* Receivables table */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Receivables</p>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <input type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={openInvoices.length > 0 && openInvoices.every(i => receivableAllocs[i.id] !== undefined)}
                          onChange={e => {
                            if (e.target.checked) {
                              const all: Record<number, number> = {};
                              openInvoices.forEach(i => { all[i.id] = Number(i.balance_amount); });
                              setReceivableAllocs(all);
                            } else setReceivableAllocs({});
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Due Date</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Amount</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Adjusted Amount</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Balance Amount</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28">Allocate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {openInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 text-amber-500 text-sm">No record found</td>
                      </tr>
                    ) : openInvoices.map(inv => {
                      const checked = receivableAllocs[inv.id] !== undefined;
                      return (
                        <tr key={inv.id} className={checked ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={checked} onChange={() => toggleReceivable(inv)} className="h-4 w-4 rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-blue-600 font-mono text-xs">{inv.number}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{inv.date ? String(inv.date).slice(0, 10) : '—'}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{inv.due_date ? String(inv.due_date).slice(0, 10) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmt(inv.net_amount)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmt(inv.paid_amount ?? 0)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmt(inv.balance_amount)}</td>
                          <td className="px-3 py-2">
                            {checked ? (
                              <input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-right text-xs" value={receivableAllocs[inv.id]} min="0.01" step="0.01" max={inv.balance_amount}
                                onChange={e => setReceivableAllocs(prev => ({ ...prev, [inv.id]: parseFloat(e.target.value) || 0 }))} />
                            ) : <span className="block text-right text-gray-400 text-xs pr-2">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Received payments table */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Received</p>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <input type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={receivedPayments.length > 0 && receivedPayments.every(p => receivedAllocs[p.id] !== undefined)}
                          onChange={e => {
                            if (e.target.checked) {
                              const all: Record<number, number> = {};
                              receivedPayments.forEach(p => { all[p.id] = Number(p.balance_amount); });
                              setReceivedAllocs(all);
                            } else setReceivedAllocs({});
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Due Date</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Amount</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Adjusted Amount</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Balance Amount</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28">Allocate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receivedPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 text-amber-500 text-sm">No record found</td>
                      </tr>
                    ) : receivedPayments.map(pmt => {
                      const checked = receivedAllocs[pmt.id] !== undefined;
                      return (
                        <tr key={pmt.id} className={checked ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={checked} onChange={() => toggleReceived(pmt)} className="h-4 w-4 rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2 text-blue-600 font-mono text-xs">{pmt.number}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{pmt.date ? String(pmt.date).slice(0, 10) : '—'}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">—</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmt(pmt.total_amount)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmt(pmt.adjusted_amount)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmt(pmt.balance_amount)}</td>
                          <td className="px-3 py-2">
                            {checked ? (
                              <input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-right text-xs" value={receivedAllocs[pmt.id]} min="0.01" step="0.01" max={pmt.balance_amount}
                                onChange={e => setReceivedAllocs(prev => ({ ...prev, [pmt.id]: parseFloat(e.target.value) || 0 }))} />
                            ) : <span className="block text-right text-gray-400 text-xs pr-2">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comments */}
            <div>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                rows={3} placeholder="Comments"
                value={comments} onChange={e => setComments(e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500 space-x-4">
              <span>Receivables: <span className="font-semibold font-mono text-gray-800">{fmt(totalReceivable)}</span></span>
              <span>Received: <span className="font-semibold font-mono text-gray-800">{fmt(totalReceived)}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleSaveAndContinue} disabled={savingContinue}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {savingContinue ? 'SAVING…' : 'SAVE AND CONTINUE EDIT'}
              </button>
              <button type="button" onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 text-white rounded font-medium"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                CLOSE
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
    </div>
  );
}

