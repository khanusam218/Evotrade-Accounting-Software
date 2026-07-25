import { useEffect, useRef, useState } from 'react';

export interface PrintInvoice {
  number: string;
  date: string;
  due_date?: string | null;
  reference?: string | null;
  notes?: string | null;
  party_label: string;   // "Customer" | "Vendor"
  party_name: string;
  gross_amount: number;
  tax_amount: number;
  discount: number;
  net_amount: number;
  paid_amount?: number;
  balance_amount?: number;
  status: string;
  lines?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    amount: number;
    tax_name?: string;
    tax_amount: number;
  }>;
}

type Template = 'classic' | 'modern' | 'minimal';

const TEMPLATES: { value: Template; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern',  label: 'Modern'  },
  { value: 'minimal', label: 'Minimal' },
];

const fmt = (n: number | string) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

interface Props {
  invoice: PrintInvoice | null;
  title?: string;
  onClose: () => void;
}

// ── Template: Classic ────────────────────────────────────────────────────────
function ClassicTemplate({ inv }: { inv: PrintInvoice }) {
  return (
    <div className="p-10 font-serif text-gray-900 bg-white min-h-[29.7cm]">
      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">INVOICE</h1>
          <p className="text-lg text-gray-500 mt-1">{inv.number}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">Evotrade</p>
          <p className="text-sm text-gray-500 mt-1">Accounting Software</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t-2 border-gray-900 mb-8" />

      {/* Bill to / Details */}
      <div className="flex justify-between mb-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bill To</p>
          <p className="text-lg font-semibold">{inv.party_name}</p>
        </div>
        <div className="text-right space-y-1">
          <div className="flex justify-end gap-8">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Date</span>
            <span className="text-sm font-medium">{fmtDate(inv.date)}</span>
          </div>
          {inv.due_date && (
            <div className="flex justify-end gap-8">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Due</span>
              <span className="text-sm font-medium">{fmtDate(inv.due_date)}</span>
            </div>
          )}
          {inv.reference && (
            <div className="flex justify-end gap-8">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Ref</span>
              <span className="text-sm font-medium">{inv.reference}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lines Table */}
      <table className="w-full text-sm mb-8">
        <thead>
          <tr className="border-b-2 border-gray-900">
            <th className="text-left py-2 font-bold uppercase text-xs tracking-widest">Description</th>
            <th className="text-right py-2 font-bold uppercase text-xs tracking-widest w-16">Qty</th>
            <th className="text-right py-2 font-bold uppercase text-xs tracking-widest w-24">Unit Price</th>
            <th className="text-right py-2 font-bold uppercase text-xs tracking-widest w-16">Disc%</th>
            <th className="text-right py-2 font-bold uppercase text-xs tracking-widest w-20">Tax</th>
            <th className="text-right py-2 font-bold uppercase text-xs tracking-widest w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(inv.lines || []).map((l, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-3">{l.description}</td>
              <td className="py-3 text-right">{l.quantity}</td>
              <td className="py-3 text-right">{fmt(l.unit_price)}</td>
              <td className="py-3 text-right">{l.discount_pct ? `${l.discount_pct}%` : '—'}</td>
              <td className="py-3 text-right">{l.tax_name || '—'}</td>
              <td className="py-3 text-right font-medium">{fmt(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Gross Amount</span><span>{fmt(inv.gross_amount)}</span></div>
          {Number(inv.discount) > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>- {fmt(inv.discount)}</span></div>}
          {Number(inv.tax_amount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{fmt(inv.tax_amount)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t-2 border-gray-900 pt-2 mt-2">
            <span>Total Due</span><span>{fmt(inv.net_amount)}</span>
          </div>
        </div>
      </div>

      {inv.notes && <p className="mt-10 text-sm text-gray-500 border-t pt-4">{inv.notes}</p>}
    </div>
  );
}

// ── Template: Modern ─────────────────────────────────────────────────────────
function ModernTemplate({ inv }: { inv: PrintInvoice }) {
  return (
    <div className="bg-white min-h-[29.7cm] font-sans">
      {/* Header band */}
      <div className="bg-indigo-600 text-white px-10 py-8">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-3xl font-black tracking-tight">Evotrade</p>
            <p className="text-indigo-200 text-sm mt-1">Accounting Software</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black tracking-wide">INVOICE</p>
            <p className="text-indigo-200 text-lg mt-1">{inv.number}</p>
          </div>
        </div>
      </div>

      <div className="px-10 py-8">
        {/* Bill to / Info */}
        <div className="flex justify-between mb-8">
          <div className="bg-gray-50 rounded-xl p-5 flex-1 mr-4">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Bill To</p>
            <p className="text-lg font-bold text-gray-900">{inv.party_name}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 min-w-48">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-6">
                <span className="text-gray-400 font-medium">Date</span>
                <span className="font-semibold">{fmtDate(inv.date)}</span>
              </div>
              {inv.due_date && (
                <div className="flex justify-between gap-6">
                  <span className="text-gray-400 font-medium">Due Date</span>
                  <span className="font-semibold">{fmtDate(inv.due_date)}</span>
                </div>
              )}
              {inv.reference && (
                <div className="flex justify-between gap-6">
                  <span className="text-gray-400 font-medium">Reference</span>
                  <span className="font-semibold">{inv.reference}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lines */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="text-left px-4 py-3 rounded-l-lg font-semibold">Description</th>
              <th className="text-right px-4 py-3 font-semibold w-16">Qty</th>
              <th className="text-right px-4 py-3 font-semibold w-24">Unit Price</th>
              <th className="text-right px-4 py-3 font-semibold w-16">Disc%</th>
              <th className="text-right px-4 py-3 font-semibold w-20">Tax</th>
              <th className="text-right px-4 py-3 rounded-r-lg font-semibold w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.lines || []).map((l, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3">{l.description}</td>
                <td className="px-4 py-3 text-right">{l.quantity}</td>
                <td className="px-4 py-3 text-right">{fmt(l.unit_price)}</td>
                <td className="px-4 py-3 text-right">{l.discount_pct ? `${l.discount_pct}%` : '—'}</td>
                <td className="px-4 py-3 text-right">{l.tax_name || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between py-1"><span className="text-gray-500">Gross Amount</span><span>{fmt(inv.gross_amount)}</span></div>
            {Number(inv.discount) > 0 && <div className="flex justify-between py-1 text-red-500"><span>Discount</span><span>- {fmt(inv.discount)}</span></div>}
            {Number(inv.tax_amount) > 0 && <div className="flex justify-between py-1"><span className="text-gray-500">Tax</span><span>{fmt(inv.tax_amount)}</span></div>}
            <div className="flex justify-between bg-indigo-600 text-white rounded-lg px-4 py-3 font-bold text-base mt-2">
              <span>Total Due</span><span>{fmt(inv.net_amount)}</span>
            </div>
          </div>
        </div>

        {inv.notes && <p className="mt-8 text-sm text-gray-400 border-t pt-4">{inv.notes}</p>}
      </div>
    </div>
  );
}

// ── Template: Minimal ────────────────────────────────────────────────────────
function MinimalTemplate({ inv }: { inv: PrintInvoice }) {
  return (
    <div className="p-10 font-sans text-gray-800 bg-white min-h-[29.7cm]">
      <div className="flex justify-between items-start mb-12">
        <div>
          <p className="text-xl font-bold text-gray-900">Evotrade</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Invoice</p>
          <p className="text-2xl font-light text-gray-900">{inv.number}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8 mb-10 text-sm">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Billed To</p>
          <p className="font-medium">{inv.party_name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Issue Date</p>
          <p className="font-medium">{fmtDate(inv.date)}</p>
        </div>
        {inv.due_date && (
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Due Date</p>
            <p className="font-medium">{fmtDate(inv.due_date)}</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 mb-2" />
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="text-xs uppercase tracking-widest text-gray-400">
            <th className="text-left py-3">Description</th>
            <th className="text-right py-3 w-16">Qty</th>
            <th className="text-right py-3 w-24">Unit Price</th>
            <th className="text-right py-3 w-16">Disc%</th>
            <th className="text-right py-3 w-20">Tax</th>
            <th className="text-right py-3 w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(inv.lines || []).map((l, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="py-3">{l.description}</td>
              <td className="py-3 text-right text-gray-600">{l.quantity}</td>
              <td className="py-3 text-right text-gray-600">{fmt(l.unit_price)}</td>
              <td className="py-3 text-right text-gray-600">{l.discount_pct ? `${l.discount_pct}%` : '—'}</td>
              <td className="py-3 text-right text-gray-600">{l.tax_name || '—'}</td>
              <td className="py-3 text-right font-medium">{fmt(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-200 mb-4" />

      <div className="flex justify-end">
        <div className="w-56 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(inv.gross_amount)}</span></div>
          {Number(inv.discount) > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span>- {fmt(inv.discount)}</span></div>}
          {Number(inv.tax_amount) > 0 && <div className="flex justify-between text-gray-500"><span>Tax</span><span>{fmt(inv.tax_amount)}</span></div>}
          <div className="flex justify-between font-semibold text-base border-t border-gray-300 pt-2 mt-1">
            <span>Total</span><span>{fmt(inv.net_amount)}</span>
          </div>
        </div>
      </div>

      {inv.notes && <p className="mt-10 text-xs text-gray-400">{inv.notes}</p>}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
export default function InvoicePrintModal({ invoice, title = 'Invoice', onClose }: Props) {
  const [template, setTemplate] = useState<Template>('modern');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('invoicePrintTemplate') as Template | null;
    if (saved && TEMPLATES.some(t => t.value === saved)) setTemplate(saved);
  }, []);

  function handleTemplateChange(t: Template) {
    setTemplate(t);
    localStorage.setItem('invoicePrintTemplate', t);
  }

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title} - ${invoice?.number}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      @page { margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { margin: 0; }
  </style>
</head>
<body>
  ${content}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 400);
    };
  </script>
</body>
</html>`);
    win.document.close();
  }

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative m-auto flex flex-col bg-white shadow-2xl rounded-xl w-full max-w-4xl max-h-[95vh]">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-6 py-3 gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{title}</span>
            <span className="text-sm text-gray-400">{invoice.number}</span>
          </div>

          {/* Template selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {TEMPLATES.map(t => (
              <button
                key={t.value}
                onClick={() => handleTemplateChange(t.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  template === t.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1">&times;</button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <div ref={printRef} className="shadow-lg mx-auto" style={{ width: '210mm', minWidth: '600px' }}>
            {template === 'classic' && <ClassicTemplate inv={invoice} />}
            {template === 'modern'  && <ModernTemplate  inv={invoice} />}
            {template === 'minimal' && <MinimalTemplate inv={invoice} />}
          </div>
        </div>
      </div>
    </div>
  );
}
