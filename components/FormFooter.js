'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';

/**
 * Standardized form footer with Cancel link + Submit button.
 * Replaces the identical ~15-line pattern in every create/edit form.
 *
 * @param {Object} props
 * @param {string} props.cancelHref - URL for the Cancel button
 * @param {string} [props.submitLabel] - Submit button text (default: "Save")
 * @param {boolean} [props.loading] - Show loading spinner + disable button
 * @param {boolean} [props.editMode] - Show "Update" instead of "Create"
 * @param {string} [props.className] - Extra classes on the wrapper
 */
export default function FormFooter({
  cancelHref,
  submitLabel,
  loading = false,
  editMode = false,
  className = '',
}) {
  const label = submitLabel || (editMode ? 'Update' : 'Save');

  return (
    <div className={`flex justify-end gap-2 sm:gap-3 mt-4 pt-4 border-t border-border ${className}`}>
      <Link
        href={cancelHref}
        className="px-3 sm:px-5 py-2 sm:py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200"
      >
        Cancel
      </Link>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
        disabled={loading}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        <span>{label}</span>
      </button>
    </div>
  );
}
