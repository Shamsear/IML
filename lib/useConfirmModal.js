'use client';

import { useState, useCallback } from 'react';

/**
 * Hook to manage confirm modal state.
 * Replaces the duplicated confirmOpen/confirmData/setConfirmData pattern.
 *
 * Usage:
 *   const confirm = useConfirmModal();
 *
 *   // Show success
 *   confirm.success('Saved!', 'Product has been created.');
 *
 *   // Show error
 *   confirm.error('Error', 'Something went wrong.');
 *
 *   // Show confirmation dialog
 *   confirm.confirm('Delete?', 'This cannot be undone.', handleDelete);
 *
 *   // In JSX:
 *   <ConfirmModal
 *     open={confirm.open}
 *     onClose={confirm.close}
 *     type={confirm.type}
 *     title={confirm.title}
 *     message={confirm.message}
 *     onConfirm={confirm.onConfirm}
 *   />
 *
 * @returns {{ open, type, title, message, onConfirm, success, error, confirm, close }}
 */
export function useConfirmModal() {
  const [state, setState] = useState({
    open: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
  });

  const close = useCallback(() => {
    setState(prev => ({ ...prev, open: false, onConfirm: null }));
  }, []);

  const success = useCallback((title, message) => {
    setState({ open: true, type: 'success', title, message, onConfirm: null });
  }, []);

  const error = useCallback((title, message) => {
    setState({ open: true, type: 'error', title, message, onConfirm: null });
  }, []);

  const confirm = useCallback((title, message, onConfirm) => {
    setState({ open: true, type: 'confirm', title, message, onConfirm });
  }, []);

  return {
    open: state.open,
    type: state.type,
    title: state.title,
    message: state.message,
    onConfirm: state.onConfirm,
    success,
    error,
    confirm,
    close,
  };
}
