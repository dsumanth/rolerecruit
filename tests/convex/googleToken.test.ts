import { describe, it, expect } from "vitest";
import { needsRefresh, refreshAccessToken } from "../../convex/lib/googleToken";

describe("needsRefresh", () => {
  it("is true when expiry is in the past", () => {
    expect(needsRefresh(1000, 2000)).toBe(true);
  });
  it("is true within the 60s safety window before expiry", () => {
    expect(needsRefresh(100_000, 100_000 - 30_000)).toBe(true);
  });
  it("is false when expiry is comfortably in the future", () => {
    expect(needsRefresh(100_000, 0)).toBe(false);
  });
});

describe("refreshAccessToken", () => {
  it("posts the refresh token and returns new access token + expiry", async () => {
    let captured: { url: string; body: string } | null = null;
    const fakeFetch = (async (url: string, init: { body: string }) => {
      captured = { url, body: init.body };
      return {
        ok: true,
        json: async () => ({ access_token: "new-at", expires_in: 3600 }),
      };
    }) as unknown as typeof fetch;

    const result = await refreshAccessToken(
      { refreshToken: "rt", clientId: "cid", clientSecret: "sec", nowMs: 1_000 },
      fakeFetch,
    );

    expect(result.access_token).toBe("new-at");
    expect(result.expiry).toBe(1_000 + 3600 * 1000);
    expect(captured!.url).toBe("https://oauth2.googleapis.com/token");
    expect(captured!.body).toContain("grant_type=refresh_token");
    expect(captured!.body).toContain("refresh_token=rt");
  });

  it("throws when the refresh request fails", async () => {
    const fakeFetch = (async () => ({ ok: false, text: async () => "boom" })) as unknown as typeof fetch;
    await expect(
      refreshAccessToken(
        { refreshToken: "rt", clientId: "cid", clientSecret: "sec", nowMs: 0 },
        fakeFetch,
      ),
    ).rejects.toThrow("token refresh failed");
  });
});
