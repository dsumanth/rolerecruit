import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/sign-out",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth",
  "/api/webhooks",
  "/api/email-ingestion",
  "/feedback",
  "/careers",
  "/track",
  "/accept-invite",
];

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function middleware(req: NextRequest) {
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

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Better Auth session cookie gate. The server components revalidate
  // the session via isAuthenticated() — this is just a cheap presence check.
  // Mirrors Better Auth's own fallback lookup: tries dot, dash, and __Secure-
  // variants so we don't bounce users whose cookie was set with a different
  // attribute set (e.g. Safari rewriting to the Secure-prefixed name behind
  // certain TLS proxies).
  if (!hasBetterAuthSession(req)) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("redirect_url", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

function hasBetterAuthSession(req: NextRequest): boolean {
  const candidates = [
    "better-auth.session_token",
    "better-auth-session_token",
    "__Secure-better-auth.session_token",
    "__Secure-better-auth-session_token",
  ];
  for (const name of candidates) {
    if (req.cookies.get(name)?.value) return true;
  }
  return false;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
