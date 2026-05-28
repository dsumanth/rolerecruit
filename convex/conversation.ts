import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const handleInbound = internalAction({
  args: { messageId: v.id("outreachMessages") },
  handler: async (_ctx, _args): Promise<void> => {
    // Full implementation lands in the orchestrator task.
    // This stub exists so other modules (email_reply_router, whatsapp) can
    // reference internal.conversation.handleInbound for scheduler.runAfter calls.
  },
});
