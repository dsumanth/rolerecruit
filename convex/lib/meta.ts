const GRAPH = "https://graph.facebook.com";

function apiVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? "v22.0";
}

export class MetaApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
  }
}

async function metaFetch(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `Meta API error ${res.status}`;
    throw new MetaApiError(res.status, msg);
  }
  return json;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not set");
  const url =
    `${GRAPH}/${apiVersion()}/oauth/access_token` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&code=${encodeURIComponent(code)}`;
  const json = await metaFetch(url);
  return json.access_token as string;
}

// Upgrade a freshly-exchanged token to a long-lived one. Embedded Signup
// system-user tokens are usually already non-expiring; this is the documented
// belt-and-suspenders step so stored tokens don't silently expire.
export async function exchangeForLongLivedToken(token: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not set");
  const url =
    `${GRAPH}/${apiVersion()}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&fb_exchange_token=${encodeURIComponent(token)}`;
  const json = await metaFetch(url);
  return json.access_token as string;
}

export async function subscribeAppToWaba(wabaId: string, token: string): Promise<void> {
  await metaFetch(`${GRAPH}/${apiVersion()}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface WabaDetails {
  businessName: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
}

export async function fetchWabaDetails(wabaId: string, token: string): Promise<WabaDetails> {
  const json = await metaFetch(
    `${GRAPH}/${apiVersion()}/${wabaId}?fields=name,phone_numbers{id,display_phone_number,verified_name}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const phone = json.phone_numbers?.data?.[0] ?? {};
  return {
    businessName: json.name ?? "",
    phoneNumberId: phone.id ?? "",
    displayPhoneNumber: phone.display_phone_number ?? "",
    verifiedName: phone.verified_name ?? "",
  };
}

export async function sendCloudText(args: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
}): Promise<string> {
  const json = await metaFetch(`${GRAPH}/${apiVersion()}/${args.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: args.to,
      type: "text",
      text: { body: args.body },
    }),
  });
  return json.messages?.[0]?.id ?? "";
}

export async function sendCloudTemplate(args: {
  phoneNumberId: string;
  token: string;
  to: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
}): Promise<string> {
  const json = await metaFetch(`${GRAPH}/${apiVersion()}/${args.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: args.to,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: args.languageCode },
        components: args.bodyParams.length
          ? [{ type: "body", parameters: args.bodyParams.map((t) => ({ type: "text", text: t })) }]
          : [],
      },
    }),
  });
  return json.messages?.[0]?.id ?? "";
}
