import { apiFetch } from '../api/apiFetch';
import { useEffect, useState } from 'react';
import { createBulkReceivePayments } from '../api/receivePayments';
import { validatePositive } from '../utils/validators';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface Customer { id: number; print_name: string; }
interface COA      { id: number; code: string; name: string; }

interface BulkRow {
  customer_id: string;
  account_id: string;
  reference: string;
  amount: string;
  bank_name: string;
  instrument_no: string;
  instrument_date: string;
}

const emptyRow = (): BulkRow => ({
  customer_id: '', account_id: '', reference: '', amount: '',
  bank_name: '', instrument_no: '', instrument_date: '',
});

export default function BulkReceivePaymentForm({ onClose, onSaved }: Props) {
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [rowErrors,       setRowErrors]       = useState<Record<number, string>>({});
  const [customers,       setCustomers]       = useState<Customer[]>([]);
  const [coaList,         setCoaList]         = useState<COA[]>([]);
  const [date,            setDate]            = useState(new Date().toISOString().slice(0, 10));
  const [makeSettlements, setMakeSettlements] = useState(true);
  const [comments,        setComments]        = useState('');
  const [rows,            setRows]            = useState<BulkRow[]>([emptyRow()]);

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d =>
      setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
    apiFetch('/api/chart-of-accounts?leaf=true').then(r => r.json()).then(setCoaList);
  }, []);

  function updateRow(i: number, field: keyof BulkRow, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function addRow() { setRows(prev => [...prev, emptyRow()]); }
  function removeRow(i: number) { setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev); }

  const totalAmount = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });

  function validate() {
    const e: Record<string, string> = {};
    if (!date) e.date = 'Date is required.';

    const re: Record<number, string> = {};
    let anyValid = false;
    rows.forEach((r, i) => {
      const hasCustomer = !!r.customer_id;
      const amt = parseFloat(r.amount);
      const hasAmount = r.amount !== '' && !isNaN(amt);
      if (hasCustomer && !hasAmount) {
        re[i] = 'Enter an amount for this row.';
      } else if (hasCustomer && hasAmount) {
        const amtErr = validatePositive(amt, 'Amount');
        if (amtErr) re[i] = amtErr;
        else if (amt === 0) re[i] = 'Amount must be greater than zero.';
        else anyValid = true;
      } else if (!hasCustomer && hasAmount && amt !== 0) {
        re[i] = 'Select a customer for this row.';
      }
    });
    if (!anyValid) e.rows = 'At least one row with a customer and amount is required.';
    setRowErrors(re);
    setErrors(e);
    return Object.keys(e).length === 0 && Object.keys(re).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    const validRows = rows.filter(r => r.customer_id && parseFloat(r.amount) > 0);
    if (!validRows.length) { setError('At least one row with a customer and amount is required'); return; }
    setSaving(true);
    try {
      await createBulkReceivePayments({
        date, comments: comments || null, make_settlements: makeSettlements,
        rows: validRows.map(r => ({
          customer_id: Number(r.customer_id),
          account_id:  r.account_id ? Number(r.account_id) : null,
          reference:   r.reference || null,
          amount:      parseFloat(r.amount),
          bank_name:   r.bank_name || null,
          instrument_no:   r.instrument_no || null,
          instrument_date: r.instrument_date || null,
        })),
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="w-full bg-white flex flex-col">

        {/* Title */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Bulk Receive Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            {/* Date */}
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            {/* Make auto settlements */}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={makeSettlements}
                onChange={e => setMakeSettlements(e.target.checked)}
                className="h-4 w-4 rounded border-green-500 text-green-600 accent-green-500"
              />
              <span className="font-medium">Make auto settlements</span>
            </label>

            {/* Bulk rows table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-44">Customer</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-36">Account</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Reference</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700 w-28">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Bank Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Instrument No.</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-36">Instrument Date</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-2 py-1">
                        <select
                          className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${rowErrors[i] ? 'border-red-500' : 'border-green-400'}`}
                          value={row.customer_id}
                          onChange={e => updateRow(i, 'customer_id', e.target.value)}
                        >
                          <option value="">Type to search customer</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.print_name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          value={row.account_id}
                          onChange={e => updateRow(i, 'account_id', e.target.value)}
                        >
                          <option value="">Cash In Hand</option>
                          {coaList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          placeholder="Reference"
                          value={row.reference}
                          onChange={e => updateRow(i, 'reference', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className={`w-full border rounded px-2 py-1.5 text-sm text-right ${rowErrors[i] ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder="0"
                          min="0" step="0.01"
                          value={row.amount}
                          onChange={e => updateRow(i, 'amount', e.target.value)}
                        />
                        {rowErrors[i] && <p className="text-xs text-red-500 mt-0.5 whitespace-nowrap">{rowErrors[i]}</p>}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-gray-50 placeholder-gray-400"
                          placeholder="Bank Name"
                          value={row.bank_name}
                          onChange={e => updateRow(i, 'bank_name', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-gray-50 placeholder-gray-400"
                          placeholder="Instrument No."
                          value={row.instrument_no}
                          onChange={e => updateRow(i, 'instrument_no', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          value={row.instrument_date}
                          onChange={e => updateRow(i, 'instrument_date', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Add new row"
                            className="text-green-500 hover:text-green-700"
                            onClick={addRow}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Remove row"
                            className="text-red-400 hover:text-red-600"
                            onClick={() => removeRow(i)}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {errors.rows && <p className="text-xs text-red-500 mt-1">{errors.rows}</p>}
            </div>

            {/* Comments + Total Amount */}
            <div className="grid grid-cols-2 gap-6 items-start">
              <div>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                  rows={4}
                  placeholder="Comments"
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-4 pt-2">
                <span className="text-sm font-semibold text-gray-700">Total Amount (PKR)</span>
                <input
                  readOnly
                  className="w-36 border border-gray-300 rounded px-3 py-2 text-sm text-right bg-gray-50 font-mono font-semibold"
                  value={fmt(totalAmount)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 text-white rounded font-medium"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              CLOSE
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create All'}
            </button>
          </div>
        </form>
    </div>
  );
}

