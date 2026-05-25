import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/email-ingestion(.*)",
  "/feedback(.*)",
  "/careers(.*)",
  "/track(.*)",
  "/accept-invite(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;

  // Subdomain routing: {slug}.rolerecruit.com → /careers/{slug}
  if (
    host.endsWith(".rolerecruit.com") &&
    host !== "www.rolerecruit.com" &&
    host !== "rolerecruit.com" &&
    host !== "localhost" &&
    !host.startsWith("127.")
  ) {
    const subdomain = host.split(".")[0];
    if (subdomain && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
      const url = req.nextUrl.clone();
      url.pathname = `/careers/${subdomain}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
