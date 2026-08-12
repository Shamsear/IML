'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, showAbove: false });
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalContainer(document.body);
    }
  }, []);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const actualHeight = dropdownRef.current ? dropdownRef.current.offsetHeight : 240;
      const showAbove = spaceBelow < actualHeight && rect.top > spaceBelow;
      
      setCoords({
        top: showAbove 
          ? rect.top + window.scrollY - actualHeight - 4
          : rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
        showAbove,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Recalculate once dropdown DOM element renders
      const rId = requestAnimationFrame(() => {
        updateCoords();
      });
      
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      
      return () => {
        cancelAnimationFrame(rId);
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isOpen, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isOpen &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const py = size === 'sm' ? 'py-1.5 px-2.5' : 'py-2.5 px-3';
  const text = size === 'sm' ? 'text-xs' : 'text-sm';
  const radius = size === 'sm' ? 'rounded-md' : 'rounded-lg';

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-surface text-text-primary border border-border ${radius} ${py} ${text} text-left focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-elevated/40' : 'cursor-pointer hover:border-primary/50'}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className={`text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {required && !value && (
        <input
          tabIndex={-1}
          required
          value=""
          onChange={() => {}}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
          }}
        />
      )}

      {isOpen && portalContainer && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999,
          }}
          className="bg-surface border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-slide-down max-h-[240px]"
        >
          <div className="p-2 border-b border-border bg-surface-elevated/20 flex items-center gap-1.5 flex-shrink-0">
            <Search size={13} className="text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-transparent text-xs text-text-primary focus:outline-none placeholder:text-text-muted"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-text-muted italic">
                No matching results
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors hover:bg-surface-elevated ${isSelected ? 'bg-primary/5 text-primary font-bold' : 'text-text-secondary'}`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check size={12} className="text-primary flex-shrink-0" />}
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
