import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

const j = (r: Response) => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(new Error(e.error)));

const BARCODE_FORMATS  = ['CODE128', 'QR', 'EAN13', 'EAN8'];
const UNITS            = ['in', 'cm', 'mm'];
const TEMPLATE_TYPES   = ['Company Name', 'Product Name', 'Barcode', 'Product Code', 'Product Price'];

interface BarcodeTemplate {
  id: number;
  name: string;
  barcode_type: string;
  unit_of_measurement: string;
  template_types: string[];
  page_width: number;    page_height: number;
  cols: number;          gap_h: number;
  rows: number;          gap_v: number;
  quantity: number;      print_on_laser: boolean;
  barcode_width: number; barcode_height: number; barcode_top_spacing: number;
  margin_top: number;    margin_bottom: number;  margin_left: number; margin_right: number;
  company_name_show: boolean; company_name_font_size: number; company_name_left: number;
  show_name: boolean;         product_name_font_size: number; product_name_left: number;
  show_code: boolean;         barcode_label_font_size: number; barcode_label_margin: number;
  show_price: boolean;        product_price_font_size: number; product_price_margin: number;
  print_mrp: boolean;
  batch_number_barcode_show: boolean;
  batch_number_show: boolean; expiry_date_show: boolean;
  batch_number_font_size: number; expiry_date_font_size: number;
  is_default: boolean;
}

const empty = (): Partial<BarcodeTemplate> => ({
  name: '', barcode_type: 'CODE128', unit_of_measurement: 'in', template_types: [],
  page_width: 2, page_height: 0.9,
  cols: 1, gap_h: 0, rows: 1, gap_v: 0,
  quantity: 10, print_on_laser: false,
  barcode_width: 1.5, barcode_height: 28, barcode_top_spacing: 0,
  margin_top: 0.1, margin_bottom: 0, margin_left: 0, margin_right: 0,
  company_name_show: true, company_name_font_size: 10, company_name_left: 0,
  show_name: true,         product_name_font_size: 10, product_name_left: 0,
  show_code: true,         barcode_label_font_size: 11, barcode_label_margin: 2,
  show_price: true,        product_price_font_size: 11, product_price_margin: 0,
  print_mrp: false,
  batch_number_barcode_show: false,
  batch_number_show: false, expiry_date_show: false,
  batch_number_font_size: 8, expiry_date_font_size: 8,
  is_default: false,
});

