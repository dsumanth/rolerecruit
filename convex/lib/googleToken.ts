const SAFETY_WINDOW_MS = 60_000;

export function needsRefresh(expiryMs: number, nowMs: number): boolean {
  return expiryMs - SAFETY_WINDOW_MS <= nowMs;
}

export interface RefreshInput {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  nowMs: number;
}

export interface RefreshedToken {
  access_token: string;
  expiry: number;
}

export async function refreshAccessToken(
  input: RefreshInput,
  fetchImpl: typeof fetch,
): Promise<RefreshedToken> {
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`token refresh failed: ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    expiry: input.nowMs + (data.expires_in ?? 3600) * 1000,
  };
}
