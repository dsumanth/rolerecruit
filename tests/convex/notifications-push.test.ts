import { describe, it, expect, beforeEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as notifications from "../../convex/notifications";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "notifications.ts": async () => notifications,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

describe("sendPushNotification (real Expo API)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts a payload to https://exp.host/--/api/v2/push/send with the tokens, title, body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "{}" });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules);
    await t.action("notifications:sendPushNotification" as any, {
      expoPushTokens: ["ExpoPushToken[A]", "ExpoPushToken[B]"],
      title: "Form is now open",
      body: "Priya's demo",
      data: { demoId: "demo_x" },
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].to).toBe("ExpoPushToken[A]");
    expect(body[0].title).toBe("Form is now open");
    expect(body[0].body).toBe("Priya's demo");
    expect(body[0].data).toEqual({ demoId: "demo_x" });
  });

  it("returns early when no tokens supplied (no fetch)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await t.action("notifications:sendPushNotification" as any, {
      expoPushTokens: [], title: "x", body: "x",
    } as any);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
