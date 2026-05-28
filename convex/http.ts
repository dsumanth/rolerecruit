import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
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

export default http;
