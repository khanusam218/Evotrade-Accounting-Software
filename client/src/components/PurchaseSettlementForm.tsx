import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import type { PurchaseSettlement, PurchaseSettlementLine } from '../types/purchaseSettlement';
import { PS_STATUS_LABELS } from '../types/purchaseSettlement';
import { createPurchaseSettlement, updatePurchaseSettlement, getPurchaseSettlement, getOpenPurchaseInvoices, getOpenPurchaseCredits, getNextPurchaseSettlementNumber } from '../api/purchaseSettlements';

interface Vendor     { id: number; print_name: string; }
interface COA        { id: number; name: string; }
interface OpenInv    { id: number; number: string; date: string; due_date: string | null; net_amount: number; paid_amount: number; balance_amount: number; }
interface OpenCredit { type: string; id: number; number: string; date: string; due_date: string | null; total_amount: number; adjusted_amount: number; balance_amount: number; }
interface Props      { settlement: PurchaseSettlement | null; onClose: () => void; onSaved: () => void; }

export default function PurchaseSettlementForm({ settlement, onClose, onSaved }: Props) {
  const [vendors,      setVendors]      = useState<Vendor[]>([]);
  const [accounts,     setAccounts]     = useState<COA[]>([]);
  const [openInvs,     setOpenInvs]     = useState<OpenInv[]>([]);
  const [openCredits,  setOpenCredits]  = useState<OpenCredit[]>([]);
  const [nextNum,      setNextNum]      = useState('VS-000001');
  const [vendorId,     setVendorId]     = useState('');
  const [accountId,    setAccountId]    = useState('');
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [reference,    setReference]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [autoSettle,   setAutoSettle]   = useState(true);
  const [lines,        setLines]        = useState<PurchaseSettlementLine[]>([]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch('/api/vendors?limit=500').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])));
    apiFetch('/api/chart-of-accounts').then(r => r.json()).then((d: COA[]) => setAccounts(Array.isArray(d) ? d : []));
    if (!settlement) getNextPurchaseSettlementNumber().then(r => setNextNum(r.number)).catch(() => {});
  }, [settlement]);

  useEffect(() => {
    if (!vendorId) { setOpenInvs([]); setOpenCredits([]); setLines([]); return; }
    getOpenPurchaseInvoices(Number(vendorId)).then(d => {
      const invs = d as OpenInv[];
      setOpenInvs(invs);
      setLines(prev => {
        const existing = new Set(prev.map(l => l.invoice_id));
        const newLines = invs.filter(inv => !existing.has(inv.id)).map(inv => ({
          invoice_id: inv.id, invoice_number: inv.number,
          invoice_net: inv.net_amount, invoice_balance: inv.balance_amount,
          amount: 0, write_off: false,
        }));
        const kept = prev.filter(l => invs.some(inv => inv.id === l.invoice_id));
        return [...kept, ...newLines];
      });
    });
    getOpenPurchaseCredits(Number(vendorId)).then(d => setOpenCredits(d as OpenCredit[]));
  }, [vendorId]);

  useEffect(() => {
    if (!settlement) return;
    getPurchaseSettlement(settlement.id).then(full => {
      setVendorId(String(full.vendor_id));
      setAccountId(String(full.account_id));
      setDate(full.date?.slice(0, 10) ?? '');
      setReference(full.reference ?? '');
      setNotes(full.notes ?? '');
      setAutoSettle(full.auto_settle ?? true);
      if (full.lines?.length) setLines(full.lines);
      setNextNum(full.number);
    });
  }, [settlement]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function updateInvoiceAmount(invoiceId: number, amount: number) {
    setLines(prev => prev.map(l => l.invoice_id === invoiceId ? { ...l, amount: isNaN(amount) ? 0 : amount } : l));
  }

  function toggleInvoice(invoiceId: number, checked: boolean, balance: number) {
    setLines(prev => prev.map(l => l.invoice_id === invoiceId ? { ...l, amount: checked ? balance : 0 } : l));
  }

  function toggleAllInvoices(checked: boolean) {
    setLines(prev => prev.map(l => ({ ...l, amount: checked ? Number(l.invoice_balance || 0) : 0 })));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!vendorId) e.vendor = 'Vendor is required.';
    if (!accountId) e.account = 'Settlement account is required.';
    if (!date) e.date = 'Date is required.';
    const activeLines = lines.filter(l => Number(l.amount) > 0 || l.write_off);
    if (!activeLines.length) e.lines = 'At least one invoice must have an amount.';
    else if (activeLines.some(l => Number(l.amount) > Number(l.invoice_balance || 0))) {
      e.lines = 'Allocated amount cannot exceed an invoice\'s balance.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(e: React.FormEvent, continueEdit = false) {
    e.preventDefault(); setError('');
    if (!validate()) return;
    const activeLines = lines.filter(l => Number(l.amount) > 0 || l.write_off);
    setSaving(true);
    try {
      const payload = {
        vendor_id: Number(vendorId), account_id: Number(accountId),
        date, reference: reference || null, notes: notes || null,
        auto_settle: autoSettle,
        lines: activeLines.map(l => ({ invoice_id: l.invoice_id, amount: Number(l.amount || 0), write_off: l.write_off })),
      };
      if (settlement) await updatePurchaseSettlement(settlement.id, payload);
      else await createPurchaseSettlement(payload);
      if (!continueEdit) onSaved();
      else getNextPurchaseSettlementNumber().then(r => setNextNum(r.number)).catch(() => {});
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  type SettlementRow = { key: string; invoiceId?: number; number: string; date: string; due_date: string | null; total: number; adjusted: number; balance: number; allocateKey: string };

  const settlementTable = (rows: SettlementRow[], editable = false) => (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 w-10">
              <input type="checkbox" disabled={!editable}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-40"
                checked={editable && rows.length > 0 && rows.every(r => Number(lines.find(l => l.invoice_id === r.invoiceId)?.amount || 0) > 0)}
                onChange={e => editable && toggleAllInvoices(e.target.checked)} />
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Description</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Date</th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Due Date</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Total Amount</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Adjusted Amount</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Balance Amount</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Allocate</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-6 text-sm text-amber-500 font-medium">No record found</td></tr>
          ) : rows.map(row => {
            const lineAmount = editable ? Number(lines.find(l => l.invoice_id === row.invoiceId)?.amount || 0) : 0;
            return (
            <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2">
                <input type="checkbox" disabled={!editable}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-40"
                  checked={editable && lineAmount > 0}
                  onChange={e => editable && row.invoiceId !== undefined && toggleInvoice(row.invoiceId, e.target.checked, row.balance)} />
              </td>
              <td className="px-3 py-2 text-gray-800 font-medium">{row.number}</td>
              <td className="px-3 py-2 text-center text-gray-600">{row.date?.slice(0, 10) ?? '-'}</td>
              <td className="px-3 py-2 text-center text-gray-500">{row.due_date?.slice(0, 10) ?? '–'}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(row.total)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(row.adjusted)}</td>
              <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(row.balance)}</td>
              <td className="px-3 py-2 text-right">
                <input type="number" min="0" step="any" disabled={!editable}
                  className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
                  value={editable ? (lineAmount || '') : ''}
                  onChange={e => row.invoiceId !== undefined && updateInvoiceAmount(row.invoiceId, e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0.00" />
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );

  const payableRows = openInvs.map(inv => ({
    key: `inv-${inv.id}`, invoiceId: inv.id, number: inv.number, date: inv.date, due_date: inv.due_date,
    total: Number(inv.net_amount || 0), adjusted: Number(inv.paid_amount || 0),
    balance: Number(inv.balance_amount || 0), allocateKey: `inv-${inv.id}`,
  }));

  const paidRows = openCredits.map(cr => ({
    key: `${cr.type}-${cr.id}`, number: cr.number, date: cr.date, due_date: cr.due_date,
    total: Number(cr.total_amount || 0), adjusted: Number(cr.adjusted_amount || 0),
    balance: Number(cr.balance_amount || 0), allocateKey: `${cr.type}-${cr.id}`,
  }));

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Vendor Settlements - [{nextNum}]</h2>
          <span className="text-sm font-bold text-gray-500 tracking-widest">
            {settlement ? PS_STATUS_LABELS[settlement.status].toUpperCase() : 'DRAFT'}
          </span>
        </div>

        <form onSubmit={e => handleSave(e)}>
          <div className="px-6 py-4 space-y-4">
            {error && <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

            {/* Row 1: Vendor | Number | Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor <span className="text-red-500">*</span></label>
                <select className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.vendor ? 'border-red-500' : 'border-gray-300'}`}
                  value={vendorId} onChange={e => setVendorId(e.target.value)} required>
                  <option value="">Type to search vendor</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.print_name}</option>)}
                </select>
                {errors.vendor && <p className="text-xs text-red-500 mt-1">{errors.vendor}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-1">
                  <button type="button" className="h-9 w-9 flex-shrink-0 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 font-mono" value={nextNum} readOnly />
                  <button type="button" onClick={() => getNextPurchaseSettlementNumber().then(r => setNextNum(r.number)).catch(() => {})}
                    className="h-9 w-9 flex-shrink-0 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
                  value={date} onChange={e => setDate(e.target.value)} required />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>
            </div>

            {/* Row 2: Settlement Account | Reference */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Account <span className="text-red-500">*</span></label>
                <select className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.account ? 'border-red-500' : 'border-gray-300'}`}
                  value={accountId} onChange={e => setAccountId(e.target.value)} required>
                  <option value="">Select account…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {errors.account && <p className="text-xs text-red-500 mt-1">{errors.account}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
            </div>

            {/* Make auto settlements checkbox */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoSettle} onChange={e => setAutoSettle(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="text-sm font-semibold text-gray-700">Make auto settlements</span>
              </label>
            </div>

            {/* Payables Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Payables</h3>
              {settlementTable(payableRows, true)}
              {errors.lines && <p className="text-xs text-red-500 mt-1">{errors.lines}</p>}
            </div>

            {/* Paid Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Paid</h3>
              {settlementTable(paidRows)}
            </div>

            {/* Comments */}
            <div>
              <textarea rows={4}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                placeholder="Comments" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              {saving ? 'Saving…' : 'SAVE AND CONTINUE EDIT'}
            </button>
            <button type="button" onClick={onClose}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
              <span className="text-base leading-none">×</span>
              CLOSE
            </button>
          </div>
        </form>
    </div>
  );
}

