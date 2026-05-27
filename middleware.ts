import { NextResponse, type NextRequest } from "next/server";
import { get as getEdgeConfig } from "@vercel/edge-config";

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

function stripHostPort(host: string): string {
  const idx = host.indexOf(":");
  return idx === -1 ? host : host.slice(0, idx);
}

async function resolveCustomDomain(host: string): Promise<string | null> {
  if (!process.env.EDGE_CONFIG) return null;
  try {
    const map = await getEdgeConfig<Record<string, string>>("customDomains");
    if (!map) return null;
    return map[host] ?? null;
  } catch (err) {
    console.error("Edge Config lookup failed:", err);
    return null;
  }
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

export default async function middleware(req: NextRequest) {
  const rawHost = req.headers.get("host") ?? "";
  const host = stripHostPort(rawHost);
  const { pathname } = req.nextUrl;

  const isInfraPath = pathname.startsWith("/_next") || pathname.startsWith("/api");

  // 1. Subdomain routing: {slug}.rolerecruit.com → /careers/{slug}
  if (
    host.endsWith(".rolerecruit.com") &&
    host !== "www.rolerecruit.com" &&
    host !== "rolerecruit.com"
  ) {
    const subdomain = host.split(".")[0];
    if (subdomain && !isInfraPath) {
      const url = req.nextUrl.clone();
      url.pathname = `/careers/${subdomain}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // 2. Custom domain routing: careers.someschool.com → /careers/{slug}
  if (
    !host.endsWith(".rolerecruit.com") &&
    host !== "rolerecruit.com" &&
    host !== "localhost" &&
    !host.startsWith("127.") &&
    !isInfraPath
  ) {
    const slug = await resolveCustomDomain(host);
    if (slug) {
      const url = req.nextUrl.clone();
      url.pathname = `/careers/${slug}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Better Auth session cookie gate. The server components revalidate the
  // session via getCurrentUser() — this is just a cheap presence check.
  // Mirrors Better Auth's own fallback lookup (dot, dash, __Secure- variants).
  if (!hasBetterAuthSession(req)) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("redirect_url", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
