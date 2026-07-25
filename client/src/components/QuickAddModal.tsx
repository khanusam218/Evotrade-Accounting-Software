import { useEffect, useRef, useState } from 'react';

interface Product {
  id: number;
  name: string;
  sale_price: number;
  sale_tax_id: number | null;
  sku?: string;
  barcode?: string;
  code?: string;
}

interface Tax { id: number; name: string; rate: number; }

interface AddedLine {
  product_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  amount: number;
  tax_id: number | null;
  tax_amount: number;
}

interface Props {
  products: Product[];
  taxes: Tax[];
  onAdd: (line: AddedLine) => void;
  onClose: () => void;
}

export default function QuickAddModal({ products, taxes, onAdd, onClose }: Props) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [added,   setAdded]   = useState<{ name: string; qty: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults([]); return; }
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q) ||
      (p.code ?? '').toLowerCase().includes(q)
    ).slice(0, 10);
    setResults(filtered);
  }, [query, products]);

  function addProduct(p: Product) {
    const price = Number(p.sale_price || 0);
    const tax = taxes.find(t => t.id === p.sale_tax_id);
    const taxAmt = tax ? price * tax.rate / 100 : 0;
    onAdd({
      product_id: p.id,
      description: p.name,
      quantity: 1,
      unit_price: price,
      discount_pct: 0,
      amount: price,
      tax_id: p.sale_tax_id,
      tax_amount: taxAmt,
    });
    setAdded(prev => [...prev, { name: p.name, qty: 1 }]);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length === 1) { addProduct(results[0]); return; }
      if (results.length > 1) {
        // exact name match
        const exact = results.find(p => p.name.toLowerCase() === query.trim().toLowerCase());
        if (exact) addProduct(exact);
      }
    }
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40">
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Quickly Add Products / Scan</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">Enter SKU, barcode, product code or name to search.</p>

          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            className="w-full rounded-md border-2 border-green-500 px-4 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            placeholder="Search products…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />

          {/* Hints */}
          <div className="space-y-0.5 text-xs text-blue-600">
            <p>Please scan barcode.</p>
            <p>Please type product SKU, product code or product name and press enter.</p>
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-white shadow-sm max-h-48 overflow-y-auto">
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-green-50 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-gray-800">{p.name}</span>
                  <span className="text-gray-500 font-mono text-xs ml-4">
                    PKR {Number(p.sale_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </button>
              ))}
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">No products found.</p>
          )}

          {/* Added products log */}
          {added.length > 0 && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-xs font-semibold text-green-700 mb-1">Added to line items:</p>
              <ul className="space-y-0.5">
                {added.map((a, i) => (
                  <li key={i} className="text-xs text-green-700">✓ {a.name} (qty: {a.qty})</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Done</button>
        </div>
      </div>
    </div>
  );
}
