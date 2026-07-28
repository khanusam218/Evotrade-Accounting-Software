import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  hasError?: boolean;
}

/** A text input that also offers a filtered, clickable list of known values
 * below it — types freely (so an unlisted value is never blocked) while
 * still letting the user pick from what already exists. */
export default function SearchSelect({ value, onChange, options, placeholder, hasError }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = options.filter(o => !query || o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center border rounded overflow-hidden ${hasError ? 'border-red-500' : 'border-gray-300'}`}>
        <input
          type="text"
          className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
          placeholder={placeholder}
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
        />
        <span className="px-2 text-gray-400 cursor-pointer shrink-0" onClick={() => setOpen(o => !o)}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <div key={o} className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
              onMouseDown={() => { onChange(o); setOpen(false); setQuery(''); }}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
