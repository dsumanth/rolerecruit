import { NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectUri = `${url.origin}/api/oauth/google-callback`;

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    await fetchAction(api.calendar.connectGoogleCalendar, {
      code,
      redirectUri,
    });
    return NextResponse.redirect(new URL("/dashboard/settings/calendar", request.url));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
