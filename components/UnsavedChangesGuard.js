'use client';

import { useState, useEffect } from 'react';
import ConfirmModal from '@/components/ConfirmModal';

/**
 * Listens for 'unsaved-changes-attempt' custom events (dispatched by useUnsavedChanges)
 * and shows a ConfirmModal before allowing navigation.
 *
 * Place this once in the root layout or dashboard layout.
 */
export default function UnsavedChangesGuard() {
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setPendingHref(e.detail.href);
      setOpen(true);
    };

    window.addEventListener('unsaved-changes-attempt', handler);
    return () => window.removeEventListener('unsaved-changes-attempt', handler);
  }, []);

  const handleConfirm = () => {
    if (pendingHref) {
      window.location.href = pendingHref;
    }
    setOpen(false);
    setPendingHref(null);
  };

  const handleCancel = () => {
    setOpen(false);
    setPendingHref(null);
  };

  return (
    <ConfirmModal
      open={open}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      type="confirm"
      title="Unsaved Changes"
      message="You have unsaved changes. Are you sure you want to leave this page?"
      confirmLabel="Leave Page"
    />
  );
}
