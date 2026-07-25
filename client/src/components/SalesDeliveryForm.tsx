import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { SalesDelivery, SalesDeliveryLine } from '../types/salesDelivery';
import { SD_STATUS_LABELS } from '../types/salesDelivery';
import {
  createSalesDelivery, updateSalesDelivery, getSalesDelivery, getNextDeliveryNumber,
} from '../api/salesDeliveries';
import QuickAddModal from './QuickAddModal';

interface Customer  { id: number; print_name: string; }
interface Warehouse { id: number; name: string; }
interface Product   { id: number; name: string; sku?: string; barcode?: string; sale_price?: number; }
interface Props     { delivery: SalesDelivery | null; onClose: () => void; onSaved: () => void; }

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const emptyLine = (): SalesDeliveryLine => ({ product_id: null, description: '', ordered_qty: 0, delivered_qty: 0 });

export default function SalesDeliveryForm({ delivery, onClose, onSaved }: Props) {
  const isEdit = delivery !== null;
  const [customers,     setCustomers]     = useState<Customer[]>([]);
  const [warehouses,    setWarehouses]    = useState<Warehouse[]>([]);
  const [products,      setProducts]      = useState<Product[]>([]);

  const [number,          setNumber]          = useState('');
  const [customerId,      setCustomerId]       = useState('');
  const [warehouseId,     setWarehouseId]      = useState('');
  const [date,            setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [reference,       setReference]        = useState('');
  const [subject,         setSubject]          = useState('');
  const [shippingAddress, setShippingAddress]  = useState('');
  const [comments,        setComments]         = useState('');
  const [lines,           setLines]            = useState<SalesDeliveryLine[]>([emptyLine()]);
  const [saving,          setSaving]           = useState(false);
  const [savingContinue,  setSavingContinue]   = useState(false);
  const [error,           setError]            = useState('');
  const [showQuickAdd,    setShowQuickAdd]      = useState(false);
  const [attachments,     setAttachments]       = useState<File[]>([]);
  const [dragOver,        setDragOver]          = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = (isEdit ? delivery!.status : 'draft') as string;

  useEffect(() => {
    apiFetch('/api/customers?limit=500').then(r => r.json()).then(d =>
      setCustomers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
    apiFetch('/api/warehouses').then(r => r.json()).then(d => setWarehouses(Array.isArray(d) ? d : []));
    apiFetch('/api/products?limit=500').then(r => r.json()).then(d =>
      setProducts(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []))
    );
    if (!isEdit) getNextDeliveryNumber().then(d => setNumber(d.number)).catch(() => setNumber('SD-000001'));
  }, []);

  // Auto-select first warehouse
  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) setWarehouseId(String(warehouses[0].id));
  }, [warehouses]);

  useEffect(() => {
    if (!delivery) return;
    getSalesDelivery(delivery.id).then(full => {
      setNumber(full.number);
      setCustomerId(String(full.customer_id));
      setWarehouseId(String(full.warehouse_id));
      setDate(full.date?.slice(0, 10) ?? '');
      setReference(full.reference ?? '');
      setSubject(full.subject ?? '');
      setShippingAddress(full.shipping_address ?? '');
      setComments(full.notes ?? '');
      setLines(full.lines?.length ? full.lines : [emptyLine()]);
    });
  }, [delivery]);

  const handleFilesDrop = useCallback((files: FileList | null) => {
    if (!files) return;
    setAttachments(prev => [...prev, ...Array.from(files)]);
  }, []);

  function removeAttachment(i: number) {
    setAttachments(prev => prev.filter((_, idx) => idx !== i));
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function updLine(i: number, patch: Partial<SalesDeliveryLine>) {
    setLines(prev => prev.map((l, idx) => idx !== i ? l : { ...l, ...patch }));
  }

  function handleQuickAdd(line: Partial<SalesDeliveryLine>) {
    const newLine: SalesDeliveryLine = {
      product_id:   line.product_id ?? null,
      description:  line.description ?? '',
      ordered_qty:  line.ordered_qty ?? 1,
      delivered_qty: line.delivered_qty ?? 1,
    };
    setLines(prev => {
      const isBlank = prev.length === 1 && !prev[0].product_id && !prev[0].description;
      return isBlank ? [newLine] : [...prev, newLine];
    });
  }

  function buildPayload() {
    return {
      customer_id:      Number(customerId),
      warehouse_id:     Number(warehouseId),
      order_id:         null,
      date,
      reference:        reference || null,
      notes:            comments || null,
      subject:          subject || null,
      shipping_address: shippingAddress || null,
      lines:            lines.filter(l => l.product_id || l.description).map(l => ({
        ...l, ordered_qty: l.delivered_qty,
      })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!customerId)  { setError('Customer is required'); return; }
    if (!warehouseId) { setError('Warehouse is required'); return; }
    setSaving(true);
    try {
      if (isEdit) await updateSalesDelivery(delivery!.id, buildPayload());
      else        await createSalesDelivery(buildPayload());
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleSaveAndContinue() {
    setError('');
    if (!customerId)  { setError('Customer is required'); return; }
    if (!warehouseId) { setError('Warehouse is required'); return; }
    setSavingContinue(true);
    try {
      if (isEdit) await updateSalesDelivery(delivery!.id, buildPayload());
      else {
        const created = await createSalesDelivery(buildPayload());
        setNumber(created.number);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSavingContinue(false); }
  }

  return (
    <>
      <div className="w-full bg-white flex flex-col">

          {/* Title */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">
              Sale Deliveries {number ? `- [${number}]` : ''}
            </h2>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
                {SD_STATUS_LABELS[status as keyof typeof SD_STATUS_LABELS] || 'DRAFT'}
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

              {/* Row 1: Customer | Number | Date | Warehouse */}
              <div className="grid grid-cols-4 gap-4">
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
                    <button type="button" className="bg-green-500 hover:bg-green-600 text-white rounded px-2 py-2" title="Previous">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <input className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-center font-mono" value={number} readOnly />
                    <button type="button" className="bg-green-500 hover:bg-green-600 text-white rounded px-2 py-2" title="Refresh"
                      onClick={() => getNextDeliveryNumber().then(d => setNumber(d.number))}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" required
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={date} onChange={e => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                  <select required
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Reference | Subject | QUICKLY ADD PRODUCTS / SCAN */}
              <div className="flex items-end gap-4">
                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                <div className="flex-shrink-0">
                  <button type="button"
                    onClick={() => setShowQuickAdd(true)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    QUICKLY ADD PRODUCTS / SCAN
                  </button>
                </div>
              </div>

              {/* Products table */}
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Product</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-700 w-36">Quantity</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700 w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((l, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <select
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-gray-50 focus:bg-white focus:border-green-400 focus:outline-none"
                            value={l.product_id ?? ''}
                            onChange={e => {
                              const pid = e.target.value ? Number(e.target.value) : null;
                              const p = products.find(x => x.id === pid);
                              updLine(i, { product_id: pid, description: p?.name ?? '' });
                            }}
                          >
                            <option value="">Type to search product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" min="0" step="any"
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                            value={l.delivered_qty || ''}
                            placeholder="0"
                            onChange={e => updLine(i, { delivered_qty: Number(e.target.value), ordered_qty: Number(e.target.value) })}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" title="Add new row"
                              className="text-green-500 hover:text-green-700"
                              onClick={() => setLines(prev => [...prev, emptyLine()])}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button type="button" title="Remove row"
                              className="text-red-400 hover:text-red-600"
                              onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}
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
              </div>

              {/* Bottom: Shipping Address | Comments */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                    rows={5} placeholder="Shipping Address"
                    value={shippingAddress} onChange={e => setShippingAddress(e.target.value)}
                  />
                </div>
                <div>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                    rows={5} placeholder="Comments"
                    value={comments} onChange={e => setComments(e.target.value)}
                  />
                </div>
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
                <div
                  className={`border-2 border-dashed rounded-lg px-6 py-5 text-center transition-colors ${dragOver ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFilesDrop(e.dataTransfer.files); }}
                >
                  <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <p className="text-sm text-gray-500">Drag &amp; drop files here, or{' '}
                    <button type="button" className="text-green-600 hover:text-green-700 font-medium underline"
                      onClick={() => fileInputRef.current?.click()}>
                      browse
                    </button>
                  </p>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => handleFilesDrop(e.target.files)} />
                </div>

                {attachments.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {attachments.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate text-gray-800">{f.name}</span>
                          <span className="flex-shrink-0 text-xs text-gray-400">({formatBytes(f.size)})</span>
                        </div>
                        <button type="button" onClick={() => removeAttachment(i)}
                          className="ml-3 flex-shrink-0 text-red-400 hover:text-red-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
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
          </form>
        </div>

      {showQuickAdd && (
        <QuickAddModal
          products={products}
          taxes={[]}
          onAdd={handleQuickAdd}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
    </>
  );
}

