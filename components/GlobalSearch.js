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

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && overlayInputRef.current) {
      overlayInputRef.current.focus();
      setQuery('');
      setResults({ products: [], stores: [], staff: [], serials: [] });
    }
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
    if (results.products?.length) results.products.forEach(p => flat.push({ type: 'product', id: p.id, name: p.name, desc: p.brand.name }));
    if (results.stores?.length) results.stores.forEach(s => flat.push({ type: 'store', id: s.id, name: s.name, desc: s.region }));
    if (results.staff?.length) results.staff.forEach(st => flat.push({ type: 'staff', id: st.id, name: st.name, desc: `Staff | ${st.shirtSize || 'No Size'}` }));
    if (results.serials?.length) results.serials.forEach(sr => flat.push({ type: 'serial', id: sr.id, name: sr.barcode, desc: `Serial | ${sr.product.name}` }));
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
    <div ref={searchRef} style={styles.searchWrapper}>
      {/* Trigger Button */}
      <button onClick={() => setIsOpen(true)} style={styles.triggerButton}>
        <Search size={16} style={{ color: 'var(--text-secondary)' }} />
        <span style={styles.triggerText}>Quick search...</span>
        <kbd style={styles.shortcut}>Ctrl K</kbd>
      </button>

      {/* Backdrop Overlay Modal */}
      {isOpen && (
        <div style={styles.overlay} onClick={() => setIsOpen(false)}>
          <div 
            className="glass-panel" 
            style={styles.modal} 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Quick search"
          >
            <div style={styles.inputContainer}>
              <Search size={20} style={{ color: 'var(--accent-primary)' }} />
              <input
                ref={overlayInputRef}
                type="text"
                style={styles.overlayInput}
                placeholder="Search Barcode, Promoter, Store..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ESC to exit</span>
            </div>

            <div style={styles.resultsContainer}>
              {loading && <div style={styles.status}>Searching database...</div>}
              
              {!loading && query.trim().length >= 2 && flatResults.length === 0 && (
                <div style={styles.status}>No matching records found.</div>
              )}

              {!loading && flatResults.length > 0 && (
                <div style={styles.list}>
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
                        style={{
                          ...styles.item,
                          width: '100%',
                          border: 'none',
                          background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                          paddingLeft: 'calc(1rem - 3px)',
                          ...(isSelected ? {} : {})
                        }}
                      >
                        <div style={styles.itemMeta}>
                          <span style={styles.itemName}>{item.name}</span>
                          <span style={styles.itemDesc}>{item.desc}</span>
                        </div>
                        <span style={{
                          ...styles.typeBadge,
                          color: item.type === 'serial' ? 'var(--color-success)' : 'var(--accent-primary)'
                        }}>
                          {item.type.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {query.trim().length < 2 && (
                <div style={styles.help}>
                  <p>Type 2 or more characters to search:</p>
                  <ul>
                    <li><strong>Virgin Barcode</strong> (e.g. SIM code)</li>
                    <li><strong>Promoter Name</strong> (e.g. Sarah)</li>
                    <li><strong>Store Outlet</strong> (e.g. Lulu Hypermarket)</li>
                    <li><strong>Products</strong> (e.g. stands, shirts)</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  searchWrapper: {
    width: '100%',
    maxWidth: '380px',
    position: 'relative',
  },
  triggerButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.85rem',
    cursor: 'pointer',
    textAlign: 'left',
    outline: 'none',
    transition: 'border-color var(--transition-fast)',
  },
  triggerText: {
    flex: 1,
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    marginLeft: '0.5rem',
  },
  shortcut: {
    fontSize: '0.75rem',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid var(--border-color)',
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(5, 6, 10, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '10vh',
    zIndex: 9999,
  },
  modal: {
    width: '100%',
    maxWidth: '600px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
    background: 'rgba(18, 22, 33, 0.95)',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
  },
  overlayInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: '1.1rem',
  },
  resultsContainer: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '1rem',
  },
  status: {
    textAlign: 'center',
    padding: '2rem',
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 1rem',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)',
  },
  selectedItem: {
    background: 'rgba(255, 255, 255, 0.04)',
    borderLeft: '3px solid var(--accent-primary)',
    paddingLeft: 'calc(1rem - 3px)',
  },
  itemMeta: {
    display: 'flex',
    flexDirection: 'column',
  },
  itemName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  itemDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginTop: '0.15rem',
  },
  typeBadge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-color)',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
  },
  help: {
    padding: '1rem',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
};
