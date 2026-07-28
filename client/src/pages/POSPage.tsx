import { apiFetch } from '../api/apiFetch';
import { useEffect, useRef, useState } from 'react';
import { getSalesOrders, getSalesOrder } from '../api/salesOrders';
import type { SalesOrder } from '../types/salesOrder';
import { getOpenSession, openSession, closeSession, createTransaction, createCashMovement } from '../api/pos';
import type { POSSession, POSTransactionLine } from '../types/pos';

interface Product {
  id: number;
  name: string;
  code: string;
  sale_price: number;
  sale_tax_id?: number | null;
  image?: string | null;
  stock_qty?: number;
}

interface Tax {
  id: number;
  name: string;
  rate: number;
}

interface CartItem {
  product: Product;
  price: number;
  qty: number;
  disc: number;
}

type InvoiceTab = 'invoice1' | 'invoice2' | 'saleReturn';
type CartField  = 'price' | 'qty' | 'disc';

const TAB_LABELS: { key: InvoiceTab; label: string }[] = [
  { key: 'invoice1',   label: 'Invoice 1'   },
  { key: 'invoice2',   label: 'Invoice 2'   },
  { key: 'saleReturn', label: 'Sale Return' },
];

// 4-column grid: standard numpad order (7-8-9 top, 1-2-3 bottom)
// null = empty cell used for DEL to span 2 cols
const NUMPAD_GRID: (string | null)[][] = [
  ['C',  '7', '8', '9'     ],
  ['4',  '5', '6', 'SCHEME'],
  ['1',  '2', '3', 'ENT'   ],
  ['.',  '0', 'DEL', null  ],   // DEL spans cols 3-4
];

// ── SVG helpers ────────────────────────────────────────────────────────────────
function BackspaceSVG() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
    </svg>
  );
}

function GearSVG() {
  return (
    <div className="flex flex-col items-center pointer-events-none">
      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="text-[9px] text-gray-500 leading-tight">Check</span>
      <span className="text-[9px] text-gray-500 leading-tight">Scheme</span>
    </div>
  );
}

function EnterSVG() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h10a4 4 0 014 4v1M3 10l4-4M3 10l4 4" />
    </svg>
  );
}

function CameraPlaceholder() {
  return (
    <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center mb-2 pointer-events-none">
      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  );
}

// ── Counter Selection Screen ───────────────────────────────────────────────────
interface POSCounter { id: number; name: string; warehouse_name?: string; cash_account_name?: string; }

