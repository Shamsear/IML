'use client';

import { Search } from 'lucide-react';
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
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-end print:hidden">
      {/* Search */}
      <div className="flex flex-col gap-1.5 w-full sm:flex-1">
        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Search</label>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-[34px]"
          />
        </div>
      </div>

      {/* Filter dropdowns */}
      {filters.map((filter, i) => (
        <div key={i} className="flex flex-col gap-1.5 w-full sm:w-44">
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
