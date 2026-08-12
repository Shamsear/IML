import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

// Protect all dashboard views and dashboard API endpoints.
// Public routes like /, /api/public, and /login will remain open.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*"
  ]
};
