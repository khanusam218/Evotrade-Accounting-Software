import { useEffect, useState } from 'react';
import type { BillOfMaterials } from '../types/billOfMaterials';
import type { WorkOrder, WOStatus } from '../types/workOrder';
import { WO_STATUS_COLORS } from '../types/workOrder';
import { getBOMs } from '../api/billsOfMaterials';
import { getWorkOrders, createWorkOrder, updateWorkOrder, startWorkOrder, completeWorkOrder, cancelWorkOrder, deleteWorkOrder } from '../api/workOrders';
import { getProducts } from '../api/products';
import type { Product } from '../types/product';

function printWorkOrders(records: WorkOrder[]) {
  const win = window.open('', '_blank', 'width=1000,height=680');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Job Orders</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#f5f5f5;font-weight:bold}h2{margin-bottom:12px}</style></head><body>
<h2>Job Order / Assembling</h2><table><thead><tr>
<th>Number</th><th>Date</th><th>BOM / Product</th><th>Warehouse</th>
<th>Planned Qty</th><th>Produced Qty</th><th>Status</th></tr></thead><tbody>
${records.map(r => `<tr>
<td>${r.number || ''}</td><td>${r.date?.slice(0, 10) || ''}</td>
<td>${r.bom_name || ''}${r.product_name ? ' / ' + r.product_name : ''}</td>
<td>${r.warehouse_name || '—'}</td>
<td style="text-align:right">${r.planned_qty}</td>
<td style="text-align:right">${r.produced_qty}</td>
<td>${r.status.replace('_', ' ')}</td></tr>`).join('')}
</tbody></table></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

function exportWorkOrdersToExcel(records: WorkOrder[]) {
  const header = ['Number', 'Date', 'BOM', 'Product', 'Warehouse', 'Planned Qty', 'Produced Qty', 'Status'];
  const rows = records.map(r => [
    r.number, r.date?.slice(0, 10), r.bom_name, r.product_name,
    r.warehouse_name || '', r.planned_qty, r.produced_qty, r.status.replace('_', ' '),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'job_orders.csv'; a.click();
  URL.revokeObjectURL(url);
}

function SortIcon({ col, sort }: { col: string; sort: { col: string; dir: 'asc' | 'desc' } }) {
  return (
    <svg className="inline w-3 h-3 ml-0.5" viewBox="0 0 8 10" fill="none">
      <path d="M4 0L7 4H1L4 0Z" fill={sort.col === col && sort.dir === 'asc' ? '#6b7280' : '#d1d5db'} />
      <path d="M4 10L1 6H7L4 10Z" fill={sort.col === col && sort.dir === 'desc' ? '#6b7280' : '#d1d5db'} />
    </svg>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'DRAFT',
  in_progress: 'IN PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

// Wide slide-over form
function JOForm({ initial, onClose, onSaved }: {
  initial: WorkOrder | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [bomId, setBomId] = useState(String(initial?.bom_id || ''));
  const [date, setDate] = useState(initial?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [plannedQty, setPlannedQty] = useState(initial?.planned_qty ?? 0);
  const [reference, setReference] = useState('');
  const [accountExpenses, setAccountExpenses] = useState(false);
  const [calcMethod, setCalcMethod] = useState('Method 1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isNew = !initial;
  const status = initial?.status || 'draft';
  const selectedBom = boms.find(b => String(b.id) === bomId);

  useEffect(() => {
    getBOMs({ is_active: 'true' }).then(setBoms);
  }, []);

  async function handleSave() {
    setError('');
    if (!bomId) { setError('Product To Assemble is required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        await createWorkOrder({ bom_id: Number(bomId), date, planned_qty: plannedQty, notes: reference || null });
      } else {
        await updateWorkOrder(initial!.id, { bom_id: Number(bomId), date, planned_qty: plannedQty, notes: reference || null });
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">
            Job Orders {initial?.number ? `- [${initial.number}]` : '- New'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold tracking-widest text-gray-400 uppercase">{STATUS_LABELS[status] || status}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {/* Row 1: BOM | Number | Date | Due Date | Total Cost (PKR) */}
          <div className="flex gap-4 items-end">
            <div className="flex-[2]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Product To Assemble <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border-2 border-red-400 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
                value={bomId} onChange={e => setBomId(e.target.value)}
              >
                <option value="">Type to search as…</option>
                {boms.map(b => <option key={b.id} value={b.id}>{b.name} → {b.product_name}</option>)}
              </select>
            </div>
            <div className="flex-[1.5]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Number <span className="text-red-500">*</span></label>
              <div className="flex">
                <button type="button" className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-l border border-green-700 hover:bg-green-700">+▼</button>
                <input type="text" readOnly value={initial?.number || 'JO-000001'}
                  className="flex-1 border-t border-b border-gray-300 px-2 py-1.5 text-sm bg-white text-gray-700 focus:outline-none min-w-0 text-center" />
                <button type="button" className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-r border border-green-700 hover:bg-green-700">↺</button>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date <span className="text-red-500">*</span></label>
              <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date <span className="text-red-500">*</span></label>
              <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Total Cost (PKR)</label>
              <input type="text" readOnly value="0.00"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-gray-100 text-gray-500 text-right focus:outline-none" />
            </div>
          </div>

          {/* Row 2: Quantity To Produce | Reference */}
          <div className="flex gap-4 items-end">
            <div className="w-48">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity To Produce</label>
              <input type="number" min="0" step="any"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={plannedQty} onChange={e => setPlannedQty(Number(e.target.value))} />
            </div>
            <div className="w-64">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reference</label>
              <input type="text"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference" />
            </div>
          </div>

          {/* Input (Consumption) */}
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-2">Input (Consumption)</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Product</th>
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-28">Batch</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-32">Stock Available</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-28">Quantity</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-20">Cost</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-20">Amount</th>
                  <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedBom?.components?.length ? selectedBom.components.map((comp, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center justify-between border border-gray-300 rounded px-2 py-1 bg-white gap-1">
                        <span className="text-gray-700 truncate">{comp.component_name || `Product #${comp.component_product_id}`}</span>
                        <span className="text-gray-400 shrink-0">▼</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50"></td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50 text-right text-gray-500"></td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" step="any" defaultValue={comp.quantity}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50 text-right text-gray-500"></td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50 text-right text-gray-500">0.00</td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" className="text-gray-500 hover:text-green-700 font-bold text-base leading-none">✓</button>
                        <button type="button" className="text-gray-500 hover:text-red-600 font-bold text-base leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center justify-between border border-gray-300 rounded px-2 py-1 bg-white gap-1">
                        <span className="text-gray-400">Type to search product</span>
                        <span className="text-gray-400 shrink-0">▼</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50"></td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50"></td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" defaultValue={0}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50"></td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50 text-right text-gray-500">0.00</td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" className="text-gray-500 hover:text-green-700 font-bold text-base leading-none">✓</button>
                        <button type="button" className="text-gray-500 hover:text-red-600 font-bold text-base leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Account Expenses checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={accountExpenses} onChange={e => setAccountExpenses(e.target.checked)} className="w-4 h-4 accent-green-600" />
              <span className="text-sm text-gray-700">Account Expenses (Optional)</span>
            </label>

            {/* Account Expenses table — shown only when checked */}
            {accountExpenses && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Account</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-40">Contact</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-24">Amount</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-16">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center justify-between border-2 border-red-400 rounded px-2 py-1 bg-white gap-1">
                        <span className="text-gray-400 text-xs">Type to search account</span>
                        <span className="text-gray-400 shrink-0">▼</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="text" className="w-full text-xs border-2 border-green-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center justify-between border border-gray-300 rounded px-2 py-1 bg-white gap-1">
                        <span className="text-gray-400 text-xs">Select contact</span>
                        <span className="text-gray-400 shrink-0">▼</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" defaultValue={0}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" className="text-gray-500 hover:text-green-700 font-bold text-base leading-none">✓</button>
                        <button type="button" className="text-gray-500 hover:text-red-600 font-bold text-base leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Calculation Method + Total Production Cost — between Account Expenses and Output */}
          <div className="flex items-end gap-8">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Calculation Method</p>
              <p className="text-orange-500 text-xs mb-1">(Cannot be changed once joborder saved.)</p>
              <select
                className="w-44 border border-green-500 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                value={calcMethod} onChange={e => setCalcMethod(e.target.value)}>
                <option>Method 1</option>
                <option>Method 2</option>
                <option>Standard</option>
              </select>
            </div>
            <div className="pb-1">
              <p className="text-base font-semibold text-gray-800">Total Production Cost:</p>
              <p className="text-xl font-semibold text-gray-800">0.00</p>
            </div>
          </div>

          {/* Output (Production) */}
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-2">Output (Production)</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Product</th>
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-24">Batch</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-28">Quantity</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-20">Cost</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-20">Cost %</th>
                  <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 w-20">Amount</th>
                  <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedBom ? (
                  <tr>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center justify-between border border-gray-300 rounded px-2 py-1 bg-white gap-1">
                        <span className="text-gray-700 truncate">{selectedBom.product_name || `Product #${selectedBom.product_id}`}</span>
                        <span className="text-gray-400 shrink-0">▼</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="text" className="w-full text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" step="any" defaultValue={plannedQty}
                        className="w-full text-right text-xs border-2 border-red-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" step="any" defaultValue={0}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" step="any" defaultValue={0}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50 text-right text-gray-500">0.00</td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" className="text-gray-500 hover:text-green-700 font-bold text-base leading-none">✓</button>
                        <button type="button" className="text-gray-500 hover:text-red-600 font-bold text-base leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex items-center justify-between border border-gray-300 rounded px-2 py-1 bg-white gap-1">
                        <span className="text-gray-400">Type to search product</span>
                        <span className="text-gray-400 shrink-0">▼</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5"></td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" defaultValue={0}
                        className="w-full text-right text-xs border-2 border-red-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" defaultValue={0}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <input type="number" defaultValue={0}
                        className="w-full text-right text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 bg-gray-50 text-right text-gray-500">0.00</td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" className="text-gray-500 hover:text-green-700 font-bold text-base leading-none">✓</button>
                        <button type="button" className="text-gray-500 hover:text-red-600 font-bold text-base leading-none">×</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 text-white text-sm font-medium px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onClose}
              className="border border-gray-300 text-gray-600 text-sm font-medium px-6 py-2 rounded hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
    </div>
  );
}

function CompleteModal({ wo, onClose, onSaved }: { wo: WorkOrder; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState(wo.planned_qty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try { await completeWorkOrder(wo.id, qty); onSaved(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Complete Work Order</h2>
        {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700 mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Produced Quantity</label>
            <input type="number" min="0" step="any" className="input" value={qty} onChange={e => setQty(Number(e.target.value))} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Completing…' : 'Complete'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManufacturingPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [editWO, setEditWO] = useState<WorkOrder | null | undefined>(undefined);
  const [completing, setCompleting] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const [showFilters, setShowFilters] = useState(false);
  const emptyFilters = {
    number: '', dateFrom: '', dateTo: '',
    reference: '', assemblyProductId: '',
    dueDateFrom: '', dueDateTo: '',
    quantityFrom: '', quantityTo: '',
    status: '', ioProductId: '', showVoid: false,
  };
  const [pendingFilters, setPendingFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'number', dir: 'asc' });
  const [filterProducts, setFilterProducts] = useState<Product[]>([]);

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== '' && v !== false).length;

  useEffect(() => {
    getProducts({ limit: 500 }).then(r => setFilterProducts(r.data)).catch(() => {});
  }, []);

  async function loadWOs() {
    setLoading(true);
    const p: Record<string, string> = {};
    if (appliedFilters.status) p.status = appliedFilters.status;
    try { setWorkOrders(await getWorkOrders(p)); } finally { setLoading(false); }
  }

  useEffect(() => { loadWOs(); }, [appliedFilters]);

  async function act(fn: () => Promise<unknown>, label: string) {
    try { await fn(); loadWOs(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : label + ' failed'); }
  }

  function toggleSort(col: string) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  }

  // ── Early return: show form full-page when adding/editing ──────────────────
  if (editWO !== undefined) return (
    <JOForm initial={editWO} onClose={() => setEditWO(undefined)} onSaved={() => { setEditWO(undefined); loadWOs(); }} />
  );

  let visibleWOs = [...workOrders];
  if (appliedFilters.number)    visibleWOs = visibleWOs.filter(w => w.number?.toLowerCase().includes(appliedFilters.number.toLowerCase()));
  if (appliedFilters.reference) visibleWOs = visibleWOs.filter(w => w.notes?.toLowerCase().includes(appliedFilters.reference.toLowerCase()));
  if (appliedFilters.dateFrom)  visibleWOs = visibleWOs.filter(w => (w.date?.slice(0, 10) ?? '') >= appliedFilters.dateFrom);
  if (appliedFilters.dateTo)    visibleWOs = visibleWOs.filter(w => (w.date?.slice(0, 10) ?? '') <= appliedFilters.dateTo);
  if (appliedFilters.quantityFrom) visibleWOs = visibleWOs.filter(w => w.planned_qty >= Number(appliedFilters.quantityFrom));
  if (appliedFilters.quantityTo)   visibleWOs = visibleWOs.filter(w => w.planned_qty <= Number(appliedFilters.quantityTo));
  visibleWOs.sort((a, b) => {
    let av: string | number = (a as Record<string, unknown>)[sort.col] as string | number ?? '';
    let bv: string | number = (b as Record<string, unknown>)[sort.col] as string | number ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return av < bv ? (sort.dir === 'asc' ? -1 : 1) : av > bv ? (sort.dir === 'asc' ? 1 : -1) : 0;
  });

  return (
    <div className="p-6">
      {/* Row 1: Title (left) + ADD JOB ORDER (right) */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Job Orders</h1>
        <button onClick={() => setEditWO(null)}
          className="bg-green-600 text-white text-xs font-semibold px-4 py-1.5 rounded hover:bg-green-700">
          + ADD JOB ORDER
        </button>
      </div>

      {/* Row 2: FILTERS (left) + PRINT | EXPORT TO EXCEL (right) */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { setPendingFilters(appliedFilters); setShowFilters(true); }}
          className="relative flex items-center gap-1.5 bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-blue-600">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          FILTERS
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-white text-blue-600 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => printWorkOrders(visibleWOs)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PRINT
          </button>
          <button onClick={() => exportWorkOrdersToExcel(visibleWOs)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            EXPORT TO EXCEL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              {[
                { col: 'number',       label: 'Number' },
                { col: 'date',         label: 'Date' },
                { col: 'notes',        label: 'Reference' },
                { col: 'product_name', label: 'Assembly Product' },
                { col: 'due_date',     label: 'Due Date' },
                { col: 'planned_qty',  label: 'Quantity' },
                { col: 'status',       label: 'Status' },
              ].map(({ col, label }) => (
                <th key={col} className="table-th cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(col)}>
                  {label} <SortIcon col={col} sort={sort} />
                </th>
              ))}
              <th className="table-th w-28 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-td text-center text-gray-400 py-10">Loading…</td></tr>
            ) : visibleWOs.length === 0 ? (
              <tr><td colSpan={8} className="table-td text-center text-orange-500 py-10">No record found</td></tr>
            ) : visibleWOs.map(wo => (
              <tr key={wo.id} className="border-b hover:bg-gray-50">
                <td className="table-td font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => setEditWO(wo)}>
                  {wo.number}
                </td>
                <td className="table-td">{wo.date?.slice(0, 10)}</td>
                <td className="table-td">{wo.notes || '—'}</td>
                <td className="table-td">{wo.product_name || wo.bom_name || '—'}</td>
                <td className="table-td">—</td>
                <td className="table-td text-right">{wo.planned_qty}</td>
                <td className="table-td">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[wo.status] || WO_STATUS_COLORS[wo.status as WOStatus]}`}>
                    {STATUS_LABELS[wo.status] || wo.status}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex items-center justify-center gap-1.5">
                    <button title="Edit" onClick={() => setEditWO(wo)} className="text-blue-500 hover:text-blue-700">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 13.172V16h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    {wo.status === 'draft' && (
                      <button title="Start" onClick={() => act(() => startWorkOrder(wo.id), 'Start')} className="text-blue-600 hover:text-blue-800">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {(wo.status === 'draft' || wo.status === 'in_progress') && (
                      <button title="Complete" onClick={() => setCompleting(wo)} className="text-green-600 hover:text-green-800">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {(wo.status === 'draft' || wo.status === 'in_progress') && (
                      <button title="Cancel" onClick={() => act(() => cancelWorkOrder(wo.id), 'Cancel')} className="text-orange-500 hover:text-orange-700">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {wo.status === 'draft' && (
                      <button title="Delete" onClick={() => act(() => deleteWorkOrder(wo.id), 'Delete')} className="text-red-500 hover:text-red-700">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {completing && (
        <CompleteModal wo={completing} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); loadWOs(); }} />
      )}

      {/* Filters modal — Splendid style: centered, green border, floating × */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl border-2 border-green-500 mx-4">

            {/* Floating red × — outside top-right corner */}
            <button onClick={() => setShowFilters(false)}
              className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold hover:bg-red-600 z-10 leading-none shadow-md">
              ×
            </button>

            {/* Fields — label left | input right */}
            <div className="px-8 py-6 space-y-4">

              {/* Number */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Number</label>
                <input type="text" placeholder="Type to search number"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.number}
                  onChange={e => setPendingFilters(f => ({ ...f, number: e.target.value }))} />
              </div>

              {/* Date From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-600 shrink-0">From:</span>
                  <input type="date"
                    className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateFrom}
                    onChange={e => setPendingFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-600 shrink-0">To:</span>
                  <input type="date"
                    className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dateTo}
                    onChange={e => setPendingFilters(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>

              {/* Reference */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Reference</label>
                <input type="text" placeholder="Type to search reference"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={pendingFilters.reference}
                  onChange={e => setPendingFilters(f => ({ ...f, reference: e.target.value }))} />
              </div>

              {/* Assembly Product */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700 leading-tight">Assembly<br />Product</label>
                <div className="relative flex-1">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white appearance-none"
                    value={pendingFilters.assemblyProductId}
                    onChange={e => setPendingFilters(f => ({ ...f, assemblyProductId: e.target.value }))}>
                    <option value="">Type to search assembly product</option>
                    {filterProducts.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Due Date From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Due Date</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-600 shrink-0">From:</span>
                  <input type="date"
                    className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dueDateFrom}
                    onChange={e => setPendingFilters(f => ({ ...f, dueDateFrom: e.target.value }))} />
                  <span className="text-sm text-gray-600 shrink-0">To:</span>
                  <input type="date"
                    className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.dueDateTo}
                    onChange={e => setPendingFilters(f => ({ ...f, dueDateTo: e.target.value }))} />
                </div>
              </div>

              {/* Quantity From / To */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Quantity</label>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-gray-600 shrink-0">From:</span>
                  <input type="number" placeholder="From"
                    className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.quantityFrom}
                    onChange={e => setPendingFilters(f => ({ ...f, quantityFrom: e.target.value }))} />
                  <span className="text-sm text-gray-600 shrink-0">To:</span>
                  <input type="number" placeholder="To"
                    className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={pendingFilters.quantityTo}
                    onChange={e => setPendingFilters(f => ({ ...f, quantityTo: e.target.value }))} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700">Status</label>
                <div className="relative flex-1">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white appearance-none"
                    value={pendingFilters.status}
                    onChange={e => setPendingFilters(f => ({ ...f, status: e.target.value }))}>
                    <option value="">Select status</option>
                    <option value="draft">Draft</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Input/Output Product */}
              <div className="flex items-center gap-4">
                <label className="w-36 shrink-0 text-sm font-medium text-gray-700 leading-tight">Input/Output<br />Product</label>
                <div className="relative flex-1">
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white appearance-none"
                    value={pendingFilters.ioProductId}
                    onChange={e => setPendingFilters(f => ({ ...f, ioProductId: e.target.value }))}>
                    <option value="">Type to search input/output product</option>
                    {filterProducts.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Show Void + SHOW MORE */}
              <div className="flex items-center justify-between pl-40">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                  <input type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 accent-green-600"
                    checked={pendingFilters.showVoid}
                    onChange={e => setPendingFilters(f => ({ ...f, showVoid: e.target.checked }))} />
                  Show Void
                </label>
                <button className="flex items-center gap-1.5 bg-green-500 text-white text-sm font-semibold px-4 py-1.5 rounded hover:bg-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  SHOW MORE
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-8 py-4 border-t border-gray-200">
              {/* SAVE FILTER — blue */}
              <button className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                SAVE FILTER
              </button>
              {/* APPLY — gray */}
              <button
                onClick={() => { setAppliedFilters(pendingFilters); setShowFilters(false); }}
                className="flex items-center gap-2 bg-gray-200 text-gray-500 text-sm font-semibold px-4 py-2 rounded hover:bg-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                APPLY
              </button>
              {/* CLEAR — blue */}
              <button
                onClick={() => { setPendingFilters(emptyFilters); setAppliedFilters(emptyFilters); setShowFilters(false); }}
                className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
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

