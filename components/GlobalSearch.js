'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ products: [], stores: [], staff: [], serials: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const searchRef = useRef(null);
  const overlayInputRef = useRef(null);

  // Toggle search on Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && overlayInputRef.current) {
      overlayInputRef.current.focus();
      setQuery('');
      setResults({ products: [], stores: [], staff: [], serials: [] });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Handle typing & query search api
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ products: [], stores: [], staff: [], serials: [] });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Flatten results for keyboard navigation
  const getFlatResults = () => {
    const flat = [];
    if (results.products?.length) results.products.forEach(p => flat.push({ type: 'product', id: p.id, name: p.name, desc: p.brand.name, hint: 'View product catalog' }));
    if (results.stores?.length) results.stores.forEach(s => flat.push({ type: 'store', id: s.id, name: s.name, desc: s.region, hint: 'Go to store details' }));
    if (results.staff?.length) results.staff.forEach(st => flat.push({ type: 'staff', id: st.id, name: st.name, desc: `Staff | ${st.shirtSize || 'No Size'}`, hint: 'View promoter profile' }));
    if (results.serials?.length) results.serials.forEach(sr => flat.push({ type: 'serial', id: sr.id, name: sr.barcode, desc: `Serial | ${sr.product.name}`, hint: 'Lookup barcode serial' }));
    return flat;
  };

  const flatResults = getFlatResults();

  const handleKeyDown = (e) => {
    if (flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigateToItem(flatResults[selectedIndex]);
    }
  };

  const navigateToItem = (item) => {
    setIsOpen(false);
    if (item.type === 'product') router.push(`/dashboard/products#${item.id}`);
    else if (item.type === 'store') router.push(`/dashboard/stores/${item.id}`);
    else if (item.type === 'staff') router.push(`/dashboard/staff/${item.id}`);
    else if (item.type === 'serial') router.push(`/dashboard/products/serials/${item.name}`);
  };

  return (
    <div ref={searchRef} className="w-full max-w-[380px] relative flex items-center">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center bg-surface border border-border rounded-[var(--radius-sm)] px-3.5 py-2.5 cursor-pointer text-left outline-none hover:border-primary/40 transition-colors h-10"
      >
        <Search size={16} className="text-text-secondary flex-shrink-0" />
        <span className="flex-1 text-sm text-text-secondary ml-2">Quick search...</span>
        <kbd className="text-xs bg-surface-elevated border border-border px-1.5 py-0.5 rounded text-text-secondary font-mono">Ctrl K</kbd>
      </button>

      {/* Dropdown below trigger */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-2 w-full min-w-[380px] max-w-[600px] bg-surface border border-border rounded-xl shadow-lg flex flex-col overflow-hidden z-[999] animate-slide-down"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Quick search"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={16} className="text-primary flex-shrink-0" />
            <input
              ref={overlayInputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted"
              placeholder="Search Barcode, Promoter, Store..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <kbd className="text-[10px] bg-surface-elevated border border-border px-1.5 py-0.5 rounded text-text-muted font-mono flex-shrink-0">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[350px] overflow-y-auto p-2">
            {loading && (
              <div className="text-center py-6 text-text-secondary text-sm">Searching database...</div>
            )}

            {!loading && query.trim().length >= 2 && flatResults.length === 0 && (
              <div className="text-center py-6 text-text-secondary text-sm">No matching records found.</div>
            )}

            {!loading && flatResults.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {flatResults.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => navigateToItem(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors border-l-[3px] text-left ${
                        isSelected
                          ? 'bg-surface-elevated border-l-primary'
                          : 'bg-transparent border-l-transparent hover:bg-surface-elevated/50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-text-secondary">{item.desc}</span>
                          {item.hint && <span className="text-[10px] text-text-muted">· {item.hint}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-border bg-surface-elevated ${
                        item.type === 'serial' ? 'text-success' : 'text-primary'
                      }`}>
                        {item.type.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {query.trim().length < 2 && (
              <div className="p-3 text-text-secondary text-sm flex flex-col gap-2">
                <p className="text-xs">Type 2 or more characters to search:</p>
                <ul className="flex flex-col gap-1">
                  <li className="text-xs"><strong>Virgin Barcode</strong> (e.g. SIM code)</li>
                  <li className="text-xs"><strong>Promoter Name</strong> (e.g. Sarah)</li>
                  <li className="text-xs"><strong>Store Outlet</strong> (e.g. Lulu Hypermarket)</li>
                  <li className="text-xs"><strong>Products</strong> (e.g. stands, shirts)</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
