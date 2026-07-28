import { useEffect, useRef, useState } from 'react';
import {
  createOCSSettlement, getNextOCSNumber, getOCSSettlement, updateOCSSettlement,
} from '../api/ocsSettlements';
import type { OCSSettlement } from '../types/ocsSettlement';
import { validateName } from '../utils/validators';

interface ReceivableLine {
  description: string;
  lineDate: string;
  dueDate: string;
  totalAmount: string;
  adjustedAmount: string;
  allocate: string;
  checked: boolean;
}

interface ReceivedLine {
  description: string;
  lineDate: string;
  dueDate: string;
  totalAmount: string;
  adjustedAmount: string;
  allocate: string;
  checked: boolean;
}

interface Props {
  settlement: OCSSettlement | null;
  onClose: () => void;
  onSaved: (addNew?: boolean) => void;
}

function today() { return new Date().toISOString().slice(0, 10); }

function emptyReceivable(): ReceivableLine {
  return { description: '', lineDate: '', dueDate: '', totalAmount: '', adjustedAmount: '0', allocate: '', checked: false };
}
function emptyReceived(): ReceivedLine {
  return { description: '', lineDate: '', dueDate: '', totalAmount: '', adjustedAmount: '0', allocate: '', checked: false };
}

export default function OCSForm({ settlement, onClose, onSaved }: Props) {
  const isEdit = settlement !== null;
  const status = settlement?.status ?? 'draft';

  const [saving, setSaving]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  const [contactName, setContactName] = useState('');
  const [number, setNumber]           = useState('');
  const [date, setDate]               = useState(today());
  const [autoSettle, setAutoSettle]   = useState(true);
  const [reference, setReference]     = useState('');
  const [comments, setComments]       = useState('');

  const [receivableLines, setReceivableLines] = useState<ReceivableLine[]>([]);
  const [receivedLines,   setReceivedLines]   = useState<ReceivedLine[]>([]);

  const contactRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        if (settlement) {
          setContactName(settlement.contact_name);
          setNumber(settlement.number);
          setDate(settlement.date.slice(0, 10));
          setAutoSettle(settlement.auto_settle);
          setReference(settlement.reference ?? '');
          setComments(settlement.comments ?? '');
          const full = await getOCSSettlement(settlement.id);
          setReceivableLines(
            (full.receivable_lines ?? []).map((l) => ({
              description:    l.description,
              lineDate:       '',
              dueDate:        '',
              totalAmount:    String(l.amount),
              adjustedAmount: String(l.settled_amount),
              allocate:       String(l.amount - l.settled_amount),
              checked:        false,
            }))
          );
          setReceivedLines(
            (full.received_lines ?? []).map((l) => ({
              description:    l.description,
              lineDate:       '',
              dueDate:        '',
              totalAmount:    String(l.amount),
              adjustedAmount: '0',
              allocate:       String(l.amount),
              checked:        false,
            }))
          );
        } else {
          const num = await getNextOCSNumber();
          setNumber(num);
        }
      } finally { setLoading(false); }
    }
    init();
  }, []);

  async function refreshNumber() {
    try { setNumber(await getNextOCSNumber()); } catch { /* ignore */ }
  }

  function toggleAllReceivable(checked: boolean) {
    setReceivableLines((prev) => prev.map((l) => ({ ...l, checked })));
  }
  function toggleAllReceived(checked: boolean) {
    setReceivedLines((prev) => prev.map((l) => ({ ...l, checked })));
  }

  function setRL(i: number, patch: Partial<ReceivableLine>) {
    setReceivableLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function setRecL(i: number, patch: Partial<ReceivedLine>) {
    setReceivedLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function addReceivable() { setReceivableLines((p) => [...p, emptyReceivable()]); }
  function addReceived()   { setReceivedLines((p) => [...p, emptyReceived()]); }

  function removeReceivable(i: number) {
    setReceivableLines((p) => p.filter((_, idx) => idx !== i));
  }
  function removeReceived(i: number) {
    setReceivedLines((p) => p.filter((_, idx) => idx !== i));
  }

  function validate() {
    const e: Record<string, string> = {};
    const contactErr = validateName(contactName, 'Contact'); if (contactErr) e.contactName = contactErr;
    if (!date) e.date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(addNew = false) {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        contact_name: contactName.trim(),
        date,
        reference: reference || null,
        comments:  comments  || null,
        auto_settle: autoSettle,
        receivable_lines: receivableLines
          .filter((l) => l.description || parseFloat(l.totalAmount) > 0)
          .map((l) => ({
            reference_no:   '',
            description:    l.description,
            amount:         parseFloat(l.totalAmount) || 0,
            settled_amount: parseFloat(l.adjustedAmount) || 0,
          })),
        received_lines: receivedLines
          .filter((l) => l.description || parseFloat(l.totalAmount) > 0)
          .map((l) => ({
            reference_no: '',
            description:  l.description,
            amount:       parseFloat(l.totalAmount) || 0,
            payment_mode: 'cash',
          })),
      };
      if (isEdit) await updateOCSSettlement(settlement!.id, payload);
      else        await createOCSSettlement(payload);
      onSaved(addNew);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="w-full flex flex-col">
        <div className="bg-white rounded p-8">
          <svg className="h-8 w-8 animate-spin text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      </div>
    );
  }

  const allRLChecked = receivableLines.length > 0 && receivableLines.every((l) => l.checked);
  const allRecChecked = receivedLines.length > 0 && receivedLines.every((l) => l.checked);

  return (
    <div className="w-full flex flex-col bg-white">

        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">
            Other Contact Settlements{number ? ` - [${number}]` : ''}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-500 tracking-widest uppercase">{status}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Row 1: Contact | Number | Date */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact <span className="text-red-500">*</span>
              </label>
              <div className={`flex items-center border rounded px-3 py-2 bg-white ${
                errors.contactName ? 'border-red-500' : 'border-gray-300'
              }`}>
                <input
                  ref={contactRef}
                  type="text"
                  placeholder="Type to search contact"
                  className="flex-1 text-sm outline-none bg-transparent"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
                <svg className="w-4 h-4 text-gray-400 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {errors.contactName && <p className="text-xs text-red-500 mt-0.5">{errors.contactName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <button className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-l border border-green-500 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <input
                  type="text"
                  className="flex-1 border-t border-b border-gray-300 px-3 py-2 text-sm focus:outline-none text-center"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <button
                  onClick={refreshNumber}
                  className="bg-green-500 hover:bg-green-600 text-white px-2 rounded-r border border-green-500"
                  title="Refresh number"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
            </div>
          </div>

          {/* Make auto settlements */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoSettle"
              className="w-4 h-4 accent-blue-600"
              checked={autoSettle}
              onChange={(e) => setAutoSettle(e.target.checked)}
            />
            <label htmlFor="autoSettle" className="text-sm font-medium text-gray-700">Make auto settlements</label>
          </div>

          {/* Receivables table */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Receivables</p>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={allRLChecked}
                        onChange={(e) => toggleAllReceivable(e.target.checked)}
                      />
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Description</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 w-28">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 w-28">Due Date</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Total Amount</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Adjusted Amount</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Balance Amount</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Allocate</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {receivableLines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-orange-500 font-medium text-sm">
                        No record found
                      </td>
                    </tr>
                  ) : (
                    receivableLines.map((line, i) => {
                      const balance = (parseFloat(line.totalAmount) || 0) - (parseFloat(line.adjustedAmount) || 0);
                      return (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-blue-600"
                              checked={line.checked}
                              onChange={(e) => setRL(i, { checked: e.target.checked })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                              value={line.description}
                              onChange={(e) => setRL(i, { description: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                              value={line.lineDate}
                              onChange={(e) => setRL(i, { lineDate: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                              value={line.dueDate}
                              onChange={(e) => setRL(i, { dueDate: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none"
                              value={line.totalAmount}
                              onChange={(e) => setRL(i, { totalAmount: e.target.value })}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right bg-gray-50 focus:outline-none"
                              value={line.adjustedAmount}
                              readOnly
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              readOnly
                              className="w-full border border-gray-100 rounded px-2 py-1 text-sm text-right bg-gray-50"
                              value={balance.toFixed(2)}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400"
                              value={line.allocate}
                              onChange={(e) => setRL(i, { allocate: e.target.value })}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button onClick={() => removeReceivable(i)} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={addReceivable} className="mt-1.5 text-sm text-blue-600 hover:underline font-medium">+ Add Line</button>
          </div>

          {/* Received table */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Received</p>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600"
                        checked={allRecChecked}
                        onChange={(e) => toggleAllReceived(e.target.checked)}
                      />
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Description</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 w-28">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 w-28">Due Date</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Total Amount</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Adjusted Amount</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Balance Amount</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700 w-28">Allocate</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {receivedLines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-orange-500 font-medium text-sm">
                        No record found
                      </td>
                    </tr>
                  ) : (
                    receivedLines.map((line, i) => {
                      const balance = (parseFloat(line.totalAmount) || 0) - (parseFloat(line.adjustedAmount) || 0);
                      return (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-blue-600"
                              checked={line.checked}
                              onChange={(e) => setRecL(i, { checked: e.target.checked })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                              value={line.description}
                              onChange={(e) => setRecL(i, { description: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                              value={line.lineDate}
                              onChange={(e) => setRecL(i, { lineDate: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
                              value={line.dueDate}
                              onChange={(e) => setRecL(i, { dueDate: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none"
                              value={line.totalAmount}
                              onChange={(e) => setRecL(i, { totalAmount: e.target.value })}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              readOnly
                              className="w-full border border-gray-100 rounded px-2 py-1 text-sm text-right bg-gray-50"
                              value={line.adjustedAmount}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              readOnly
                              className="w-full border border-gray-100 rounded px-2 py-1 text-sm text-right bg-gray-50"
                              value={balance.toFixed(2)}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400"
                              value={line.allocate}
                              onChange={(e) => setRecL(i, { allocate: e.target.value })}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button onClick={() => removeReceived(i)} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={addReceived} className="mt-1.5 text-sm text-blue-600 hover:underline font-medium">+ Add Line</button>
          </div>

          {/* Reference & Comments */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-l disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-2 py-2 rounded-r border-l border-blue-700 disabled:opacity-50"
            >
              ▼
            </button>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded"
          >
            × CLOSE
          </button>
        </div>
    </div>
  );
}
