import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Option { id: number; label: string; }

interface Props {
  options: Option[];
  value: string;
  onChange: (text: string) => void;
  onSelect: (opt: Option) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export default function ComboBox({ options, value, onChange, onSelect, placeholder = 'Type to search…', className = '', inputClassName = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o => o.label.toLowerCase().includes(value.toLowerCase())).slice(0, 60);

  function openDropdown() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        listRef.current  && !listRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width });
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => { window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 ${inputClassName}`}
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); openDropdown(); }}
        onFocus={openDropdown}
        autoComplete="off"
      />
      {open && filtered.length > 0 && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', top: pos.top - window.scrollY, left: pos.left, width: Math.max(pos.width, 240), zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-2xl max-h-56 overflow-y-auto"
        >
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(opt); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 border-b border-gray-50 last:border-0"
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
