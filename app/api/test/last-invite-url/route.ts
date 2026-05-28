/**
 * Dev/E2E only.
 *
 * Returns the URL for the most recently issued evaluation invite token so the
 * Playwright spec can open the evaluator-facing form without polling the email
 * outbox. Disabled in production via NODE_ENV check.
 */
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in prod" }, { status: 403 });
  }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 },
    );
  }
  const rawIndex = req.nextUrl.searchParams.get("index");
  const index = rawIndex !== null ? Number(rawIndex) : 0;
  if (Number.isNaN(index) || index < 0) {
    return NextResponse.json({ error: "invalid index" }, { status: 400 });
  }
  const client = new ConvexHttpClient(url);
  const last = await client.query(
    api.evaluationInvites.lastInviteForTest as any,
    { index },
  );
  if (!last) {
    return NextResponse.json({ error: "no invites yet" }, { status: 404 });
  }
  const base = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    url: `${base}/evaluations/from-token?token=${last.token}`,
  });
}
