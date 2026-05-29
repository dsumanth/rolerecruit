import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as whatsapp from "../../convex/whatsapp";
import * as resend from "../../convex/resend";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "whatsapp.ts": async () => whatsapp,
  "resend.ts": async () => resend,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

const sendMock = vi.fn().mockResolvedValue({ data: { id: "rsd_xyz" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

beforeEach(() => {
  sendMock.mockClear();
  process.env.RESEND_API_KEY = "test-key";
  delete process.env.REPLY_INBOUND_DOMAIN;
});

async function seedDueEmail(
  t: ReturnType<typeof convexTest>,
  opts: { replyToken?: string } = {},
) {
  const schoolId = await t.mutation("schools:create" as any, {
    name: "S", board: "CBSE", city: "X", state: "X",
  });
  const candidateId = await t.mutation("candidates:create" as any, {
    name: "C", email: "c@example.test", qualifications: ["B.Ed"], subjects: ["Math"],
  });
  const appId = await t.mutation("applications:create" as any, {
    candidateId, schoolId, skipTriage: true,
  });
  await t.run(async (ctx: any) => {
    await ctx.db.insert("outreachMessages", {
      applicationId: appId,
      candidateId,
      type: "shortlist",
      channel: "email",
      body: "Subject: Hello\n\nHi there.",
      scheduledSendAt: Date.now() - 1000,
      status: "scheduled",
      draftedBy: "triage_agent",
      direction: "outbound",
      schoolId,
      ...(opts.replyToken ? { replyToken: opts.replyToken } : {}),
    });
  });
}

describe("dispatchScheduledOutreach email replyTo", () => {
  it("sets replyTo using the message replyToken and REPLY_INBOUND_DOMAIN", async () => {
    process.env.REPLY_INBOUND_DOMAIN = "reply.example.test";
    const t = convexTest(schema, modules);
    const token = "abcdef0123456789abcdef0123456789";
    await seedDueEmail(t, { replyToken: token });

    const result = await t.action("outreach:dispatchScheduledOutreach" as any, {});
    expect(result.sent).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const call = sendMock.mock.calls[0][0];
    expect(call.replyTo).toBe(`reply+${token}@reply.example.test`);
  });

  it("defaults to reply.rolerecruit.com when REPLY_INBOUND_DOMAIN is unset", async () => {
    const t = convexTest(schema, modules);
    const token = "11111111111111111111111111111111";
    await seedDueEmail(t, { replyToken: token });

    await t.action("outreach:dispatchScheduledOutreach" as any, {});
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.replyTo).toBe(`reply+${token}@reply.rolerecruit.com`);
  });

  it("omits replyTo when the message has no replyToken", async () => {
    const t = convexTest(schema, modules);
    await seedDueEmail(t, {});

    await t.action("outreach:dispatchScheduledOutreach" as any, {});
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.replyTo).toBeUndefined();
  });
});
