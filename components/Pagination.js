import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Standardized pagination controls.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current page (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.totalItems - Total number of items
 * @param {number} props.itemsPerPage - Items per page
 * @param {Function} props.onPageChange - Called with new page number
 * @param {string} [props.itemLabel] - Label for items (default: "products")
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemLabel = 'items',
}) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-surface border border-border/80 rounded-xl shadow-xs text-xs print:hidden">
      <span className="text-text-muted text-xs">
        Showing <strong className="text-text-primary font-semibold tabular-nums">{start}</strong> to{' '}
        <strong className="text-text-primary font-semibold tabular-nums">{end}</strong> of{' '}
        <strong className="text-text-primary font-semibold tabular-nums">{totalItems}</strong> {itemLabel}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface border border-border/80 hover:bg-surface-elevated hover:border-border disabled:opacity-40 disabled:hover:bg-surface disabled:hover:border-border/80 text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer disabled:cursor-not-allowed active:scale-[0.98]"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>
        <span className="px-2.5 py-1 text-xs font-medium text-text-secondary bg-surface-elevated/60 border border-border/60 rounded-lg tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface border border-border/80 hover:bg-surface-elevated hover:border-border disabled:opacity-40 disabled:hover:bg-surface disabled:hover:border-border/80 text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer disabled:cursor-not-allowed active:scale-[0.98]"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
