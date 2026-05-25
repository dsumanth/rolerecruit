import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function extractSlug(host: string): string | null {
  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain !== "www" && subdomain !== "rolerecruit") {
      return subdomain;
    }
  }
  return null;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const slug = extractSlug(host);

  if (slug && !request.nextUrl.pathname.startsWith("/careers")) {
    return NextResponse.rewrite(
      new URL(`/careers/${slug}${request.nextUrl.pathname}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_static|_vercel|favicon.ico|feedback|dashboard|onboarding|sign-in|sign-up).*)"],
};
