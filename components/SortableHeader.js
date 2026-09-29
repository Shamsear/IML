'use client';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Reusable Sortable Table Header Component.
 *
 * @param {Object} props
 * @param {string} props.field - Key identifier for this column
 * @param {string} props.currentField - Currently active sort field
 * @param {'asc' | 'desc'} props.direction - Current sort direction
 * @param {Function} props.onSort - Callback when clicked with field name
 * @param {React.ReactNode} props.children - Header label text
 * @param {string} [props.className] - Additional classes
 * @param {'left' | 'center' | 'right'} [props.align] - Text alignment
 */
export default function SortableHeader({
  field,
  currentField,
  direction,
  onSort,
  children,
  className = '',
  align = 'left',
}) {
  const isActive = currentField === field;

  const alignClass = align === 'center' 
    ? 'justify-center text-center' 
    : align === 'right' 
    ? 'justify-end text-right' 
    : 'justify-start text-left';

  return (
    <th
      onClick={() => onSort(field)}
      className={`group cursor-pointer select-none transition-colors hover:text-text-primary ${className}`}
      title={`Sort by ${typeof children === 'string' ? children : field} (${isActive ? (direction === 'asc' ? 'descending' : 'ascending') : 'ascending'})`}
    >
      <div className={`inline-flex items-center gap-1.5 ${alignClass}`}>
        <span>{children}</span>
        <span className={`inline-flex items-center transition-all duration-150 ${isActive ? 'text-primary' : 'text-text-muted/40 group-hover:text-text-secondary'}`}>
          {isActive ? (
            direction === 'asc' ? (
              <ArrowUp size={13} className="stroke-[2.5]" />
            ) : (
              <ArrowDown size={13} className="stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      </div>
    </th>
  );
}
