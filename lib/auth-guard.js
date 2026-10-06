import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * Centralized auth guard for server actions and API routes.
 * Returns the session if authenticated, throws if not.
 * @returns {Promise<import('next-auth').Session>}
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Auth guard that returns the user role.
 * @returns {Promise<{ session: import('next-auth').Session, role: string }>}
 */
export async function requireAuthWithRole() {
  const session = await requireAuth();
  return { session, role: session.user?.role || 'ADMIN' };
}

/**
 * Check if a role is read-only.
 * @param {string} role
 * @returns {boolean}
 */
export function isReadOnlyRole(role) {
  if (!role) return false;
  const upper = String(role).toUpperCase();
  return upper === 'VIEWER' || upper === 'READ_ONLY' || upper === 'READONLY';
}

/**
 * Auth guard that strictly requires write permission.
 * Throws Forbidden if user is in a read-only role (VIEWER / READ_ONLY).
 * @returns {Promise<import('next-auth').Session>}
 */
export async function requireWritePermission() {
  const { session, role } = await requireAuthWithRole();
  if (isReadOnlyRole(role)) {
    throw new Error('Forbidden: Read-only accounts cannot create, update, or delete data.');
  }
  return session;
}

/**
 * Auth guard that strictly requires the ADMIN role.
 * @returns {Promise<import('next-auth').Session>}
 */
export async function requireAdmin() {
  const { session, role } = await requireAuthWithRole();
  if (role !== 'ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }
  return session;
}

