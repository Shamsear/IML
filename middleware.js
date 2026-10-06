import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role?.toUpperCase();
    const isReadOnly = role === 'VIEWER' || role === 'READ_ONLY' || role === 'READONLY';

    if (isReadOnly) {
      const pathname = req.nextUrl.pathname;
      const isWritePath =
        pathname.endsWith('/new') ||
        pathname.endsWith('/edit') ||
        pathname.includes('/edit/') ||
        pathname.includes('/headings') ||
        pathname === '/dashboard/staff/assign' ||
        pathname === '/dashboard/rebrand/new' ||
        pathname === '/dashboard/rebrand/receive' ||
        pathname === '/dashboard/rebrand/give-back' ||
        pathname === '/dashboard/rebrand/revert';

      const isSettingsPath =
        pathname === '/dashboard/settings' ||
        pathname.startsWith('/dashboard/settings/');

      if (isSettingsPath) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      if (isWritePath) {
        // Redirect to the corresponding list view
        const segments = pathname.split('/').filter(Boolean);
        const target = segments.length >= 2 ? `/dashboard/${segments[1]}` : '/dashboard';
        return NextResponse.redirect(new URL(target, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Protect all dashboard views and dashboard API endpoints.
// Public routes like /, /api/public, and /login will remain open.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*"
  ]
};