// ─── Template Types Tag Input ──────────────────────────────────────────────────
function TypeTags({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = (t: string) => onChange(selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t]);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div
        className="min-h-[38px] w-full border border-gray-300 rounded px-2 py-1.5 flex flex-wrap gap-1 items-center cursor-pointer bg-white focus-within:ring-1 focus-within:ring-green-500"
        onClick={() => setOpen(v => !v)}>
        {selected.map(t => (
          <span key={t} className="flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
            {t}
            <button type="button" onClick={e => { e.stopPropagation(); toggle(t); }} className="hover:text-green-900 leading-none">×</button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-gray-400 text-sm">Select types…</span>}
        <svg className="ml-auto h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1">
          {TEMPLATE_TYPES.map(t => (
            <label key={t} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={e => e.stopPropagation()}>
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                checked={selected.includes(t)} onChange={() => toggle(t)} />
              <span className="text-sm text-gray-700">{t}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Form (full-page) ──────────────────────────────────────────────────
function BarcodeForm({ initial, onSave, onClose }: {
  initial?: BarcodeTemplate | null;
  onSave: (d: Partial<BarcodeTemplate>, mode: 'new' | 'close') => Promise<void>;
  onClose: () => void;
}) {
  const [f,           setF]          = useState<Partial<BarcodeTemplate>>({ ...empty(), ...initial });
  const [preview,     setPreview]    = useState('12340987');
  const [nameErr,     setNameErr]    = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [error,       setError]      = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [dropOpen,    setDropOpen]   = useState(false);
  const svgRef    = useRef<SVGSVGElement>(null);
  const dropRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dropOpen]);

  function generatePreview() {
    setShowPreview(true);
    setTimeout(() => {
      if (!svgRef.current) return;
      try {
        JsBarcode(svgRef.current, preview || '12340987', {
          format: (f.barcode_type === 'QR' ? 'CODE128' : f.barcode_type) ?? 'CODE128',
          width: 1.5, height: 50, displayValue: true, fontSize: 12,
          margin: 4, background: '#ffffff', lineColor: '#000000',
        });
      } catch { /* invalid barcode value */ }
    }, 50);
  }

  const set = (k: keyof BarcodeTemplate, v: unknown) => setF(prev => ({ ...prev, [k]: v }));
  const num = (k: keyof BarcodeTemplate) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, parseFloat(e.target.value) || 0);

  async function save(mode: 'new' | 'close') {
    if (!f.name?.trim()) { setNameErr(true); return; }
    setNameErr(false); setSaving(true); setError('');
    try {
      await onSave(f, mode);
      if (mode === 'new') { setF({ ...empty() }); setShowPreview(false); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  const inp = 'w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500';
  const lbl = 'block text-xs text-gray-600 mb-1';

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {initial ? `Edit Barcode Template [${initial.name}]` : 'Add Barcode Template'}
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

          {/* Top row: 4 fields */}
          <div className="grid grid-cols-4 gap-4">
            {/* Barcode Template Name */}
            <div>
              <label className={lbl}>Barcode Template Name <span className="text-red-500">*</span></label>
              <input className={`${inp} ${nameErr ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                placeholder="Barcode Template Name" value={f.name ?? ''}
                onChange={e => { setF(p => ({ ...p, name: e.target.value })); setNameErr(false); }} />
              {nameErr && <p className="text-xs text-red-500 mt-1">Barcode Template is required.</p>}
            </div>
            {/* Barcode Value (preview) */}
            <div>
              <label className={lbl}>
                Barcode Value <span className="text-orange-500 text-xs">(For preview)</span>
              </label>
              <input className={inp} value={preview} onChange={e => setPreview(e.target.value)} />
            </div>
            {/* Unit Of Measurement */}
            <div>
              <label className={lbl}>Unit Of Measurement <span className="text-red-500">*</span></label>
              <select className={inp} value={f.unit_of_measurement ?? 'in'} onChange={e => set('unit_of_measurement', e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            {/* Template Types */}
            <div>
              <label className={lbl}>Template Types</label>
              <TypeTags selected={f.template_types ?? []} onChange={v => set('template_types', v)} />
            </div>
          </div>

          {/* 3-column layout */}
          <div className="grid grid-cols-3 gap-4 items-start">

            {/* ── Left: Page General ── */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-base font-bold text-gray-800 mb-4">Page General</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Page Width</label>
                    <input type="number" step="any" className={inp} value={f.page_width ?? 2} onChange={num('page_width')} /></div>
                  <div><label className={lbl}>Page Height</label>
                    <input type="number" step="any" className={inp} value={f.page_height ?? 0.9} onChange={num('page_height')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Horizontal Count</label>
                    <input type="number" min="1" className={inp} value={f.cols ?? 1} onChange={num('cols')} /></div>
                  <div><label className={lbl}>Horizontal Gap</label>
                    <input type="number" step="any" className={inp} value={f.gap_h ?? 0} onChange={num('gap_h')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Vertical Count</label>
                    <input type="number" min="1" className={inp} value={f.rows ?? 1} onChange={num('rows')} /></div>
                  <div><label className={lbl}>Vertical Gap</label>
                    <input type="number" step="any" className={inp} value={f.gap_v ?? 0} onChange={num('gap_v')} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div><label className={lbl}>Quantity</label>
                    <input type="number" min="1" className={inp} value={f.quantity ?? 10} onChange={num('quantity')} /></div>
                  <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.print_on_laser} onChange={e => set('print_on_laser', e.target.checked)} />
                    <span className="text-sm text-gray-700">Print On<br />Laser</span>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Middle: Barcode General + Barcode Margin ── */}
            <div className="space-y-4">
              {/* Barcode General */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <h3 className="text-base font-bold text-gray-800 mb-4">Barcode General</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Format</label>
                      <select className={inp} value={f.barcode_type ?? 'CODE128'} onChange={e => set('barcode_type', e.target.value)}>
                        {BARCODE_FORMATS.map(t => <option key={t}>{t}</option>)}
                      </select></div>
                    <div><label className={lbl}>Barcode Width</label>
                      <input type="number" step="any" className={inp} value={f.barcode_width ?? 1.5} onChange={num('barcode_width')} /></div>
                  </div>
                  <div><label className={lbl}>Barcode Height</label>
                    <input type="number" step="any" className={inp} value={f.barcode_height ?? 28} onChange={num('barcode_height')} /></div>
                </div>
              </div>

              {/* Barcode Margin */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <h3 className="text-base font-bold text-gray-800 mb-4">Barcode Margin</h3>
                <div className="space-y-3">
                  <div><label className={lbl}>Barcode Top Spacing</label>
                    <input type="number" step="any" className={inp} value={f.barcode_top_spacing ?? 0} onChange={num('barcode_top_spacing')} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Margin Top</label>
                      <input type="number" step="any" className={inp} value={f.margin_top ?? 0} onChange={num('margin_top')} /></div>
                    <div><label className={lbl}>Margin Bottom</label>
                      <input type="number" step="any" className={inp} value={f.margin_bottom ?? 0} onChange={num('margin_bottom')} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Margin Left</label>
                      <input type="number" step="any" className={inp} value={f.margin_left ?? 0} onChange={num('margin_left')} /></div>
                    <div><label className={lbl}>Margin Right</label>
                      <input type="number" step="any" className={inp} value={f.margin_right ?? 0} onChange={num('margin_right')} /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: Label Elements ── */}
            <div className="space-y-4">
              {/* Company Name */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-800">Company Name</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.company_name_show} onChange={e => set('company_name_show', e.target.checked)} />
                    <span className="text-sm text-gray-700">Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Font Size</label>
                    <input type="number" step="any" className={inp} value={f.company_name_font_size ?? 10} onChange={num('company_name_font_size')} /></div>
                  <div><label className={lbl}>Left</label>
                    <input type="number" step="any" className={inp} value={f.company_name_left ?? 0} onChange={num('company_name_left')} /></div>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-800">Product Name</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.show_name} onChange={e => set('show_name', e.target.checked)} />
                    <span className="text-sm text-gray-700">Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Font Size</label>
                    <input type="number" step="any" className={inp} value={f.product_name_font_size ?? 10} onChange={num('product_name_font_size')} /></div>
                  <div><label className={lbl}>Left</label>
                    <input type="number" step="any" className={inp} value={f.product_name_left ?? 0} onChange={num('product_name_left')} /></div>
                </div>
              </div>

              {/* Barcode Label */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-800">Barcode Label</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.show_code} onChange={e => set('show_code', e.target.checked)} />
                    <span className="text-sm text-gray-700">Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Font Size</label>
                    <input type="number" step="any" className={inp} value={f.barcode_label_font_size ?? 11} onChange={num('barcode_label_font_size')} /></div>
                  <div><label className={lbl}>Label Margin</label>
                    <input type="number" step="any" className={inp} value={f.barcode_label_margin ?? 2} onChange={num('barcode_label_margin')} /></div>
                </div>
              </div>

              {/* Product Price */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-800">Product Price</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.show_price} onChange={e => set('show_price', e.target.checked)} />
                    <span className="text-sm text-gray-700">Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Font Size</label>
                    <input type="number" step="any" className={inp} value={f.product_price_font_size ?? 11} onChange={num('product_price_font_size')} /></div>
                  <div><label className={lbl}>Price Margin</label>
                    <input type="number" step="any" className={inp} value={f.product_price_margin ?? 0} onChange={num('product_price_margin')} /></div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    checked={!!f.print_mrp} onChange={e => set('print_mrp', e.target.checked)} />
                  <span className="text-sm text-gray-700">Print Maximum Retail Price (MRP)</span>
                </label>
              </div>

              {/* Batch Number Barcode */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-800">Batch Number Barcode</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.batch_number_barcode_show} onChange={e => set('batch_number_barcode_show', e.target.checked)} />
                    <span className="text-sm text-gray-700">Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="flex items-start gap-1.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.batch_number_show} onChange={e => set('batch_number_show', e.target.checked)} />
                    <span className="text-sm text-gray-700 leading-tight">Show<br />Batch<br />Number</span>
                  </label>
                  <label className="flex items-start gap-1.5 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={!!f.expiry_date_show} onChange={e => set('expiry_date_show', e.target.checked)} />
                    <span className="text-sm text-gray-700 leading-tight">Show<br />Expiry<br />Date</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Batch Number<br />Font Size</label>
                    <input type="number" step="any" className={inp} value={f.batch_number_font_size ?? 8} onChange={num('batch_number_font_size')} /></div>
                  <div><label className={lbl}>Expiry Date Font<br />Size</label>
                    <input type="number" step="any" className={inp} value={f.expiry_date_font_size ?? 8} onChange={num('expiry_date_font_size')} /></div>
                </div>
              </div>
            </div>
          </div>

          {/* Barcode Preview Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800">Barcode Preview</h3>
              <button type="button" onClick={generatePreview}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded uppercase tracking-wide">
                GENERATE BARCODE FOR DEMO
              </button>
            </div>
            {showPreview && (
              <div className="inline-block border border-gray-300 bg-white p-3 rounded">
                {f.company_name_show && (
                  <p className="text-center text-xs text-gray-800 mb-0.5" style={{ fontSize: `${f.company_name_font_size ?? 10}px` }}>
                    Company Name
                  </p>
                )}
                {f.show_name && (
                  <p className="text-center text-xs text-gray-600 mb-1" style={{ fontSize: `${f.product_name_font_size ?? 10}px` }}>
                    (Product Name)
                  </p>
                )}
                <svg ref={svgRef} />
                {f.batch_number_show && (
                  <p className="text-center mt-1" style={{ fontSize: `${f.batch_number_font_size ?? 8}px` }}>
                    Batch: LOT-001
                  </p>
                )}
                {f.expiry_date_show && (
                  <p className="text-center" style={{ fontSize: `${f.expiry_date_font_size ?? 8}px` }}>
                    Exp: 2026-12-31
                  </p>
                )}
                {f.show_price && (
                  <p className="text-center font-semibold text-gray-800" style={{ fontSize: `${f.product_price_font_size ?? 11}px` }}>
                    Rs250
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          {/* SAVE AND NEW split button */}
          <div className="relative flex" ref={dropRef}>
            <button type="button" onClick={() => save('new')} disabled={saving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-l disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? 'Saving…' : 'SAVE AND NEW'}
            </button>
            <button type="button" onClick={() => setDropOpen(v => !v)} disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-r border-l border-green-500 disabled:opacity-60">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </button>
            {dropOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-gray-200 rounded shadow-lg z-20">
                <button type="button" onClick={() => { setDropOpen(false); save('close'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Save and Close
                </button>
              </div>
            )}
          </div>

          {/* CLOSE */}
          <button type="button" onClick={onClose}
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
            <span className="text-base leading-none">×</span>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BarcodeTemplatesPage() {
  const [view,      setView]      = useState<'list' | 'detail'>('list');
  const [templates, setTemplates] = useState<BarcodeTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState<BarcodeTemplate | null>(null);
  const [actErr,    setActErr]    = useState('');
  const [search,    setSearch]    = useState('');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('asc');
  const [page,      setPage]      = useState(1);
  const [perPage,   setPerPage]   = useState(50);

  async function load() {
    setLoading(true);
    try { setTemplates(await apiFetch('/api/barcode-templates').then(j) as BarcodeTemplate[]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(d: Partial<BarcodeTemplate>, mode: 'new' | 'close') {
    if (editing) {
      await apiFetch(`/api/barcode-templates/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j);
    } else {
      await apiFetch('/api/barcode-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(j);
    }
    await load();
    if (mode === 'close') { setView('list'); setEditing(null); }
    else { setEditing(null); }
  }

  async function handleDelete(t: BarcodeTemplate) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    setActErr('');
    try { await apiFetch(`/api/barcode-templates/${t.id}`, { method: 'DELETE' }).then(j); await load(); }
    catch (e: unknown) { setActErr(e instanceof Error ? e.message : 'Error'); }
  }

  if (view === 'detail') {
    return (
      <BarcodeForm
        initial={editing}
        onSave={handleSave}
        onClose={() => { setView('list'); setEditing(null); }}
      />
    );
  }

  const sorted = templates
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) * (sortDir === 'asc' ? 1 : -1));

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated  = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Barcode / QR Code Templates</h1>
        <button onClick={() => { setEditing(null); setView('detail'); }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          ADD BARCODE / QR CODE TEMPLATE
        </button>
      </div>

      {actErr && <div className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{actErr}</div>}

      {/* Search */}
      <div className="mb-3 flex justify-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Search</label>
          <input
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-green-500"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-50"
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                Name <span className="text-gray-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={2} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-6 text-sm text-amber-500 font-medium">No record found</td></tr>
            ) : paginated.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button onClick={() => { setEditing(t); setView('detail'); }}
                    className="text-green-600 hover:underline font-medium text-sm text-left">
                    {t.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(t)}
                    className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                ‹
              </button>
              <button className="h-8 w-8 flex items-center justify-center rounded bg-green-600 text-white text-sm font-semibold">
                {page}
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                ›
              </button>
            </div>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
