'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({
  options = [], // [{ value: '...', label: '...' }]
  value = '',
  onChange = () => {},
  placeholder = 'Select...',
  disabled = false,
  required = false,
  className = '',
  size = 'md', // 'sm' or 'md'
}) {
  const [isOpen, setIsOpen]               = useState(false);
  const [search, setSearch]               = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const triggerRef    = useRef(null);
  const dropdownRef   = useRef(null);
  const searchRef     = useRef(null);
  const listRef       = useRef(null);
  const itemRefs      = useRef([]);

  const [coords, setCoords]               = useState({ top: 0, left: 0, width: 0, showAbove: false });
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setPortalContainer(document.body);
  }, []);

  // ── Positioning ──────────────────────────────────────────────────────────
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect        = triggerRef.current.getBoundingClientRect();
    const spaceBelow  = window.innerHeight - rect.bottom;
    const actualHeight = dropdownRef.current ? dropdownRef.current.offsetHeight : 240;
    const showAbove   = spaceBelow < actualHeight && rect.top > spaceBelow;
    setCoords({
      top:   showAbove ? rect.top + window.scrollY - actualHeight - 4 : rect.bottom + window.scrollY + 4,
      left:  rect.left + window.scrollX,
      width: rect.width,
      showAbove,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    const rId = requestAnimationFrame(updateCoords);
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      cancelAnimationFrame(rId);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, search, updateCoords]);

  // ── Click-outside ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // ── Open / close helpers ─────────────────────────────────────────────────
  const open = useCallback(() => {
    if (disabled) return;
    // Pre-highlight the currently selected item
    const idx = filteredOptions.findIndex((opt) => String(opt.value) === String(value));
    setHighlightedIndex(idx >= 0 ? idx : 0);
    setIsOpen(true);
  }, [disabled, filteredOptions, value]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const handleSelect = useCallback((val) => {
    onChange(val);
    close();
  }, [onChange, close]);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  // ── Auto-scroll highlighted item into view ───────────────────────────────
  useEffect(() => {
    if (highlightedIndex < 0 || !itemRefs.current[highlightedIndex]) return;
    itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [search]);

  // ── Keyboard handler on the search input ────────────────────────────────
  const handleSearchKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(filteredOptions.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  };

  // ── Keyboard handler on the trigger button ───────────────────────────────
  const handleTriggerKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        isOpen ? close() : open();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) open();
        else setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) open();
        else setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        if (isOpen) close();
        break;
      default:
        break;
    }
  };

  // ── Style tokens ─────────────────────────────────────────────────────────
  const py     = size === 'sm' ? 'py-1.5 px-2.5' : 'py-2.5 px-3';
  const text   = size === 'sm' ? 'text-xs' : 'text-sm';
  const radius = size === 'sm' ? 'rounded-md' : 'rounded-lg';

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between bg-surface text-text-primary border border-border ${radius} ${py} ${text} text-left focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed bg-surface-elevated/40' : 'cursor-pointer hover:border-primary/50'
        }`}
      >
        <span className="truncate flex items-center gap-2">
          {selectedOption?.imageUrl && (
            <img
              src={selectedOption.imageUrl}
              alt=""
              className="w-5 h-5 rounded border border-border bg-white object-contain flex-shrink-0"
            />
          )}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
          {selectedOption && (() => {
            const optionCount = selectedOption.count !== undefined ? selectedOption.count : (selectedOption.stock !== undefined ? selectedOption.stock : selectedOption.warehouseStock);
            if (optionCount === undefined) return null;
            return (
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${optionCount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-danger/10 text-danger'}`}>
                {optionCount} qty
              </span>
            );
          })()}
        </span>
        <ChevronDown
          size={size === 'sm' ? 14 : 16}
          className={`text-text-secondary transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {required && !value && (
        <input
          tabIndex={-1}
          required
          value=""
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', bottom: 0, left: 0, right: 0, height: '1px' }}
        />
      )}

      {isOpen && portalContainer && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={{
            position: 'absolute',
            top:   `${coords.top}px`,
            left:  `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999,
          }}
          className="bg-surface border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-slide-down max-h-[240px]"
        >
          {/* Search bar */}
          <div className="p-2 border-b border-border bg-surface-elevated/20 flex items-center gap-1.5 flex-shrink-0">
            <Search size={13} className="text-text-muted flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search or use ↑ ↓ Enter…"
              className="w-full bg-transparent text-xs text-text-primary focus:outline-none placeholder:text-text-muted"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div ref={listRef} className="flex-1 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-text-muted italic">
                No matching results
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected    = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value}
                    ref={(el) => { itemRefs.current[idx] = el; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed bg-surface-elevated/20 text-text-muted'
                        : isHighlighted
                        ? 'bg-primary/10 text-primary'
                        : isSelected
                        ? 'bg-primary/5 text-primary font-bold'
                        : 'text-text-secondary hover:bg-surface-elevated'
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      {opt.imageUrl && (
                        <img
                          src={opt.imageUrl}
                          alt=""
                          className="w-5 h-5 rounded border border-border bg-white object-contain flex-shrink-0"
                        />
                      )}
                      <span>{opt.label}</span>
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => {
                        const optionCount = opt.count !== undefined ? opt.count : (opt.stock !== undefined ? opt.stock : opt.warehouseStock);
                        if (optionCount === undefined) return null;
                        return (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${optionCount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-danger/10 text-danger'}`}>
                            {optionCount} qty
                          </span>
                        );
                      })()}
                      {isSelected && <Check size={12} className="text-primary flex-shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        portalContainer
      )}
    </div>
  );
}
