import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/email/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }
    const result = await ctx.runAction(api.email_reply_router.dispatch, {
      to: body.to ?? "",
      from: body.from ?? "",
      subject: body.subject,
      text: body.text,
      html: body.html,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
  }),
});

http.route({
  path: "/whatsapp/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }
    // Gupshup webhook shape: { type: "message", payload: { source: "+91...", payload: { text: "..." } } }
    const fromPhone: string = body?.payload?.source ?? "";
    const text: string = body?.payload?.payload?.text ?? body?.payload?.text ?? "";
    if (!fromPhone || !text) {
      return new Response(JSON.stringify({ success: true, ignored: true }), { status: 200 });
    }
    const result = await ctx.runAction(api.whatsapp.handleInboundMessage, { fromPhone, body: text });
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
  }),
});

http.route({
  path: "/whatsapp/webhook",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }),
});

http.route({
  path: "/whatsapp/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const result = await ctx.runAction(internal.whatsappWebhook.processWebhook, { rawBody, signature });
    if (!result.verified) {
      return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
    }
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
  }),
});

export default http;
