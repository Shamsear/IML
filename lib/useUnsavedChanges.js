'use client';

import { useEffect, useCallback } from 'react';
import { useBeforeUnload } from 'next/navigation';

/**
 * Warns the user before navigating away from a page with unsaved form changes.
 *
 * Usage:
 *   const [items, setItems] = useState([]);
 *   useUnsavedChanges(items.length > 0);
 *
 * @param {boolean} isDirty - Whether the form has unsaved changes
 */
export function useUnsavedChanges(isDirty) {
  // Warn on browser tab close / refresh
  useBeforeUnload(
    useCallback(
      (e) => {
        if (isDirty) {
          e.preventDefault();
          // Chrome requires returnValue to be set
          e.returnValue = '';
        }
      },
      [isDirty]
    )
  );

  // Warn on Next.js client-side navigation
  useEffect(() => {
    if (!isDirty) return;

    const handleAnchorClick = (e) => {
      const el = e.target.closest('a');
      if (!el) return;

      // Don't intercept modifier clicks or same-hash links
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (el.href === window.location.href) return;

      // Don't intercept form submit buttons
      if (el.closest('form')) return;

      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave this page?'
      );
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', handleAnchorClick, true);
    return () => document.removeEventListener('click', handleAnchorClick, true);
  }, [isDirty]);
}
