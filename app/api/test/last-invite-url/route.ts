/**
 * Dev/E2E only.
 *
 * Returns the URL for the most recently issued evaluation invite token so the
 * Playwright spec can open the evaluator-facing form without polling the email
 * outbox. Disabled in production via NODE_ENV check.
 */
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function GET() {
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
  const client = new ConvexHttpClient(url);
  // `as any` because the type-generation step may not have run in the worktree;
  // the runtime contract is enforced by the query handler in convex/evaluationInvites.ts.
  const last = await client.query(
    api.evaluationInvites.lastInviteForTest as any,
    {},
  );
  if (!last) {
    return NextResponse.json({ error: "no invites yet" }, { status: 404 });
  }
  const base = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    url: `${base}/evaluations/from-token?token=${last.token}`,
  });
}
