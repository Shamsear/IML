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
