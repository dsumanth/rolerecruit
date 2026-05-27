import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { receiveEmail } from "./email_ingestion";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/email/inbound",
  method: "POST",
  handler: receiveEmail,
});

export default http;
