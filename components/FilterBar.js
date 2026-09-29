'use client';

import { Search, X } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

/**
 * Standardized filter bar with search input and optional filter dropdowns.
 *
 * @param {Object} props
 * @param {string} props.searchValue - Current search query
 * @param {Function} props.onSearchChange - Called when search changes
 * @param {string} [props.searchPlaceholder] - Search input placeholder
 * @param {Array} [props.filters] - Array of filter configs: [{ label, value, onChange, options }]
 */
export default function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
}) {
  return (
    <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-4.5 shadow-xs flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end print:hidden transition-all">
      {/* Search */}
      <div className="flex flex-col gap-1.5 w-full sm:flex-1">
        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Search</label>
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={14} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-surface-elevated/40 hover:bg-surface-elevated/70 focus:bg-surface text-text-primary placeholder:text-text-muted border border-border/80 rounded-xl pl-9 pr-8 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-[38px]"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-elevated transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter dropdowns */}
      {filters.map((filter, i) => (
        <div key={i} className="flex flex-col gap-1.5 w-full sm:w-48">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{filter.label}</label>
          <CustomSelect
            options={filter.options}
            value={filter.value}
            onChange={filter.onChange}
            size="sm"
          />
        </div>
      ))}
    </div>
  );
}
