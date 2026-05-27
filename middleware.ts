import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { get as getEdgeConfig } from "@vercel/edge-config";

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

export default clerkMiddleware(async (auth, req) => {
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

  // 2. Custom domain routing: careers.testschool.com → /careers/{slug}
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
