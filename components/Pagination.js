'use client';

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
    <div className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl shadow-sm text-xs print:hidden">
      <span className="text-text-muted">
        Showing <strong className="text-text-primary">{start}</strong> to{' '}
        <strong className="text-text-primary">{end}</strong> of{' '}
        <strong className="text-text-primary">{totalItems}</strong> {itemLabel}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-lg font-semibold transition-all"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface rounded-lg font-semibold transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}
