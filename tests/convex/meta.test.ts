import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  exchangeCodeForToken,
  subscribeAppToWaba,
  fetchWabaDetails,
  sendCloudText,
  MetaApiError,
} from "../../convex/lib/meta";

function mockFetchOnce(status: number, json: any) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as any);
}

beforeEach(() => {
  process.env.META_APP_ID = "test-app-id";
  process.env.META_APP_SECRET = "test-app-secret";
});

afterEach(() => {
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
  vi.restoreAllMocks();
});

describe("meta client", () => {
  it("exchanges code for access token", async () => {
    const f = mockFetchOnce(200, { access_token: "EAAG123" });
    const token = await exchangeCodeForToken("the-code");
    expect(token).toBe("EAAG123");
    expect(f.mock.calls[0][0]).toContain("/oauth/access_token");
    expect(f.mock.calls[0][0]).toContain("code=the-code");
  });

  it("sends a text message and returns the message id", async () => {
    const f = mockFetchOnce(200, { messages: [{ id: "wamid.ABC" }] });
    const id = await sendCloudText({ phoneNumberId: "111", token: "T", to: "+919876543210", body: "hi" });
    expect(id).toBe("wamid.ABC");
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("/111/messages");
    expect((init as any).headers.Authorization).toBe("Bearer T");
    const sent = JSON.parse((init as any).body);
    expect(sent.to).toBe("+919876543210");
    expect(sent.type).toBe("text");
  });

  it("subscribes the app to a WABA", async () => {
    const f = mockFetchOnce(200, { success: true });
    await subscribeAppToWaba("waba-1", "T");
    expect(f.mock.calls[0][0]).toContain("/waba-1/subscribed_apps");
  });

  it("fetches WABA details", async () => {
    mockFetchOnce(200, {
      name: "Greenfield",
      phone_numbers: { data: [{ id: "111", display_phone_number: "+91 98765 43210", verified_name: "Greenfield Intl" }] },
    });
    const d = await fetchWabaDetails("waba-1", "T");
    expect(d.businessName).toBe("Greenfield");
    expect(d.phoneNumberId).toBe("111");
    expect(d.displayPhoneNumber).toBe("+91 98765 43210");
    expect(d.verifiedName).toBe("Greenfield Intl");
  });

  it("throws MetaApiError on non-2xx", async () => {
    mockFetchOnce(400, { error: { message: "Invalid OAuth code" } });
    mockFetchOnce(400, { error: { message: "Invalid OAuth code" } });
    await expect(exchangeCodeForToken("bad")).rejects.toThrow(MetaApiError);
    await expect(exchangeCodeForToken("bad")).rejects.toThrow("Invalid OAuth code");
  });
});
