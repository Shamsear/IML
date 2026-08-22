import Link from 'next/link';

/**
 * Server-side pagination using Next.js Link (for server-rendered page.js files).
 * Client-side pages should use the Pagination component instead.
 *
 * @param {Object} props
 * @param {number} props.page - Current page (1-indexed)
 * @param {number} props.totalPages - Total pages
 * @param {number} props.totalCount - Total items
 * @param {number} props.pageSize - Items per page
 * @param {string} props.baseUrl - Base URL path (e.g. "/dashboard/loss")
 * @param {string} [props.itemLabel] - Label for items (default: "items")
 * @param {Object} [props.extraParams] - Additional URL params to preserve (e.g. { tab: 'grouped' })
 */
export default function ServerPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  baseUrl,
  itemLabel = 'items',
  extraParams = {},
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const buildHref = (p) => {
    const params = new URLSearchParams();
    params.set('page', String(p));
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs">
      <span className="text-text-muted">
        Showing <strong className="text-text-primary">{start}</strong> to{' '}
        <strong className="text-text-primary">{end}</strong> of{' '}
        <strong className="text-text-primary">{totalCount}</strong> {itemLabel}
      </span>
      <div className="flex items-center gap-1.5">
        <Link
          href={buildHref(Math.max(1, page - 1))}
          className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${
            page === 1 ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          Previous
        </Link>
        <Link
          href={buildHref(Math.min(totalPages, page + 1))}
          className={`px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary rounded-lg font-semibold transition-all duration-200 ${
            page === totalPages ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
