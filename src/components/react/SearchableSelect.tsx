import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  label?: string;
  required?: boolean;
}

/**
 * Zero-dependency searchable select (combobox).
 * Renders a text input that filters a dropdown of options.
 * Clicking outside or selecting closes the dropdown.
 *
 * ponytail: O(n) filter per keystroke — fine for ≤500 options.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  emptyText = 'Tidak ada hasil',
  disabled = false,
  id,
  label,
  required,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) handleSelect(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger: selected value or placeholder */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-left text-sm outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200 ${
          disabled ? 'cursor-not-allowed bg-gray-50 text-gray-400' : 'text-paroki-900'
        } ${open ? 'border-paroki-400 ring-2 ring-paroki-200' : ''}`}
      >
        <span className={value ? '' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        {value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); handleSelect(''); }}
            className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Hapus pilihan"
          >
            <X className="h-4 w-4" />
          </span>
        ) : (
          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-paroki-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-paroki-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="relative border-b border-paroki-100">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-paroki-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
              placeholder="Ketik untuk mencari..."
              className="w-full border-0 py-2.5 pl-9 pr-3 text-sm text-paroki-900 outline-none placeholder:text-paroki-300"
            />
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-center text-sm text-paroki-400">{emptyText}</div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition ${
                    i === highlighted
                      ? 'bg-paroki-50 text-paroki-900'
                      : 'text-paroki-700 hover:bg-paroki-50/50'
                  } ${value === opt ? 'font-semibold text-paroki-800' : ''}`}
                >
                  <span className="min-w-0 flex-1">{opt}</span>
                  {value === opt && <Check className="h-4 w-4 flex-shrink-0 text-paroki-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Hidden label for accessibility when label prop is provided */}
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}{required ? ' (wajib)' : ''}
        </label>
      )}
    </div>
  );
}