function CounterSelectScreen({ onSelect, checkingIn, error }: { onSelect: (c: POSCounter) => void; checkingIn: boolean; error: string }) {
  const [counters,  setCounters]  = useState<POSCounter[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState<POSCounter | null>(null);
  const [open,      setOpen]      = useState(false);

  useEffect(() => {
    apiFetch('/api/pos-counters')
      .then(r => r.json())
      .then(d => { setCounters(Array.isArray(d) ? d : (d?.data ?? [])); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = counters.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="flex-1 p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">

          {/* Title + description */}
          <h2 className="text-base font-bold text-gray-900 mb-1">Select Checkout Counter</h2>
          <p className="text-sm text-gray-600 mb-8 max-w-4xl">
            A Checkout Counter is a workstation/location that is used by a single operator at POS in Splendid Accounts
            (like a Physical Cash Register). The Checkout Counter can be checked in by only one user at a time.
          </p>

          {/* Two-column: dropdown left, image right */}
          <div className="flex items-start gap-8">

            {/* Left: combobox dropdown */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpen(o => !o)}
                  className="w-full flex items-center justify-between border border-gray-300 rounded px-3 py-2.5 text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
                    {selected ? selected.name : 'Type To Search Checkout Counter'}
                  </span>
                  <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {open && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded shadow-lg z-20">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        autoFocus
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="Search…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {loading ? (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">Loading…</div>
                      ) : filtered.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-400 text-center">
                          {counters.length === 0
                            ? 'No counters found. Add one in POS → Checkout Counter.'
                            : 'No results found.'}
                        </div>
                      ) : filtered.map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={() => { setSelected(c); setOpen(false); setSearch(''); }}
                          className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-green-50 border-b border-gray-50 last:border-0">
                          {c.name}
                          {(c.warehouse_name || c.cash_account_name) && (
                            <span className="text-xs text-gray-400 ml-2">
                              {[c.warehouse_name, c.cash_account_name].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: POS counter image */}
            <div className="flex-shrink-0">
              <svg viewBox="0 0 280 210" className="w-72 h-52 rounded" xmlns="http://www.w3.org/2000/svg">
                {/* Store background */}
                <rect width="280" height="210" fill="#8B6914" />
                <rect width="280" height="210" fill="url(#wood)" opacity="0.3" />
                {/* Floor */}
                <rect y="150" width="280" height="60" fill="#6B4F12" />
                {/* Counter/desk */}
                <rect x="30" y="120" width="220" height="50" rx="4" fill="#D4A84B" />
                <rect x="30" y="118" width="220" height="8" rx="2" fill="#E8C570" />
                {/* Monitor */}
                <rect x="80" y="55" width="120" height="75" rx="4" fill="#1a1a2e" />
                <rect x="84" y="59" width="112" height="67" rx="2" fill="#16213e" />
                <rect x="86" y="61" width="108" height="63" rx="1" fill="#0f3460" />
                {/* Screen content */}
                <rect x="90" y="65" width="40" height="5" rx="1" fill="#e94560" opacity="0.8" />
                <rect x="90" y="74" width="70" height="3" rx="1" fill="white" opacity="0.4" />
                <rect x="90" y="80" width="60" height="3" rx="1" fill="white" opacity="0.3" />
                <rect x="90" y="86" width="65" height="3" rx="1" fill="white" opacity="0.3" />
                <rect x="148" y="92" width="38" height="22" rx="2" fill="#e94560" />
                {/* Monitor stand */}
                <rect x="133" y="130" width="14" height="10" rx="1" fill="#333" />
                <rect x="123" y="138" width="34" height="4" rx="2" fill="#444" />
                {/* Keyboard */}
                <rect x="75" y="145" width="90" height="14" rx="2" fill="#ccc" />
                <rect x="78" y="148" width="84" height="8" rx="1" fill="#bbb" />
                {[0,1,2,3,4,5,6,7,8].map(i => (
                  <rect key={i} x={80 + i*9} y={149} width="7" height="3" rx="0.5" fill="#aaa" />
                ))}
                {/* Cash drawer */}
                <rect x="175" y="130" width="55" height="35" rx="3" fill="#888" />
                <rect x="178" y="133" width="49" height="29" rx="2" fill="#999" />
                <rect x="195" y="148" width="15" height="4" rx="2" fill="#666" />
                {/* Receipt printer */}
                <rect x="55" y="128" width="40" height="25" rx="3" fill="#555" />
                <rect x="58" y="131" width="34" height="6" rx="1" fill="#444" />
                <rect x="66" y="125" width="16" height="6" rx="0" fill="white" opacity="0.9" />
                {/* Shelves in background */}
                <rect x="0" y="20" width="15" height="100" fill="#5a3e1b" />
                <rect x="265" y="20" width="15" height="100" fill="#5a3e1b" />
                {[30,50,70,90].map(y => (
                  <rect key={y} x="0" y={y} width="15" height="3" fill="#8B6914" />
                ))}
                {[30,50,70,90].map(y => (
                  <rect key={y} x="265" y={y} width="15" height="3" fill="#8B6914" />
                ))}
                <defs>
                  <pattern id="wood" patternUnits="userSpaceOnUse" width="40" height="40">
                    <line x1="0" y1="20" x2="40" y2="20" stroke="#000" strokeWidth="0.5" opacity="0.1" />
                  </pattern>
                </defs>
              </svg>
            </div>
          </div>

          {/* Divider */}
          <hr className="my-6 border-gray-200" />

          {/* Footer: CHECK IN button */}
          <div className="flex flex-col items-end gap-2">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              disabled={!selected || checkingIn}
              onClick={() => selected && onSelect(selected)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold transition-colors ${
                selected && !checkingIn
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {checkingIn ? 'CHECKING IN…' : 'CHECK IN'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Funds Transfer Modal ───────────────────────────────────────────────────────
interface FTForm { transferType: 'cashout'|'cashin'|''; fromAccount: string; toAccount: string; amount: string; comments: string; username: string; password: string; }
const emptyFT = (): FTForm => ({ transferType: '', fromAccount: '', toAccount: '', amount: '', comments: '', username: '', password: '' });

function FundsTransferModal({ counterName, sessionId, onClose, onTransferred }: {
  counterName: string; sessionId: number | null; onClose: () => void; onTransferred: () => void;
}) {
  const [form, setForm] = useState<FTForm>(emptyFT());
  const [accounts, setAccounts] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p: Partial<FTForm>) => setForm(f => ({ ...f, ...p }));
  useEffect(() => {
    apiFetch('/api/chart-of-accounts/lookup').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  const isValid = form.transferType && form.fromAccount && form.toAccount && Number(form.amount) > 0;

  async function handleTransfer() {
    if (!isValid) return;
    if (!sessionId) { setError('No open POS session — check in to a counter first.'); return; }
    setSaving(true); setError('');
    try {
      await createCashMovement({
        session_id: sessionId,
        movement_type: form.transferType === 'cashin' ? 'cash_in' : 'cash_out',
        from_account_id: Number(form.fromAccount),
        to_account_id: Number(form.toAccount),
        amount: Number(form.amount),
        comments: form.comments || undefined,
      });
      onTransferred();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-800">Funds Transfer - [{counterName}]</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Transfer Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Type <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ft-type" checked={form.transferType === 'cashout'} onChange={() => set({ transferType: 'cashout' })} className="h-4 w-4 accent-green-600" />
                <span className="text-sm text-gray-700">Cash Out</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ft-type" checked={form.transferType === 'cashin'} onChange={() => set({ transferType: 'cashin' })} className="h-4 w-4 accent-green-600" />
                <span className="text-sm text-gray-700">Cash In</span>
              </label>
            </div>
          </div>
          {/* From Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Account <span className="text-red-500">*</span></label>
            <select value={form.fromAccount} onChange={e => set({ fromAccount: e.target.value })}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white ${!form.fromAccount ? 'border-red-400' : 'border-gray-300'}`}>
              <option value="">Type to search account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {/* To Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Account <span className="text-red-500">*</span></label>
            <select value={form.toAccount} onChange={e => set({ toAccount: e.target.value })}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white ${!form.toAccount ? 'border-red-400' : 'border-gray-300'}`}>
              <option value="">Type to search account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (PKR) <span className="text-red-500">*</span></label>
            <input type="number" placeholder="Amount" value={form.amount} onChange={e => set({ amount: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
          </div>
          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea rows={3} placeholder="Comments" value={form.comments} onChange={e => set({ comments: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none" />
          </div>
          {/* Attachments */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Attachments</label>
            <div className="border-2 border-dashed border-gray-300 rounded p-4 flex items-center gap-4">
              <span className="text-xs text-gray-400 flex-1">Drop files here or.</span>
              <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">BROWSE FILES</button>
            </div>
          </div>
          {/* Auth */}
          <div className="pt-1">
            <p className="text-sm text-gray-600">Please enter credentials to authorize this transaction.</p>
            <p className="text-xs text-gray-500 italic">(Note: Leave it blank if you are an authorized person.)</p>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" value={form.username} onChange={e => set({ username: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password:</label>
                <input type="password" value={form.password} onChange={e => set({ password: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
            </div>
          </div>
        </div>
        {error && <div className="mx-6 mb-2 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button type="button" disabled={!isValid || saving} onClick={handleTransfer}
            className={`px-5 py-2 rounded text-sm font-semibold ${isValid && !saving ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            {saving ? 'TRANSFERRING…' : 'TRANSFER'}
          </button>
          <button type="button" onClick={onClose} className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2 rounded text-sm font-semibold">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ── Checkout Summary Modal ─────────────────────────────────────────────────────
interface CheckoutSummaryModalProps {
  counterName: string;
  mode: 'sale' | 'closeout';
  sessionId: number | null;
  cartSubtotal: number;
  cartDiscount: number;
  cartTax: number;
  cartTotal: number;
  onClose: () => void;
  onSaleConfirmed?: () => void;
  onSessionClosed?: () => void;
  buildLines?: () => POSTransactionLine[];
}

function CheckoutSummaryModal({
  counterName, mode, sessionId, cartSubtotal, cartDiscount, cartTax, cartTotal,
  onClose, onSaleConfirmed, onSessionClosed, buildLines,
}: CheckoutSummaryModalProps) {
  const [fields, setFields] = useState({
    openingCash: '0', cashAmount: mode === 'sale' ? cartTotal.toFixed(2) : '0', cardAmount: '0', bankTransfer: '0', creditSale: '0',
    cashIn: '0', cashOut: '0', refund: '0', sales: '0', salesReturn: '0', cnSrGv: '0', closingCash: '0', counted: '0', comments: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (p: Partial<typeof fields>) => setFields(f => ({ ...f, ...p }));
  const closingTotal = (Number(fields.closingCash) + Number(fields.cardAmount) + Number(fields.bankTransfer)).toFixed(2);
  const difference   = (Number(fields.counted) - Number(closingTotal)).toFixed(2);
  const tenderedTotal = Number(fields.cashAmount) + Number(fields.cardAmount) + Number(fields.bankTransfer) + Number(fields.creditSale);
  const inp = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500';
  const lbl = 'block text-sm text-gray-700 mb-1';

  async function handleConfirm() {
    setError('');
    if (mode === 'sale') {
      if (!sessionId) { setError('No open POS session — check in to a counter first.'); return; }
      if (!buildLines || buildLines().length === 0) { setError('Cart is empty.'); return; }
      if (tenderedTotal < cartTotal) { setError('Tendered amount is less than the sale total.'); return; }
      const paymentMode = Number(fields.cardAmount) > 0 ? 'card' : Number(fields.bankTransfer) > 0 ? 'bank' : Number(fields.creditSale) > 0 ? 'credit' : 'cash';
      setSaving(true);
      try {
        await createTransaction({
          session_id: sessionId,
          subtotal: cartSubtotal,
          tax_total: cartTax,
          discount: cartDiscount,
          total: cartTotal,
          paid_amount: tenderedTotal,
          change_amount: Math.max(0, tenderedTotal - cartTotal),
          payment_mode: paymentMode,
          lines: buildLines(),
        });
        onSaleConfirmed?.();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Checkout failed');
      } finally { setSaving(false); }
    } else {
      if (!sessionId) { setError('No open POS session to close.'); return; }
      setSaving(true);
      try {
        await closeSession(sessionId, { closing_balance: Number(closingTotal) });
        onSessionClosed?.();
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Checkout failed');
      } finally { setSaving(false); }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-gray-800">Checkout Summary ({counterName})</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lbl}>Opening Cash</label><input className={inp} value={fields.openingCash} onChange={e => set({ openingCash: e.target.value })} /></div>
            <div><label className={lbl}>Cash Amount</label><input className={inp} value={fields.cashAmount} onChange={e => set({ cashAmount: e.target.value })} /></div>
            <div><label className={lbl}>Card Amount</label><input className={inp} value={fields.cardAmount} onChange={e => set({ cardAmount: e.target.value })} /></div>
          </div>
          {/* Row 2 */}
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lbl}>Bank Transfer Amount</label><input className={inp} value={fields.bankTransfer} onChange={e => set({ bankTransfer: e.target.value })} /></div>
            <div><label className={lbl}>Credit Sale</label><input className={inp} value={fields.creditSale} onChange={e => set({ creditSale: e.target.value })} /></div>
            <div><label className={lbl}>Cash In</label><input className={inp} value={fields.cashIn} onChange={e => set({ cashIn: e.target.value })} /></div>
          </div>
          {/* Row 3 */}
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lbl}>Cash Out</label><input className={inp} value={fields.cashOut} onChange={e => set({ cashOut: e.target.value })} /></div>
            <div><label className={lbl}>Refund</label><input className={inp} value={fields.refund} onChange={e => set({ refund: e.target.value })} /></div>
            <div><label className={lbl}>Sales</label><input className={inp} value={fields.sales} onChange={e => set({ sales: e.target.value })} /></div>
          </div>
          {/* Row 4 */}
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lbl}>Sales Return</label><input className={inp} value={fields.salesReturn} onChange={e => set({ salesReturn: e.target.value })} /></div>
            <div><label className={lbl}>C.N / S.R / G.V</label><input className={inp} value={fields.cnSrGv} onChange={e => set({ cnSrGv: e.target.value })} /></div>
            <div><label className={lbl}>Closing Cash</label><input className={inp} value={fields.closingCash} onChange={e => set({ closingCash: e.target.value })} /></div>
          </div>
          {/* Closing total */}
          <div>
            <label className={lbl}>Closing Cash + Card Slips + Bank Transfer</label>
            <input className={inp} readOnly value={closingTotal} />
          </div>
          <hr className="border-dashed border-gray-300" />
          {/* Counted + Difference */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Counted (Cash + Card Slips + Bank Transfer)</label><input className={inp} value={fields.counted} onChange={e => set({ counted: e.target.value })} /></div>
            <div><label className={lbl}>Difference</label><input className={inp} readOnly value={difference} /></div>
          </div>
          {/* Comments */}
          <div>
            <label className={lbl}>Comments</label>
            <textarea rows={3} placeholder="Comments" value={fields.comments} onChange={e => set({ comments: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 resize-none" />
          </div>
        </div>
        {error && <div className="mx-6 mb-2 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}
        <div className="px-6 py-4 border-t flex justify-end gap-3 shrink-0">
          <button type="button" disabled={saving} onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold disabled:opacity-50">
            {saving ? 'PROCESSING…' : 'CONFIRM & CHECKOUT'}
          </button>
          <button type="button" onClick={onClose} className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2 rounded text-sm font-semibold">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ── Main POS Page ──────────────────────────────────────────────────────────────
export default function POSPage() {
  const [counter,         setCounter]         = useState<POSCounter | null>(null);
  const [session,         setSession]         = useState<POSSession | null>(null);
  const [checkingIn,      setCheckingIn]      = useState(false);
  const [checkInError,    setCheckInError]    = useState('');
  const [activeTab,       setActiveTab]       = useState<InvoiceTab>('invoice1');
  const [cartItems,       setCartItems]       = useState<CartItem[]>([]);
  const [products,        setProducts]        = useState<Product[]>([]);
  const [taxes,           setTaxes]           = useState<Tax[]>([]);
  const [searchProduct,   setSearchProduct]   = useState('');
  const [searchOrder,     setSearchOrder]     = useState('');
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [selectedField,   setSelectedField]   = useState<CartField>('qty');
  const [numpadBuffer,    setNumpadBuffer]    = useState('');
  const [showMenu,        setShowMenu]        = useState(false);
  const [showFundsTransfer, setShowFundsTransfer] = useState(false);
  const [showCheckout,    setShowCheckout]    = useState(false);
  const [checkoutMode,    setCheckoutMode]    = useState<'sale' | 'closeout'>('sale');
  const [showShortcuts,   setShowShortcuts]   = useState(false);
  const [orderResults,    setOrderResults]    = useState<SalesOrder[]>([]);
  const [showOrderResults, setShowOrderResults] = useState(false);
  const [orderSearching,  setOrderSearching]  = useState(false);
  const orderSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOrderResults) return;
    function h(e: MouseEvent) { if (orderSearchRef.current && !orderSearchRef.current.contains(e.target as Node)) setShowOrderResults(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showOrderResults]);

  useEffect(() => {
    apiFetch('/api/products?limit=200')
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => {});
    apiFetch('/api/taxes?applies_to=sales')
      .then(r => r.json())
      .then(d => setTaxes(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function handleCheckIn(c: POSCounter) {
    setCheckingIn(true); setCheckInError('');
    try {
      const open = await getOpenSession();
      const sess = (open && open.counter_id === c.id)
        ? open
        : await openSession({ opening_balance: 0, counter_id: c.id });
      setSession(sess);
      setCounter(c);
    } catch (err: unknown) {
      setCheckInError(err instanceof Error ? err.message : 'Failed to open a POS session');
    } finally { setCheckingIn(false); }
  }

  // Show counter selection until a counter is chosen
  if (!counter) return (
    <CounterSelectScreen onSelect={handleCheckIn} checkingIn={checkingIn} error={checkInError} />
  );

  const filteredProducts = products.filter(p =>
    !searchProduct ||
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    (p.code ?? '').toLowerCase().includes(searchProduct.toLowerCase())
  );

  // Cart calculations
  const gross     = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const totalDisc = cartItems.reduce((s, i) => s + i.price * i.qty * i.disc / 100, 0);
  const taxRateFor = (productTaxId?: number | null) => taxes.find(t => t.id === productTaxId)?.rate ?? 0;
  const totalTax  = cartItems.reduce((s, i) => {
    const net = i.price * i.qty * (1 - i.disc / 100);
    return s + net * (taxRateFor(i.product.sale_tax_id) / 100);
  }, 0);
  const total     = gross - totalDisc + totalTax;
  const totalQty  = cartItems.reduce((s, i) => s + i.qty, 0);

  function buildTransactionLines(): POSTransactionLine[] {
    return cartItems.map(i => {
      const net = i.price * i.qty * (1 - i.disc / 100);
      const rate = taxRateFor(i.product.sale_tax_id);
      return {
        product_id: i.product.id,
        description: i.product.name,
        quantity: i.qty,
        unit_price: i.price,
        discount_pct: i.disc,
        tax_id: i.product.sale_tax_id ?? null,
        tax_amount: net * (rate / 100),
        amount: net,
      };
    });
  }

  async function searchOrders() {
    if (!searchOrder.trim()) { setOrderResults([]); setShowOrderResults(false); return; }
    setOrderSearching(true);
    try {
      const results = await getSalesOrders({ search: searchOrder.trim() });
      setOrderResults(results);
      setShowOrderResults(true);
    } catch { setOrderResults([]); }
    finally { setOrderSearching(false); }
  }

  async function loadOrderIntoCart(order: SalesOrder) {
    setShowOrderResults(false);
    const full = await getSalesOrder(order.id);
    const newItems: CartItem[] = (full.lines || [])
      .filter(l => l.product_id)
      .map(l => {
        const prod = products.find(p => p.id === l.product_id) ||
          { id: l.product_id as number, name: l.product_name || 'Product', code: '', sale_price: l.unit_price };
        return { product: prod, price: Number(l.unit_price), qty: Number(l.quantity), disc: Number(l.discount_pct || 0) };
      });
    setCartItems(newItems);
    setSelectedItemIdx(newItems.length ? 0 : null);
    setNumpadBuffer('');
    setSearchOrder('');
  }

  function addToCart(product: Product) {
    setCartItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      // Number() ensures string prices from API don't break .toFixed()
      return [...prev, { product, price: Number(product.sale_price), qty: 1, disc: 0 }];
    });
    // Auto-select the newly added / incremented row
    setNumpadBuffer('');
    setTimeout(() => {
      setSelectedItemIdx(_ => {
        const idx = cartItems.findIndex(i => i.product.id === product.id);
        return idx >= 0 ? idx : cartItems.length;
      });
    }, 0);
  }

  function switchField(field: CartField) {
    setSelectedField(field);
    if (selectedItemIdx !== null && cartItems[selectedItemIdx]) {
      setNumpadBuffer(String(cartItems[selectedItemIdx][field]));
    }
  }

  function handleNumpad(key: string) {
    // C always clears cart regardless of selection
    if (key === 'C') {
      setCartItems([]);
      setSelectedItemIdx(null);
      setNumpadBuffer('');
      return;
    }

    if (key === 'SCHEME' || key === 'ENT') {
      setNumpadBuffer('');
      return;
    }

    if (selectedItemIdx === null) return;

    let buf = numpadBuffer;

    if (key === 'DEL') {
      buf = buf.slice(0, -1);
    } else if (key === '.') {
      if (!buf.includes('.')) buf += '.';
    } else {
      buf += key;
    }

    setNumpadBuffer(buf);

    const val = buf === '' ? 0 : (parseFloat(buf) || 0);

    setCartItems(prev => prev.map((item, idx) => {
      if (idx !== selectedItemIdx) return item;
      if (selectedField === 'qty')   return { ...item, qty:   Math.max(1, Math.round(val)) };
      if (selectedField === 'price') return { ...item, price: Math.max(0, val) };
      if (selectedField === 'disc')  return { ...item, disc:  Math.min(100, Math.max(0, val)) };
      return item;
    }));
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  function renderKey(key: string) {
    if (key === 'ENT')    return <EnterSVG />;
    if (key === 'DEL')    return <BackspaceSVG />;
    if (key === 'SCHEME') return <GearSVG />;
    if (key === 'C')      return <span className="text-gray-700 font-medium text-sm">C</span>;
    return <span className="text-gray-700 font-medium text-sm">{key}</span>;
  }

  // Highlight for active field header
  function fieldCls(field: CartField) {
    return `px-3 py-2.5 text-center font-semibold text-sm cursor-pointer select-none transition-colors ${
      selectedField === field ? 'text-green-600 underline' : 'text-gray-700 hover:text-green-500'
    }`;
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>

      {/* ── Top bar: invoice tabs + date ─────────────────────────────────────── */}
      <div className="flex items-center border-b bg-white px-4 py-2 gap-2 shrink-0">
        {TAB_LABELS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-1.5 text-sm font-medium rounded border transition-colors ${
              activeTab === t.key
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">{today}</span>
          {/* User menu button */}
          <div className="relative">
            <button onClick={() => setShowMenu(m => !m)}
              className="flex items-center gap-2 border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-50">
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span className="font-medium text-gray-700">Menu</span>
              <svg className="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border-2 border-green-500 rounded-lg shadow-xl z-30">
                <div className="py-1">
                  <button onClick={() => { setActiveTab('invoice1'); setSearchOrder(''); setSearchProduct(''); setShowOrderResults(false); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    Home
                  </button>
                  <button onClick={() => { setCounter(null); setSession(null); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back
                  </button>
                  <button onClick={() => { setShowShortcuts(true); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Shortcut Keys
                  </button>
                  <button onClick={() => { setShowFundsTransfer(true); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    Funds Transfer
                  </button>
                  <button onClick={() => { setCheckoutMode('closeout'); setShowCheckout(true); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Checkout ({counter.name})
                  </button>
                </div>
                <div className="p-3 border-t">
                  <button onClick={() => { setCounter(null); setSession(null); setShowMenu(false); }}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    LOGOUT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showFundsTransfer && (
        <FundsTransferModal
          counterName={counter.name}
          sessionId={session?.id ?? null}
          onClose={() => setShowFundsTransfer(false)}
          onTransferred={() => {}}
        />
      )}
      {showCheckout && (
        <CheckoutSummaryModal
          counterName={counter.name}
          mode={checkoutMode}
          sessionId={session?.id ?? null}
          cartSubtotal={gross - totalDisc}
          cartDiscount={totalDisc}
          cartTax={totalTax}
          cartTotal={total}
          buildLines={buildTransactionLines}
          onClose={() => setShowCheckout(false)}
          onSaleConfirmed={() => {
            setCartItems([]); setSelectedItemIdx(null); setNumpadBuffer('');
          }}
          onSessionClosed={() => { setCounter(null); setSession(null); }}
        />
      )}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Shortcut Keys</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-2 text-sm">
              {[
                ['Click a product', 'Add it to the cart'],
                ['Click a cart row', 'Select it for editing'],
                ['Click Price / Qty / Disc header', 'Choose which field the number pad edits'],
                ['Number pad digits', 'Type a new value for the selected field'],
                ['C', 'Clear the entire cart'],
                ['⌫ (DEL)', 'Remove the last typed digit'],
                ['Payment', 'Open checkout / payment'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="font-medium text-gray-700">{k}</span>
                  <span className="text-gray-500">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL: cart + summary + numpad ─────────────────────────────── */}
        <div className="flex flex-col border-r bg-white" style={{ width: '42%' }}>

          {/* Cart table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 text-sm">Item</th>
                  <th
                    className={fieldCls('price')}
                    onClick={() => switchField('price')}
                  >Price</th>
                  <th
                    className={fieldCls('qty')}
                    onClick={() => switchField('qty')}
                  >Qty</th>
                  <th
                    className={fieldCls('disc')}
                    onClick={() => switchField('disc')}
                  >Disc</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700 text-sm">Total</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`border-b cursor-pointer transition-colors ${
                      selectedItemIdx === idx ? 'bg-green-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => { setSelectedItemIdx(idx); setNumpadBuffer(String(item[selectedField])); }}
                  >
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-500 truncate max-w-[90px]">{item.product.name}</div>
                    </td>
                    <td className="px-3 py-2 text-center text-sm">{item.price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-sm">{item.qty}</td>
                    <td className="px-3 py-2 text-center text-sm">{item.disc}%</td>
                    <td className="px-3 py-2 text-right text-sm">
                      {(item.price * item.qty * (1 - item.disc / 100)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary bar */}
          <div className="border-t px-3 py-2 bg-white shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <button
                  onClick={() => { setCartItems([]); setSelectedItemIdx(null); setNumpadBuffer(''); }}
                  className="flex items-center gap-1 border border-gray-300 rounded px-3 py-1 text-xs font-medium hover:bg-gray-50 mb-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  CLEAR ALL
                </button>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div><span className="font-medium">Line Item Discount:</span> 0.00</div>
                  <div><span className="font-medium">No Of Products:</span> {cartItems.length}</div>
                  <div><span className="font-medium">No Of Items Sold:</span> {totalQty}</div>
                </div>
              </div>
              <div className="text-right text-xs text-gray-600 space-y-0.5">
                <div><span className="font-medium">Gross:</span> {gross.toFixed(2)}</div>
                <div><span className="font-medium">Tax:</span> {totalTax.toFixed(2)}</div>
                <div><span className="font-medium">Discount:</span> {totalDisc.toFixed(2)}</div>
                <div className="text-sm mt-0.5">
                  <span className="font-semibold text-gray-700">Total:</span>{' '}
                  <span className="font-bold text-green-500">{total.toFixed(2)} (PKR)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Numpad — 4-column CSS grid */}
          <div className="border-t bg-white shrink-0">
            <div className="flex">
              {/* Payment button */}
              <div onClick={() => { if (cartItems.length === 0) return; setCheckoutMode('sale'); setShowCheckout(true); }}
                className={`flex flex-col items-center justify-center border-r px-4 py-3 select-none ${cartItems.length === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700 mt-1">Payment</span>
              </div>

              {/* 4-column grid */}
              <div className="flex-1 grid grid-cols-4">
                {NUMPAD_GRID.map((row, ri) =>
                  row.map((key, ci) => {
                    // null = empty placeholder so DEL spans col 3-4
                    if (key === null) return null;
                    const isDelKey = key === 'DEL';
                    return (
                      <button
                        key={`${ri}-${ci}`}
                        onClick={() => handleNumpad(key)}
                        className={`h-12 flex items-center justify-center border-r border-b last:border-r-0 hover:bg-gray-100 active:bg-gray-200 transition-colors ${
                          isDelKey ? 'col-span-2' : ''
                        }`}
                      >
                        {renderKey(key)}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: search + product grid ──────────────────────────────── */}
        <div className="flex flex-col flex-1 bg-gray-50 min-h-0">

          {/* Breadcrumb + search */}
          <div className="bg-white border-b px-4 pt-3 pb-3 shrink-0">
            <div className="text-sm text-green-600 mb-2 cursor-pointer"
              onClick={() => { setActiveTab('invoice1'); setSearchOrder(''); setSearchProduct(''); setShowOrderResults(false); }}>
              Home
            </div>
            <div className="flex items-center gap-3">
              {/* Search Order */}
              <div className="relative flex-1" ref={orderSearchRef}>
                <div className="flex rounded overflow-hidden border border-gray-300">
                  <input
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none min-w-0"
                    placeholder="Search Order"
                    value={searchOrder}
                    onChange={e => setSearchOrder(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchOrders()}
                  />
                  <button onClick={searchOrders} className="bg-green-500 hover:bg-green-600 px-3 text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
                {showOrderResults && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 max-h-64 overflow-y-auto">
                    {orderSearching ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                    ) : orderResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">No orders found</div>
                    ) : orderResults.map(o => (
                      <button key={o.id} type="button" onClick={() => loadOrderIntoCart(o)}
                        className="w-full text-left px-4 py-2 hover:bg-green-50 border-b border-gray-100 last:border-0">
                        <div className="text-sm font-medium text-gray-800">{o.number}</div>
                        <div className="text-xs text-gray-500">{o.customer_name} · {o.date?.slice(0, 10)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Search Product */}
              <div className="flex flex-1 rounded overflow-hidden border border-gray-300">
                <input
                  className="flex-1 px-3 py-1.5 text-sm focus:outline-none"
                  placeholder="Search Product"
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                />
                <button className="bg-green-500 hover:bg-green-600 px-3 text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">No products found</p>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-green-400 hover:shadow-sm transition-all"
                  >
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-20 object-cover rounded mb-2" />
                    ) : (
                      <CameraPlaceholder />
                    )}
                    <p className="text-xs font-mono text-gray-600">{p.code}</p>
                    {p.stock_qty !== undefined && (
                      <p className="text-xs text-gray-500">{p.stock_qty}</p>
                    )}
                    <p className="text-sm font-bold text-gray-900 mt-0.5">
                      PKR {Number(p.sale_price).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

