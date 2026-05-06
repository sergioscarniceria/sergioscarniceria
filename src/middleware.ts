import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Skew Protection Middleware
 *
 * When Vercel deploys a new version, browsers with the old version loaded
 * try to fetch JS chunks from the old deployment (which no longer exists).
 * This causes blank pages and "Cargando..." that never finishes.
 *
 * This middleware pins each browser session to the deployment it loaded,
 * so all subsequent requests go to the same version until the user reloads.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;

  // Only set cookie on first request (when no __vdpl cookie exists)
  if (deploymentId && !request.cookies.get("__vdpl")) {
    response.cookies.set("__vdpl", deploymentId, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
    });
  }

  return response;
}

// Apply to all pages except static assets and API routes
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo|apple-touch-icon|api/).*)",
  ],
};
