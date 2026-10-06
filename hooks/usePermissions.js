'use client';

import { useSession } from 'next-auth/react';

/**
 * Custom hook to get user permissions and role state.
 * @returns {{
 *   user: object | null,
 *   role: string,
 *   isReadOnly: boolean,
 *   canWrite: boolean,
 *   isAdmin: boolean,
 *   isLoading: boolean
 * }}
 */
export function usePermissions() {
  const { data: session, status } = useSession();
  const role = (session?.user?.role || 'ADMIN').toUpperCase();
  const isReadOnly = role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY';
  const isAdmin = role === 'ADMIN';
  const canWrite = !isReadOnly;

  return {
    user: session?.user || null,
    role,
    isReadOnly,
    canWrite,
    isAdmin,
    isLoading: status === 'loading',
  };
}
